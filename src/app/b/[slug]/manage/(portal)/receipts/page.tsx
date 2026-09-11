import Link from "next/link";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export default async function ReceiptsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { q?: string };
}) {
  const business = await resolveBusinessBySlug(params.slug);
  const q = searchParams.q?.trim();

  const receipts = await prisma.receipt.findMany({
    where: {
      businessId: business.id,
      ...(q
        ? {
            OR: [
              { receiptNumber: { contains: q, mode: "insensitive" } },
              { booking: { customer: { fullName: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: { booking: { include: { customer: true } }, payment: true },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Receipts</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {receipts.length} receipts
          </p>
        </div>
      </div>

      <form method="get" className="field" style={{ maxWidth: 320, marginBottom: 20 }}>
        <input type="text" name="q" defaultValue={q} placeholder="Search by receipt # or customer" />
      </form>

      {receipts.length === 0 ? (
        <div className="list"><div className="empty-state">No receipts yet.</div></div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Receipt #</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => (
              <tr key={r.id}>
                <td style={{ fontFamily: "monospace" }}>{r.receiptNumber}</td>
                <td>{r.booking.customer.fullName}</td>
                <td>{r.booking.serviceNameSnapshot}</td>
                <td>{r.currency} {(r.totalCents / 100).toLocaleString()}</td>
                <td>
                  <span className={`badge ${r.payment?.status === "PAID" ? "badge-success" : "badge-neutral"}`}>
                    {r.payment?.status ?? "PENDING"}
                  </span>
                </td>
                <td>{new Date(r.issuedAt).toLocaleDateString()}</td>
                <td>
                  <Link className="btn btn-small btn-secondary" href={`/b/${params.slug}/manage/receipts/${r.receiptNumber}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
