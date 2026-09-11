import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export default async function CustomersPage({ params }: { params: { slug: string } }) {
  const business = await resolveBusinessBySlug(params.slug);

  const customers = await prisma.customer.findMany({
    where: { businessId: business.id },
    include: {
      bookings: { orderBy: { startsAt: "desc" }, take: 1, select: { startsAt: true } },
      _count: { select: { bookings: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {customers.length} customers on file
          </p>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="list">
          <div className="empty-state">No customers yet — they'll appear here after their first booking.</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Total appointments</th>
              <th>Last appointment</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.fullName}</td>
                <td>{c.phone}</td>
                <td>{c._count.bookings}</td>
                <td>
                  {c.bookings[0]
                    ? new Date(c.bookings[0].startsAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
