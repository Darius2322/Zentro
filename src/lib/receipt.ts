import type { Business, Receipt, Booking, Customer, Staff, Payment } from "@prisma/client";

type FullReceipt = Receipt & {
  booking: Booking & { customer: Customer; staff: Staff };
  payment: Payment | null;
};

export function serializeReceipt(receipt: FullReceipt, business: Business) {
  return {
    receipt_number: receipt.receiptNumber,
    issued_at: receipt.issuedAt.toISOString(),
    business: {
      name: business.name,
      address: business.address,
      phone: business.phone,
      email: business.email,
      logo_url: business.logoUrl,
    },
    customer_name: receipt.booking.customer.fullName,
    service_name: receipt.booking.serviceNameSnapshot,
    staff_name: receipt.booking.staff.fullName,
    starts_at: receipt.booking.startsAt.toISOString(),
    duration_minutes: receipt.booking.serviceDurationSnapshot,
    subtotal_cents: receipt.subtotalCents,
    discount_cents: receipt.discountCents,
    tax_cents: receipt.taxCents,
    total_cents: receipt.totalCents,
    currency: receipt.currency,
    payment_method: receipt.payment?.method ?? null,
    payment_status: receipt.payment?.status ?? "PENDING",
  };
}
