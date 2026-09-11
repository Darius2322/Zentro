import { getSession } from "@/lib/session";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { HoursForm } from "@/components/HoursForm";
import { GoogleCalendarSection } from "@/components/GoogleCalendarSection";

export default async function SettingsPage({ params }: { params: { slug: string } }) {
  const session = await getSession();
  const business = await resolveBusinessBySlug(params.slug);
  const isOwner = session.role === "BUSINESS_OWNER" || session.role === "PLATFORM_ADMIN";

  if (!isOwner) {
    return (
      <div>
        <h1>Settings</h1>
        <p className="page-subtitle">Only the business owner can change settings.</p>
      </div>
    );
  }

  const hours = await prisma.businessHours.findMany({ where: { businessId: business.id } });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Opening hours &amp; booking rules</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            These directly control what the availability engine will offer customers.
          </p>
        </div>
      </div>

      <HoursForm
        slug={params.slug}
        initialHours={hours.map((h) => ({
          weekday: h.weekday,
          is_closed: h.isClosed,
          start_time: h.startTime ?? "09:00",
          end_time: h.endTime ?? "17:00",
        }))}
        initialInterval={business.bookingIntervalMinutes}
        initialMinNotice={business.minNoticeMinutes}
        initialMaxAdvance={business.maxAdvanceBookingDays}
      />

      <div style={{ marginTop: 32 }}>
        <GoogleCalendarSection slug={params.slug} />
      </div>
    </div>
  );
}
