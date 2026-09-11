import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse, AuthError } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import {
  transitionBooking,
  rescheduleBooking,
  BookingTransitionError,
} from "@/lib/bookingTransitions";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
  z.object({ action: z.literal("complete") }),
  z.object({ action: z.literal("cancel"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("no_show") }),
  z.object({ action: z.literal("reschedule"), starts_at: z.string().datetime() }),
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { session, business } = await requireBusinessMember(params.slug, [
      "BUSINESS_OWNER",
      "STAFF",
    ]);

    // Staff may only act on their OWN appointments — never another staff
    // member's, even within the same business (spec #42).
    if (session.role === "STAFF") {
      const staffRecord = await prisma.staff.findFirst({
        where: { businessId: business.id, userId: session.userId },
      });
      const booking = await prisma.booking.findFirst({ where: { id: params.id, businessId: business.id } });
      if (!booking) throw new AuthError("Booking not found.", 404);
      if (!staffRecord || booking.staffId !== staffRecord.id) {
        throw new AuthError("You can only manage your own appointments.", 403);
      }
    }

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const d = parsed.data;

    const booking =
      d.action === "reschedule"
        ? await rescheduleBooking(business.id, params.id, d.starts_at, session.userId, session.role)
        : await transitionBooking(
            business.id,
            params.id,
            d.action,
            session.userId,
            session.role,
            "reason" in d ? d.reason : undefined
          );

    return NextResponse.json({ booking });
  } catch (err) {
    if (err instanceof BookingTransitionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
