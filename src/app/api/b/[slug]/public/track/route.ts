import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveBusinessBySlug, TenantError } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { transitionBooking, BookingTransitionError } from "@/lib/bookingTransitions";

function serializeBooking(b: any) {
  return {
    booking_reference: b.bookingReference,
    service_name: b.serviceNameSnapshot,
    staff_name: b.staff.fullName,
    starts_at: b.startsAt.toISOString(),
    ends_at: b.endsAt.toISOString(),
    status: b.status,
    payment_status: b.payment?.status ?? null,
  };
}

async function findMatchingBooking(businessId: string, reference: string, phone: string) {
  return prisma.booking.findFirst({
    where: {
      businessId,
      bookingReference: reference.trim().toUpperCase(),
      customer: { phone: phone.trim() },
    },
    include: { staff: { select: { fullName: true } }, payment: { select: { status: true } } },
  });
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const business = await resolveBusinessBySlug(params.slug);
    const reference = req.nextUrl.searchParams.get("reference");
    const phone = req.nextUrl.searchParams.get("phone");
    if (!reference || !phone) {
      return NextResponse.json({ error: "Booking reference and phone number are required." }, { status: 400 });
    }

    const booking = await findMatchingBooking(business.id, reference, phone);
    if (!booking) {
      // Identical response whether the reference doesn't exist or the phone
      // doesn't match it — no information leaked either way.
      return NextResponse.json(
        { error: "We couldn't find a booking with that reference and phone number." },
        { status: 404 }
      );
    }

    return NextResponse.json({ booking: serializeBooking(booking) });
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("booking tracking lookup failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

const cancelSchema = z.object({
  reference: z.string().min(1),
  phone: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const business = await resolveBusinessBySlug(params.slug);
    const parsed = cancelSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const booking = await findMatchingBooking(business.id, parsed.data.reference, parsed.data.phone);
    if (!booking) {
      return NextResponse.json(
        { error: "We couldn't find a booking with that reference and phone number." },
        { status: 404 }
      );
    }

    if (new Date(booking.startsAt) < new Date()) {
      return NextResponse.json({ error: "This appointment has already passed." }, { status: 409 });
    }

    const updated = await transitionBooking(business.id, booking.id, "cancel", null, "CUSTOMER", "Cancelled by customer");
    return NextResponse.json({ booking: serializeBooking({ ...updated, staff: booking.staff, payment: booking.payment }) });
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof BookingTransitionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("booking cancellation failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
