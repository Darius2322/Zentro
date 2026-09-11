import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeAvailability, AvailabilityError } from "@/lib/availability";

const querySchema = z.object({
  business_id: z.string().min(1),
  service_id: z.string().min(1),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staff_id: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request parameters." },
      { status: 400 }
    );
  }

  const { business_id, service_id, date_from, date_to, staff_id } = parsed.data;

  // Hard cap the query window so a caller can't request years of dates in
  // one call and force the engine to churn through unbounded computation.
  const spanDays =
    (new Date(date_to).getTime() - new Date(date_from).getTime()) / (1000 * 60 * 60 * 24);
  if (spanDays < 0 || spanDays > 62) {
    return NextResponse.json(
      { error: "Date range must be between 0 and 62 days." },
      { status: 400 }
    );
  }

  try {
    const result = await computeAvailability({
      businessId: business_id,
      serviceId: service_id,
      dateFrom: date_from,
      dateTo: date_to,
      staffId: staff_id,
    });

    return NextResponse.json({
      service: result.service,
      dates: result.dates.map((d) => ({
        date: d.date,
        slots: d.slots.map((s) => ({
          starts_at: s.startsAt.toISOString(),
          ends_at: s.endsAt.toISOString(),
          staff_id: s.staffId,
          staff_name: s.staffName,
        })),
      })),
    });
  } catch (err) {
    if (err instanceof AvailabilityError) {
      const status = err.code === "BUSINESS_NOT_FOUND" || err.code === "SERVICE_NOT_FOUND" ? 404 : 200;
      // NOT_FOUND -> 404; everything else (e.g. no qualified staff, business
      // unavailable) is a normal "no slots" outcome, not a server error.
      return NextResponse.json(
        { error: err.message, code: err.code, dates: [] },
        { status }
      );
    }
    console.error("availability computation failed", err);
    return NextResponse.json(
      { error: "Something went wrong while checking availability. Please try again." },
      { status: 500 }
    );
  }
}
