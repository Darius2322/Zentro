import Link from "next/link";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export default async function PublicStaffPage({ params }: { params: { slug: string } }) {
  const business = await resolveBusinessBySlug(params.slug);
  const base = `/b/${params.slug}`;

  const staff = await prisma.staff.findMany({
    where: { businessId: business.id, isActive: true },
    include: { qualifiedServices: { include: { service: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1>Our team</h1>
      <p className="page-subtitle">Meet the people you'll be booking with.</p>

      {staff.length === 0 ? (
        <div className="list">
          <div className="empty-state">Staff information isn't available yet.</div>
        </div>
      ) : (
        <div className="list">
          {staff.map((s) => (
            <div className="list-row" key={s.id}>
              <div className="list-row-main">
                <div className="list-row-title">
                  {s.fullName}
                  {s.title ? ` — ${s.title}` : ""}
                </div>
                <div className="list-row-meta">
                  {s.qualifiedServices.filter((qs) => qs.service.isActive).map((qs) => qs.service.name).join(", ") ||
                    "No services listed yet"}
                </div>
              </div>
              <Link className="btn btn-small btn-secondary" href={`${base}/book?staff=${s.id}`}>
                Book with {s.fullName.split(" ")[0]}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
