import Link from "next/link";
import { getSession } from "@/lib/session";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { InviteStaffForm, ToggleStaffActiveButton } from "@/components/StaffControls";

export default async function StaffPage({ params }: { params: { slug: string } }) {
  const session = await getSession();
  const business = await resolveBusinessBySlug(params.slug);
  const isOwner = session.role === "BUSINESS_OWNER" || session.role === "PLATFORM_ADMIN";

  if (!isOwner) {
    return (
      <div>
        <h1>Staff</h1>
        <p className="page-subtitle">Only the business owner can manage staff.</p>
      </div>
    );
  }

  const staff = await prisma.staff.findMany({
    where: { businessId: business.id },
    include: { user: { select: { id: true } }, qualifiedServices: { include: { service: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Staff</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Everyone who works at {business.name}.
          </p>
        </div>
        <InviteStaffForm slug={params.slug} />
      </div>

      {staff.length === 0 ? (
        <div className="list">
          <div className="empty-state">No staff members have been added yet.</div>
        </div>
      ) : (
        <div className="list">
          {staff.map((s) => (
            <div className="list-row" key={s.id}>
              <div className="list-row-main">
                <div className="list-row-title">
                  <Link href={`/b/${params.slug}/manage/staff/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                    {s.fullName}
                    {s.title ? ` — ${s.title}` : ""}
                  </Link>
                </div>
                <div className="list-row-meta">
                  {s.email}
                  {s.qualifiedServices.length > 0
                    ? ` · ${s.qualifiedServices.map((qs) => qs.service.name).join(", ")}`
                    : ""}
                </div>
              </div>
              {!s.user && <span className="badge badge-warning">Invitation pending</span>}
              {!s.isActive && <span className="badge badge-neutral">Inactive</span>}
              <ToggleStaffActiveButton slug={params.slug} staffId={s.id} isActive={s.isActive} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
