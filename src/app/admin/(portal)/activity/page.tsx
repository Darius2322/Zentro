import { prisma } from "@/lib/db";

export default async function AdminActivityPage() {
  const logs = await prisma.auditLog.findMany({
    include: { actor: { select: { fullName: true } }, business: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <h1>Platform activity</h1>
      <p className="page-subtitle">Every significant action across all businesses.</p>

      {logs.length === 0 ? (
        <div className="list"><div className="empty-state">No activity recorded yet.</div></div>
      ) : (
        <div className="list">
          {logs.map((l) => (
            <div className="list-row" key={l.id}>
              <div className="list-row-main">
                <div className="list-row-title">{l.action.replace(/\./g, " → ").replace(/_/g, " ")}</div>
                <div className="list-row-meta">
                  {l.business ? `${l.business.name} · ` : ""}
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
