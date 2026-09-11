/**
 * Booking creation — the transactional core referenced in spec #26/#27/#89.
 *
 * Availability shown to the browser is always treated as a SUGGESTION.
 * When the customer presses "Book appointment", this module:
 *   1. Re-derives the requested slot's validity from scratch (does not trust
 *      any availability payload the client may echo back).
 *   2. Opens a DB transaction and re-checks for conflicts.
 *   3. Relies on the Postgres EXCLUDE constraints (see the manual SQL
 *      migration) as the final, unbypassable guard against a race between
 *      two concurrent requests for the same staff/resource/time.
 *
 * If constraint violation occurs (Postgres error code 23P01, exclusion
 * violation), we catch it and return the friendly "just booked" message
 * rather than a raw database error (spec #62).
 */

import { nanoid } from "nanoid";
import { prisma } from "./db";
import { computeAvailability, AvailabilityError } from "./availability";
import { queueNotification } from "./notifications";
import { Prisma } from "@prisma/client";

export interface CreateBookingInput {
  businessId: string;
  serviceId: string;
  staffId?: string; // omit = "any available staff"
  startsAt: string; // ISO instant, as selected from the availability response
  customer: { fullName: string; phone: string; email?: string; notes?: string };
}

export class BookingConflictError extends Error {
  constructor() {
    super("This time was just booked. Please choose another available time.");
  }
}

function generateBookingReference(): string {
  const year = new Date().getFullYear();
  return `BK-${year}-${nanoid(8).toUpperCase()}`;
}

async function nextReceiptNumber(businessId: string, tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  // Upsert + increment inside the same transaction as the booking so the
  // counter and the receipt are consistent even under concurrent bookings.
  const counter = await tx.receiptCounter.upsert({
    where: { businessId_year: { businessId, year } },
    create: { businessId, year, lastValue: 1 },
    update: { lastValue: { increment: 1 } },
  });
  return `RCP-${year}-${String(counter.lastValue).padStart(6, "0")}`;
}

export async function createBooking(input: CreateBookingInput) {
  const requestedStart = new Date(input.startsAt);

  // Re-run the SAME availability computation used for browsing, narrowed to
  // the single day of the requested slot, and confirm the exact slot still
  // appears in the result. This closes the gap between "what the customer
  // saw" and "what is true right now."
  const dateStr = requestedStart.toISOString().slice(0, 10);
  const availability = await computeAvailability({
    businessId: input.businessId,
    serviceId: input.serviceId,
    dateFrom: dateStr,
    dateTo: dateStr,
    staffId: input.staffId,
  });

  const dayResult = availability.dates.find((d) => d.date === dateStr);
  const match = dayResult?.slots.find(
    (s) => s.startsAt.getTime() === requestedStart.getTime() &&
      (!input.staffId || s.staffId === input.staffId)
  );

  if (!match) {
    throw new BookingConflictError();
  }

  const service = await prisma.service.findUniqueOrThrow({ where: { id: input.serviceId } });

  let result: { booking: Awaited<ReturnType<typeof prisma.booking.create>>; receipt: Awaited<ReturnType<typeof prisma.receipt.create>> };
  try {
    result = await prisma.$transaction(async (tx) => {
      // Upsert-by-phone customer record, scoped to this business.
      const customer = await tx.customer.upsert({
        where: { businessId_phone: { businessId: input.businessId, phone: input.customer.phone } },
        update: { fullName: input.customer.fullName, email: input.customer.email },
        create: {
          businessId: input.businessId,
          fullName: input.customer.fullName,
          phone: input.customer.phone,
          email: input.customer.email,
          notes: input.customer.notes,
        },
      });

      const endsAt = match.endsAt;

      // The INSERT itself is what the Postgres EXCLUDE constraints guard.
      // If a concurrent request already booked this staff/resource/time,
      // Postgres raises a unique/exclusion violation here, not before.
      const booking = await tx.booking.create({
        data: {
          businessId: input.businessId,
          serviceId: input.serviceId,
          serviceNameSnapshot: service.name,
          servicePriceCentsSnapshot: service.priceCents,
          serviceDurationSnapshot: service.durationMinutes,
          staffId: match.staffId,
          customerId: customer.id,
          startsAt: requestedStart,
          endsAt,
          status: "PENDING",
          bookingReference: generateBookingReference(),
          notes: input.customer.notes,
        },
      });

      // Reserve required resources for this booking (spec #34). Resource
      // rows to reserve are re-derived server-side, never trusted from the client.
      const serviceResources = await tx.serviceResource.findMany({
        where: { serviceId: input.serviceId },
        include: { resourceType: { include: { resources: { where: { status: "AVAILABLE" } } } } },
      });
      for (const req of serviceResources) {
        const busyResourceIds = (
          await tx.bookingResource.findMany({
            where: {
              resource: { resourceTypeId: req.resourceTypeId },
              booking: {
                status: { notIn: ["CANCELLED", "NO_SHOW"] },
                startsAt: { lt: endsAt },
                endsAt: { gt: requestedStart },
              },
            },
            select: { resourceId: true },
          })
        ).map((r) => r.resourceId);

        const free = req.resourceType.resources.filter((r) => !busyResourceIds.includes(r.id));
        if (free.length < req.quantity) {
          // Forces a rollback; surfaced to the caller as a conflict.
          throw new BookingConflictError();
        }
        for (let i = 0; i < req.quantity; i++) {
          await tx.bookingResource.create({
            data: { bookingId: booking.id, resourceId: free[i].id },
          });
        }
      }

      const receiptNumber = await nextReceiptNumber(input.businessId, tx);

      const payment = await tx.payment.create({
        data: {
          businessId: input.businessId,
          bookingId: booking.id,
          amountCents: service.priceCents,
          status: "PENDING",
        },
      });

      const receipt = await tx.receipt.create({
        data: {
          businessId: input.businessId,
          bookingId: booking.id,
          paymentId: payment.id,
          receiptNumber,
          subtotalCents: service.priceCents,
          totalCents: service.priceCents,
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: input.businessId,
          action: "booking.created",
          targetType: "Booking",
          targetId: booking.id,
          metadata: { bookingReference: booking.bookingReference },
        },
      });

      return { booking, receipt };
    });
  } catch (err: any) {
    // Postgres exclusion-constraint violation surfaces as error code 23P01.
    if (err?.code === "P2010" || err?.meta?.code === "23P01" || err instanceof BookingConflictError) {
      throw new BookingConflictError();
    }
    throw err;
  }

  // Notification is fired AFTER the transaction commits, and its own
  // failure must never roll back or fail the booking that already
  // succeeded — see the try/catch inside queueNotification.
  await queueNotification({
    businessId: input.businessId,
    channel: "sms",
    recipient: input.customer.phone,
    template: "booking_confirmation",
    payload: {
      booking_reference: result.booking.bookingReference,
      service: result.booking.serviceNameSnapshot,
      starts_at: result.booking.startsAt.toISOString(),
    },
  }).catch(() => {});

  return result;
}