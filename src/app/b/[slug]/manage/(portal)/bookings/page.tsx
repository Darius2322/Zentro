import { getSession } from "@/lib/session";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { BookingActions, RecordPaymentButton } from "@/components/BookingActions";
import Link from "next/link";
import type { BookingStatus } from "@prisma/client";

const STATUS_FILTERS: (BookingStatus | "ALL")[] = ["ALL", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"];

const BADGE_CLASS: Record<BookingStatus, string> = {
  PENDING: "badge-warning",
  CONFIRMED: "badge-neutral",
  COMPLETED: "badge-success",
  CANCELLED: "badge-danger",
  NO_SHOW: "badge-danger",
};

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { status?: string };
}) {
  const session = await getSession();
  const business = await resolveBusinessBySlug(params.slug);
  const isOwner = session.role === "BUSINESS_OWNER" || session.role === "PLATFORM_ADMIN";

  const staffRecord = !isOwner
    ? await prisma.staff.findFirst({ where: { businessId: business.id, userId: session.userId } })
    : null;

  const statusFilter =
    searchParams.status && STATUS_FILTERS.includes(searchParams.status as any) && searchParams.status !== "ALL"
      ? (searchParams.status as BookingStatus)
      : undefined;

  const bookings = await prisma.booking.findMany({
    where: {
      businessId: business.id,
      status: statusFilter,
      staffId: staffRecord ? staffRecord.id : undefined,
    },
    include: { staff: { select: { fullName: true } }, customer: { select: { fullName: true, phone: true } }, payment: { select: { status: true } } },
    orderBy: { startsAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{isOwner ? "Bookings" : "My appointments"}</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {bookings.length} shown
          </p>
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={s === "ALL" ? `/b/${params.slug}/manage/bookings` : `/b/${params.slug}/manage/bookings?status=${s}`}
            className={`btn btn-small ${(!statusFilter && s === "ALL") || statusFilter === s ? "" : "btn-secondary"}`}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase().replace("_", "-")}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <div className="list">
          <div className="empty-state">No bookings match this filter.</div>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Service</th>
              <th>Customer</th>
              {isOwner && <th>Staff</th>}
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td>
                  {new Date(b.startsAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  {", "}
                  {new Date(b.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td>{b.serviceNameSnapshot}</td>
                <td>
                  {b.customer.fullName}
                  <div className="list-row-meta">{b.customer.phone}</div>
                </td>
                {isOwner && <td>{b.staff.fullName}</td>}
                <td>
                  <span className={`badge ${BADGE_CLASS[b.status]}`}>{b.status}</span>
                </td>
                <td>
                  <BookingActions slug={params.slug} bookingId={b.id} status={b.status} />
                  {isOwner && (
                    <div style={{ marginTop: 6 }}>
                      <RecordPaymentButton slug={params.slug} bookingId={b.id} currentStatus={b.payment?.status ?? "PENDING"} />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
