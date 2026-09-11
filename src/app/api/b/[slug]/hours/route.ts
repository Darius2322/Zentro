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
    const hours = await prisma.businessHours.findMany({ where: { businessId: business.id } });
    return NextResponse.json({
      timezone: business.timezone,
      booking_interval_minutes: business.bookingIntervalMinutes,
      min_notice_minutes: business.minNoticeMinutes,
      max_advance_booking_days: business.maxAdvanceBookingDays,
      hours,
    });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const daySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  is_closed: z.boolean().default(false),
  start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

const bodySchema = z.object({
  hours: z.array(daySchema),
  booking_interval_minutes: z.number().int().min(5).max(120).optional(),
  min_notice_minutes: z.number().int().min(0).max(10080).optional(),
  max_advance_booking_days: z.number().int().min(1).max(365).optional(),
});

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid business hours." }, { status: 400 });
    const d = parsed.data;

    await prisma.$transaction(async (tx) => {
      await tx.businessHours.deleteMany({ where: { businessId: business.id } });
      await tx.businessHours.createMany({
        data: d.hours.map((h) => ({
          businessId: business.id,
          weekday: h.weekday,
          isClosed: h.is_closed,
          startTime: h.is_closed ? null : h.start_time,
          endTime: h.is_closed ? null : h.end_time,
        })),
      });
      await tx.business.update({
        where: { id: business.id },
        data: {
          bookingIntervalMinutes: d.booking_interval_minutes,
          minNoticeMinutes: d.min_notice_minutes,
          maxAdvanceBookingDays: d.max_advance_booking_days,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
