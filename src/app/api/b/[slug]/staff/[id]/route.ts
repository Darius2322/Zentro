import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

const dayScheduleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  is_off: z.boolean().default(false),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

const breakSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().max(50).default("Break"),
});

const updateSchema = z.object({
  title: z.string().max(100).optional(),
  is_active: z.boolean().optional(),
  qualified_service_ids: z.array(z.string()).optional(),
  working_hours: z.array(dayScheduleSchema).optional(), // full week replace when provided
  breaks: z.array(breakSchema).optional(), // full set replace when provided
});

/**
 * Owner-only staff management (spec #46). A deactivated staff member is
 * excluded from the availability engine's candidateStaff query on their
 * next request, but their historical bookings are untouched — nothing
 * here deletes a Booking row.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const existing = await prisma.staff.findFirst({ where: { id: params.id, businessId: business.id } });
    if (!existing) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
    const d = parsed.data;

    const staff = await prisma.$transaction(async (tx) => {
      if (d.qualified_service_ids) {
        await tx.staffService.deleteMany({ where: { staffId: params.id } });
        await tx.staffService.createMany({
          data: d.qualified_service_ids.map((serviceId) => ({ staffId: params.id, serviceId })),
        });
      }
      if (d.working_hours) {
        await tx.staffWorkingHours.deleteMany({ where: { staffId: params.id } });
        await tx.staffWorkingHours.createMany({
          data: d.working_hours.map((w) => ({
            staffId: params.id,
            weekday: w.weekday,
            isOff: w.is_off,
            startTime: w.is_off ? null : w.start_time,
            endTime: w.is_off ? null : w.end_time,
          })),
        });
      }
      if (d.breaks) {
        await tx.staffBreak.deleteMany({ where: { staffId: params.id } });
        await tx.staffBreak.createMany({
          data: d.breaks.map((b) => ({
            staffId: params.id,
            weekday: b.weekday,
            startTime: b.start_time,
            endTime: b.end_time,
            label: b.label,
          })),
        });
      }
      return tx.staff.update({
        where: { id: params.id },
        data: { title: d.title, isActive: d.is_active },
      });
    });

    await prisma.auditLog.create({
      data: { businessId: business.id, action: "staff.updated", targetType: "Staff", targetId: staff.id },
    });

    return NextResponse.json({ staff });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
