import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function ContactPage({ params }: { params: { slug: string } }) {
  const business = await resolveBusinessBySlug(params.slug);
  const hours = await prisma.businessHours.findMany({ where: { businessId: business.id }, orderBy: { weekday: "asc" } });

  return (
    <div>
      <h1>Contact</h1>

      <div className="card" style={{ maxWidth: 420, marginBottom: 28 }}>
        {business.phone && <p style={{ margin: "0 0 8px" }}>Phone: {business.phone}</p>}
        {business.whatsapp && <p style={{ margin: "0 0 8px" }}>WhatsApp: {business.whatsapp}</p>}
        {business.email && <p style={{ margin: "0 0 8px" }}>Email: {business.email}</p>}
        {business.address && <p style={{ margin: 0 }}>{business.address}</p>}
        {!business.phone && !business.whatsapp && !business.email && !business.address && (
          <p className="page-subtitle" style={{ margin: 0 }}>Contact details haven't been added yet.</p>
        )}
      </div>

      <h2>Opening hours</h2>
      <div className="list" style={{ maxWidth: 420 }}>
        {WEEKDAYS.map((label, weekday) => {
          const day = hours.find((h) => h.weekday === weekday);
          return (
            <div className="list-row" key={weekday}>
              <div className="list-row-main">{label}</div>
              <div className="list-row-meta">
                {!day || day.isClosed ? "Closed" : `${day.startTime} – ${day.endTime}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
