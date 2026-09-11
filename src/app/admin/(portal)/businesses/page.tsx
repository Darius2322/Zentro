import Link from "next/link";
import { prisma } from "@/lib/db";
import { BusinessApprovalActions } from "@/components/BusinessApprovalActions";
import type { BusinessStatus } from "@prisma/client";

const STATUSES: (BusinessStatus | "ALL")[] = ["ALL", "PENDING", "ACTIVE", "SUSPENDED", "REJECTED"];

const BADGE_CLASS: Record<BusinessStatus, string> = {
  PENDING: "badge-warning",
  ACTIVE: "badge-success",
  SUSPENDED: "badge-danger",
  REJECTED: "badge-neutral",
};

export default async function AdminBusinessesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const filterStatus =
    searchParams.status && STATUSES.includes(searchParams.status as any) && searchParams.status !== "ALL"
      ? (searchParams.status as BusinessStatus)
      : undefined;

  const [businesses, counts] = await Promise.all([
    prisma.business.findMany({
      where: filterStatus ? { status: filterStatus } : undefined,
      include: { owner: { select: { fullName: true, email: true } } },
      orderBy: { submittedAt: "desc" },
      take: 100,
    }),
    prisma.business.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countMap: Record<string, number> = { PENDING: 0, ACTIVE: 0, SUSPENDED: 0, REJECTED: 0 };
  for (const c of counts) countMap[c.status] = c._count._all;
  const total = Object.values(countMap).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Businesses</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Every business that has applied to join Zentro.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-value">{total}</div>
          <div className="stat-label">Total businesses</div>
        </div>
        <div className="stat">
          <div className="stat-value">{countMap.PENDING}</div>
          <div className="stat-label">Pending review</div>
        </div>
        <div className="stat">
          <div className="stat-value">{countMap.ACTIVE}</div>
          <div className="stat-label">Active</div>
        </div>
        <div className="stat">
          <div className="stat-value">{countMap.SUSPENDED}</div>
          <div className="stat-label">Suspended</div>
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "ALL" ? "/admin/businesses" : `/admin/businesses?status=${s}`}
            className={`btn btn-small ${(!filterStatus && s === "ALL") || filterStatus === s ? "" : "btn-secondary"}`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      {businesses.length === 0 ? (
        <div className="list">
          <div className="empty-state">No businesses match this filter.</div>
        </div>
      ) : (
        <div className="list">
          {businesses.map((b) => (
            <div className="list-row" key={b.id}>
              <div className="list-row-main">
                <div className="list-row-title">{b.name}</div>
                <div className="list-row-meta">
                  {b.owner.fullName} · {b.owner.email} · Applied{" "}
                  {new Date(b.submittedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <span className={`badge ${BADGE_CLASS[b.status]}`}>{b.status}</span>
              <BusinessApprovalActions businessId={b.id} status={b.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
