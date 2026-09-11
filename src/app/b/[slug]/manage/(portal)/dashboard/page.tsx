import { getSession } from "@/lib/session";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import Link from "next/link";

function startOfTodayUtc(timezone: string) {
  // Simple UTC-day boundary; business-timezone-accurate "today" is handled
  // by the availability engine elsewhere. Good enough for dashboard counts.
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage({ params }: { params: { slug: string } }) {
  const session = await getSession();
  const business = await resolveBusinessBySlug(params.slug);
  const isOwner = session.role === "BUSINESS_OWNER" || session.role === "PLATFORM_ADMIN";

  const todayStart = startOfTodayUtc(business.timezone);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const staffRecord =
    session.role === "STAFF"
      ? await prisma.staff.findFirst({ where: { businessId: business.id, userId: session.userId } })
      : null;

  const scopeFilter = staffRecord ? { staffId: staffRecord.id } : {};

  const [todayCount, upcomingCount, completedTodayCount, pendingCount, todaysBookings] =
    await Promise.all([
      prisma.booking.count({
        where: { businessId: business.id, ...scopeFilter, startsAt: { gte: todayStart, lt: todayEnd }, status: { notIn: ["CANCELLED"] } },
      }),
      prisma.booking.count({
        where: { businessId: business.id, ...scopeFilter, startsAt: { gte: todayEnd }, status: { in: ["PENDING", "CONFIRMED"] } },
      }),
      prisma.booking.count({
        where: { businessId: business.id, ...scopeFilter, startsAt: { gte: todayStart, lt: todayEnd }, status: "COMPLETED" },
      }),
      prisma.booking.count({
        where: { businessId: business.id, ...scopeFilter, status: "PENDING" },
      }),
      prisma.booking.findMany({
        where: { businessId: business.id, ...scopeFilter, startsAt: { gte: todayStart, lt: todayEnd }, status: { notIn: ["CANCELLED"] } },
        include: { staff: { select: { fullName: true } }, customer: { select: { fullName: true } } },
        orderBy: { startsAt: "asc" },
      }),
    ]);

  let revenueTodayCents: number | null = null;
  if (isOwner) {
    const paid = await prisma.payment.aggregate({
      where: {
        businessId: business.id,
        status: "PAID",
        booking: { startsAt: { gte: todayStart, lt: todayEnd } },
      },
      _sum: { amountCents: true },
    });
    revenueTodayCents = paid._sum.amountCents ?? 0;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{staffRecord ? "Your day" : "Dashboard"}</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            {business.name}
          </p>
        </div>
      </div>

      {isOwner && <OnboardingChecklist slug={params.slug} businessId={business.id} />}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-value">{todayCount}</div>
          <div className="stat-label">Today's appointments</div>
        </div>
        <div className="stat">
          <div className="stat-value">{upcomingCount}</div>
          <div className="stat-label">Upcoming bookings</div>
        </div>
        <div className="stat">
          <div className="stat-value">{completedTodayCount}</div>
          <div className="stat-label">Completed today</div>
        </div>
        <div className="stat">
          <div className="stat-value">{pendingCount}</div>
          <div className="stat-label">Pending confirmation</div>
        </div>
        {isOwner && revenueTodayCents !== null && (
          <div className="stat">
            <div className="stat-value">
              {business.timezone === "Africa/Nairobi" ? "KSh " : ""}
              {(revenueTodayCents / 100).toLocaleString()}
            </div>
            <div className="stat-label">Revenue today (paid)</div>
          </div>
        )}
      </div>

      <h2>Today's schedule</h2>
      <div className="list">
        {todaysBookings.length === 0 ? (
          <div className="empty-state">No appointments scheduled for today.</div>
        ) : (
          todaysBookings.map((b) => (
            <div className="list-row" key={b.id}>
              <div className="list-row-main">
                <div className="list-row-title">
                  {new Date(b.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {" — "}
                  {b.serviceNameSnapshot}
                </div>
                <div className="list-row-meta">
                  {b.customer.fullName} · {b.staff.fullName}
                </div>
              </div>
              <span
                className={`badge ${
                  b.status === "COMPLETED"
                    ? "badge-success"
                    : b.status === "CONFIRMED"
                      ? "badge-neutral"
                      : "badge-warning"
                }`}
              >
                {b.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

async function OnboardingChecklist({ slug, businessId }: { slug: string; businessId: string }) {
  const [serviceCount, staffCount, hoursCount] = await Promise.all([
    prisma.service.count({ where: { businessId, isActive: true } }),
    prisma.staff.count({ where: { businessId, isActive: true } }),
    prisma.businessHours.count({ where: { businessId, isClosed: false } }),
  ]);

  const steps = [
    { done: serviceCount > 0, label: "Add a service", href: `/b/${slug}/manage/services` },
    { done: staffCount > 0, label: "Add a staff member", href: `/b/${slug}/manage/staff` },
    { done: hoursCount > 0, label: "Set opening hours", href: `/b/${slug}/manage/settings` },
  ];

  if (steps.every((s) => s.done)) return null;

  return (
    <div className="card" style={{ marginBottom: 24, borderColor: "var(--accent)" }}>
      <h2 style={{ marginBottom: 4 }}>Finish setting up</h2>
      <p className="page-subtitle" style={{ marginBottom: 12 }}>
        Complete these steps before your booking page can accept appointments.
      </p>
      <div className="btn-row">
        {steps.map((s) => (
          <Link key={s.label} href={s.href} className={`btn btn-small ${s.done ? "btn-secondary" : ""}`}>
            {s.done ? "✓ " : ""}
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
