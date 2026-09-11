import { prisma } from "./db";
import { computeAvailability, AvailabilityError } from "./availability";
import { queueNotification } from "./notifications";
import type { BookingStatus } from "@prisma/client";

export class BookingTransitionError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const ALLOWED_FROM: Record<Exclude<BookingStatus, "PENDING">, BookingStatus[]> = {
  CONFIRMED: ["PENDING"],
  COMPLETED: ["CONFIRMED", "PENDING"],
  CANCELLED: ["PENDING", "CONFIRMED"],
  NO_SHOW: ["PENDING", "CONFIRMED"],
};

export async function transitionBooking(
  businessId: string,
  bookingId: string,
  action: "confirm" | "complete" | "cancel" | "no_show",
  actorId: string | null,
  actorRole: string,
  reason?: string
) {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, businessId } });
  if (!booking) throw new BookingTransitionError("Booking not found.", 404);

  const targetStatus: BookingStatus =
    action === "confirm" ? "CONFIRMED" : action === "complete" ? "COMPLETED" : action === "cancel" ? "CANCELLED" : "NO_SHOW";

  if (!ALLOWED_FROM[targetStatus].includes(booking.status)) {
    throw new BookingTransitionError(
      `Cannot mark a ${booking.status} booking as ${targetStatus}.`,
      409
    );
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: targetStatus,
        confirmedAt: targetStatus === "CONFIRMED" ? now : booking.confirmedAt,
        completedAt: targetStatus === "COMPLETED" ? now : booking.completedAt,
        cancelledAt: targetStatus === "CANCELLED" ? now : booking.cancelledAt,
        cancelReason: targetStatus === "CANCELLED" ? reason : booking.cancelReason,
      },
    });

    await tx.auditLog.create({
      data: {
        businessId,
        actorId,
        actorRole: actorRole as any,
        action: `booking.${action}ed`.replace("confirmed", "confirmed"),
        targetType: "Booking",
        targetId: bookingId,
        metadata: reason ? { reason } : undefined,
      },
    });

    return result;
  });

  if (targetStatus === "CANCELLED") {
    const customer = await prisma.customer.findUnique({ where: { id: updated.customerId } });
    if (customer) {
      await queueNotification({
        businessId,
        channel: "sms",
        recipient: customer.phone,
        template: "booking_cancelled",
        payload: { booking_reference: updated.bookingReference, reason },
      }).catch(() => {});
    }
  }

  return updated;
}

/**
 * Reschedule re-validates the NEW slot from scratch, excluding the booking
 * being moved from its own conflict check (so it doesn't block itself), and
 * relies on the same Postgres exclusion constraints as booking creation to
 * catch any race against a concurrent booking of the target slot.
 */
export async function rescheduleBooking(
  businessId: string,
  bookingId: string,
  newStartsAt: string,
  actorId: string,
  actorRole: string
) {
  const booking = await prisma.booking.findFirst({ where: { id: bookingId, businessId } });
  if (!booking) throw new BookingTransitionError("Booking not found.", 404);
  if (booking.status === "COMPLETED" || booking.status === "CANCELLED") {
    throw new BookingTransitionError(`Cannot reschedule a ${booking.status} booking.`, 409);
  }

  const requestedStart = new Date(newStartsAt);
  const dateStr = requestedStart.toISOString().slice(0, 10);

  const availability = await computeAvailability({
    businessId,
    serviceId: booking.serviceId,
    dateFrom: dateStr,
    dateTo: dateStr,
    staffId: booking.staffId,
    excludeBookingId: booking.id,
  });

  const dayResult = availability.dates.find((d) => d.date === dateStr);
  const match = dayResult?.slots.find(
    (s) => s.startsAt.getTime() === requestedStart.getTime() && s.staffId === booking.staffId
  );
  if (!match) {
    throw new BookingTransitionError(
      "That time is not available. Please choose another available time.",
      409
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.booking.update({
      where: { id: bookingId },
      data: { startsAt: match.startsAt, endsAt: match.endsAt },
    });
    await tx.auditLog.create({
      data: {
        businessId,
        actorId,
        actorRole: actorRole as any,
        action: "booking.rescheduled",
        targetType: "Booking",
        targetId: bookingId,
        metadata: { from: booking.startsAt.toISOString(), to: match.startsAt.toISOString() },
      },
    });
    return result;
  });

  const customer = await prisma.customer.findUnique({ where: { id: updated.customerId } });
  if (customer) {
    await queueNotification({
      businessId,
      channel: "sms",
      recipient: customer.phone,
      template: "booking_rescheduled",
      payload: { booking_reference: updated.bookingReference, starts_at: updated.startsAt.toISOString() },
    }).catch(() => {});
  }

  return updated;
}
