import Link from "next/link";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export default async function PublicServicesPage({ params }: { params: { slug: string } }) {
  const business = await resolveBusinessBySlug(params.slug);
  const base = `/b/${params.slug}`;
  const currency = business.timezone === "Africa/Nairobi" ? "KSh" : "";

  const services = await prisma.service.findMany({
    where: { businessId: business.id, isActive: true },
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1>Services</h1>
      <p className="page-subtitle">Everything you can book at {business.name}.</p>

      {services.length === 0 ? (
        <div className="list">
          <div className="empty-state">No services are available to book right now.</div>
        </div>
      ) : (
        <div className="list">
          {services.map((s) => (
            <div className="list-row" key={s.id}>
              <div className="list-row-main">
                <div className="list-row-title">{s.name}</div>
                <div className="list-row-meta">
                  {s.durationMinutes} min · {currency} {(s.priceCents / 100).toLocaleString()}
                  {s.description ? ` · ${s.description}` : ""}
                </div>
              </div>
              <Link className="btn btn-small" href={`${base}/book?service=${s.id}`}>
                Book
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
