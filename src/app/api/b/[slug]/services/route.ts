import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, [
      "BUSINESS_OWNER",
      "STAFF",
      "PLATFORM_ADMIN",
    ]);
    const services = await prisma.service.findMany({
      where: { businessId: business.id },
      include: {
        category: true,
        qualifiedStaff: { include: { staff: { select: { id: true, fullName: true } } } },
        requiredResources: { include: { resourceType: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ services });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price_cents: z.number().int().min(0),
  duration_minutes: z.number().int().min(5).max(600),
  buffer_minutes: z.number().int().min(0).max(240).default(0),
  category_id: z.string().optional(),
  qualified_staff_ids: z.array(z.string()).default([]),
  required_resource_type_ids: z.array(z.object({ resource_type_id: z.string(), quantity: z.number().int().min(1) })).default([]),
});

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid service details." }, { status: 400 });
    }
    const d = parsed.data;

    const service = await prisma.service.create({
      data: {
        businessId: business.id,
        name: d.name,
        description: d.description,
        priceCents: d.price_cents,
        durationMinutes: d.duration_minutes,
        bufferMinutes: d.buffer_minutes,
        categoryId: d.category_id,
        qualifiedStaff: {
          create: d.qualified_staff_ids.map((staffId) => ({ staffId })),
        },
        requiredResources: {
          create: d.required_resource_type_ids.map((r) => ({
            resourceTypeId: r.resource_type_id,
            quantity: r.quantity,
          })),
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        action: "service.created",
        targetType: "Service",
        targetId: service.id,
      },
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
