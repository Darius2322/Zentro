import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createBooking, BookingConflictError } from "@/lib/booking";
import { AvailabilityError } from "@/lib/availability";

const bodySchema = z.object({
  business_id: z.string().min(1),
  service_id: z.string().min(1),
  staff_id: z.string().optional(),
  starts_at: z.string().datetime(),
  customer: z.object({
    full_name: z.string().min(1).max(200),
    phone: z.string().min(6).max(32),
    email: z.string().email().optional(),
    notes: z.string().max(1000).optional(),
  }),
});

// NOTE: This route intentionally accepts unauthenticated public requests
// (guest booking, spec #10/#38), but is still rate-limited (see
// src/lib/rateLimit.ts, wired in via middleware.ts) to blunt booking-spam
// and slot-scraping abuse. It performs NO trust-based shortcuts: every
// field is re-validated against the database inside createBooking().
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid booking request." }, { status: 400 });
  }
  const body = parsed.data;

  try {
    const { booking, receipt } = await createBooking({
      businessId: body.business_id,
      serviceId: body.service_id,
      staffId: body.staff_id,
      startsAt: body.starts_at,
      customer: {
        fullName: body.customer.full_name,
        phone: body.customer.phone,
        email: body.customer.email,
        notes: body.customer.notes,
      },
    });

    return NextResponse.json(
      {
        booking_reference: booking.bookingReference,
        starts_at: booking.startsAt.toISOString(),
        ends_at: booking.endsAt.toISOString(),
        status: booking.status,
        receipt_number: receipt.receiptNumber,
      },
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof BookingConflictError) {
      return NextResponse.json({ error: err.message, code: "SLOT_TAKEN" }, { status: 409 });
    }
    if (err instanceof AvailabilityError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("booking creation failed", err);
    return NextResponse.json(
      { error: "We couldn't complete your booking. Please try again." },
      { status: 500 }
    );
  }
}
