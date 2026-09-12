import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { createBooking, BookingConflictError } from "@/lib/booking";
import { AvailabilityError } from "@/lib/availability";
import type { BookingStatus } from "@prisma/client";

const VALID_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { session, business } = await requireBusinessMember(params.slug, [
      "BUSINESS_OWNER",
      "STAFF",
      "PLATFORM_ADMIN",
    ]);

    const sp = req.nextUrl.searchParams;
    const statusParam = sp.get("status");
    const status = statusParam && VALID_STATUSES.includes(statusParam as BookingStatus) ? statusParam : undefined;
    const dateFrom = sp.get("date_from");
    const dateTo = sp.get("date_to");
    const serviceId = sp.get("service_id") ?? undefined;
    let staffId = sp.get("staff_id") ?? undefined;

    // Staff can only ever see their own appointments (spec #42), regardless
    // of any staff_id filter they pass — the value from the query string is
    // overridden, never trusted, once we know the caller's role is STAFF.
    if (session.role === "STAFF") {
      const staffRecord = await prisma.staff.findFirst({
        where: { businessId: business.id, userId: session.userId },
      });
      staffId = staffRecord?.id ?? "__none__";
    }

    const bookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        status: status as BookingStatus | undefined,
        staffId,
        serviceId,
        startsAt: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(dateTo + "T23:59:59.999Z") : undefined,
        },
      },
      include: {
        staff: { select: { id: true, fullName: true } },
        customer: { select: { id: true, fullName: true, phone: true } },
        payment: { select: { status: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 200,
    });

    return NextResponse.json({ bookings });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const createSchema = z.object({
  service_id: z.string().min(1),
  staff_id: z.string().optional(), // omit = "any available staff"
  starts_at: z.string().datetime(),
  customer: z.object({
    full_name: z.string().min(1).max(200),
    phone: z.string().min(6).max(32),
    email: z.string().email().optional(),
    notes: z.string().max(1000).optional(),
  }),
});

/**
 * Manual booking creation from the owner/staff portal (spec #40). This is
 * NOT a shortcut around the availability engine — it calls the exact same
 * createBooking() the public customer flow uses, so a manually created
 * appointment is just as impossible to double-book as a customer one
 * (spec #40: "Any manually created appointment must still go through
 * availability validation.").
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { session, business } = await requireBusinessMember(params.slug, [
      "BUSINESS_OWNER",
      "STAFF",
    ]);

    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid booking details." }, { status: 400 });
    }
    const d = parsed.data;

    const { booking, receipt } = await createBooking({
      businessId: business.id,
      serviceId: d.service_id,
      staffId: d.staff_id,
      startsAt: d.starts_at,
      customer: {
        fullName: d.customer.full_name,
        phone: d.customer.phone,
        email: d.customer.email,
        notes: d.customer.notes,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorId: session.userId,
        actorRole: session.role,
        action: "booking.created_manually",
        targetType: "Booking",
        targetId: booking.id,
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
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
