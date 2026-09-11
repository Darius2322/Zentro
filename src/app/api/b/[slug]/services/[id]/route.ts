import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  price_cents: z.number().int().min(0).optional(),
  duration_minutes: z.number().int().min(5).max(600).optional(),
  buffer_minutes: z.number().int().min(0).max(240).optional(),
  is_active: z.boolean().optional(),
  qualified_staff_ids: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const existing = await prisma.service.findFirst({ where: { id: params.id, businessId: business.id } });
    if (!existing) return NextResponse.json({ error: "Service not found." }, { status: 404 });

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
    const d = parsed.data;

    const service = await prisma.$transaction(async (tx) => {
      if (d.qualified_staff_ids) {
        await tx.staffService.deleteMany({ where: { serviceId: params.id } });
        await tx.staffService.createMany({
          data: d.qualified_staff_ids.map((staffId) => ({ staffId, serviceId: params.id })),
        });
      }
      return tx.service.update({
        where: { id: params.id },
        data: {
          name: d.name,
          description: d.description,
          priceCents: d.price_cents,
          durationMinutes: d.duration_minutes,
          bufferMinutes: d.buffer_minutes,
          isActive: d.is_active,
        },
      });
    });

    await prisma.auditLog.create({
      data: { businessId: business.id, action: "service.updated", targetType: "Service", targetId: service.id },
    });

    return NextResponse.json({ service });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

// "Delete" always archives (isActive = false) rather than removing the row —
// historical bookings reference this service and must retain their
// snapshotted info regardless (spec #45/#91).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const existing = await prisma.service.findFirst({ where: { id: params.id, businessId: business.id } });
    if (!existing) return NextResponse.json({ error: "Service not found." }, { status: 404 });

    await prisma.service.update({ where: { id: params.id }, data: { isActive: false } });
    await prisma.auditLog.create({
      data: { businessId: business.id, action: "service.archived", targetType: "Service", targetId: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
