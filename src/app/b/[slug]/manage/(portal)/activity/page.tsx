import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export default async function ActivityPage({ params }: { params: { slug: string } }) {
  const business = await resolveBusinessBySlug(params.slug);

  const logs = await prisma.auditLog.findMany({
    where: { businessId: business.id },
    include: { actor: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  return (
    <div>
      <h1>Activity</h1>
      <p className="page-subtitle">A record of important actions taken on your business.</p>

      {logs.length === 0 ? (
        <div className="list"><div className="empty-state">No activity recorded yet.</div></div>
      ) : (
        <div className="list">
          {logs.map((l) => (
            <div className="list-row" key={l.id}>
              <div className="list-row-main">
                <div className="list-row-title">{humanizeAction(l.action)}</div>
                <div className="list-row-meta">
                  {l.actor?.fullName ?? (l.actorRole ? l.actorRole.replace("_", " ").toLowerCase() : "System")} ·{" "}
                  {new Date(l.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function humanizeAction(action: string) {
  return action.replace(/\./g, " → ").replace(/_/g, " ");
}
