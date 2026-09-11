import Link from "next/link";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export default async function PublicHomePage({ params }: { params: { slug: string } }) {
  const business = await resolveBusinessBySlug(params.slug);
  const base = `/b/${params.slug}`;

  const [services, staffCount] = await Promise.all([
    prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
      orderBy: { createdAt: "asc" },
      take: 3,
    }),
    prisma.staff.count({ where: { businessId: business.id, isActive: true } }),
  ]);

  const currency = business.timezone === "Africa/Nairobi" ? "KSh" : "";

  return (
    <div>
      <section style={{ padding: "48px 0 56px", maxWidth: 560 }}>
        <h1 style={{ fontSize: 40, lineHeight: 1.15, margin: "0 0 16px", fontWeight: 600 }}>
          Book your next appointment.
        </h1>
        <p style={{ fontSize: 17, color: "var(--ink-muted)", marginBottom: 28 }}>
          Choose a service, find a time that works, and book in minutes.
        </p>
        <div className="btn-row">
          <Link className="btn" href={`${base}/book`}>
            Book an appointment
          </Link>
          <Link className="btn btn-secondary" href={`${base}/services`}>
            View services
          </Link>
        </div>
      </section>

      {business.description && (
        <section style={{ marginBottom: 48, maxWidth: 640 }}>
          <p style={{ fontSize: 15, color: "var(--ink-muted)" }}>{business.description}</p>
        </section>
      )}

      {services.length > 0 && (
        <section style={{ marginBottom: 40 }}>
          <h2>Popular services</h2>
          <div className="list">
            {services.map((s) => (
              <div className="list-row" key={s.id}>
                <div className="list-row-main">
                  <div className="list-row-title">{s.name}</div>
                  <div className="list-row-meta">
                    {s.durationMinutes} min · {currency} {(s.priceCents / 100).toLocaleString()}
                  </div>
                </div>
                <Link className="btn btn-small btn-secondary" href={`${base}/book?service=${s.id}`}>
                  Book
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {staffCount > 0 && (
        <p className="page-subtitle">
          <Link href={`${base}/staff`}>Meet our {staffCount === 1 ? "stylist" : `${staffCount} staff members`}</Link>
        </p>
      )}
    </div>
  );
}
