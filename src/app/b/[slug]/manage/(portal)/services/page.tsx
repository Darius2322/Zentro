import { getSession } from "@/lib/session";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { NewServiceForm, ArchiveServiceButton } from "@/components/ServiceControls";

export default async function ServicesPage({ params }: { params: { slug: string } }) {
  const session = await getSession();
  const business = await resolveBusinessBySlug(params.slug);
  const isOwner = session.role === "BUSINESS_OWNER" || session.role === "PLATFORM_ADMIN";

  const [services, staff] = await Promise.all([
    prisma.service.findMany({
      where: { businessId: business.id },
      include: { qualifiedStaff: { include: { staff: { select: { fullName: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.staff.findMany({ where: { businessId: business.id, isActive: true }, select: { id: true, fullName: true } }),
  ]);

  const currency = business.timezone === "Africa/Nairobi" ? "KSh" : "";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Services</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            What customers can book, and who can perform each one.
          </p>
        </div>
        {isOwner && <NewServiceForm slug={params.slug} staffOptions={staff.map((s) => ({ id: s.id, full_name: s.fullName }))} />}
      </div>

      {services.length === 0 ? (
        <div className="list">
          <div className="empty-state">Add your first service to start accepting bookings.</div>
        </div>
      ) : (
        <div className="list">
          {services.map((s) => (
            <div className="list-row" key={s.id}>
              <div className="list-row-main">
                <div className="list-row-title">{s.name}</div>
                <div className="list-row-meta">
                  {currency} {(s.priceCents / 100).toLocaleString()} · {s.durationMinutes} min
                  {s.bufferMinutes > 0 ? ` + ${s.bufferMinutes} min buffer` : ""}
                  {s.qualifiedStaff.length > 0
                    ? ` · ${s.qualifiedStaff.map((qs) => qs.staff.fullName).join(", ")}`
                    : " · No staff assigned yet"}
                </div>
              </div>
              {!s.isActive && <span className="badge badge-neutral">Archived</span>}
              {isOwner && s.isActive && <ArchiveServiceButton slug={params.slug} serviceId={s.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
