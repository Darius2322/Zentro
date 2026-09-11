import { Suspense } from "react";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { BookingWizard } from "@/components/BookingWizard";

export default async function BookPage({ params }: { params: { slug: string } }) {
  const business = await resolveBusinessBySlug(params.slug);

  if (business.status !== "ACTIVE") {
    return (
      <div>
        <h1>Booking unavailable</h1>
        <p className="page-subtitle">This business is not currently accepting bookings.</p>
      </div>
    );
  }

  const currency = business.timezone === "Africa/Nairobi" ? "KSh" : "";

  return (
    <Suspense fallback={<p className="page-subtitle">Loading…</p>}>
      <BookingWizard slug={params.slug} businessId={business.id} currency={currency} />
    </Suspense>
  );
}
