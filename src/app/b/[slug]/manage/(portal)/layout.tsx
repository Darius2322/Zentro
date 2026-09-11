import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { resolveBusinessBySlug } from "@/lib/tenant";
import SignOutButton from "@/components/SignOutButton";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const session = await getSession();
  const business = await resolveBusinessBySlug(params.slug).catch(() => null);

  if (!business) redirect("/");

  // The same tenant check used by every API route: a session for a
  // different business, or no session at all, is sent to this business's
  // own login page — never shown this portal's data (spec #57).
  const isMember =
    session.userId &&
    (session.role === "PLATFORM_ADMIN" || session.businessId === business.id);

  if (!isMember) {
    redirect(`/b/${params.slug}/manage/login`);
  }

  const isOwner = session.role === "BUSINESS_OWNER" || session.role === "PLATFORM_ADMIN";

  const ownerLinks = [
    { href: `/b/${params.slug}/manage/dashboard`, label: "Dashboard" },
    { href: `/b/${params.slug}/manage/bookings`, label: "Bookings" },
    { href: `/b/${params.slug}/manage/services`, label: "Services" },
    { href: `/b/${params.slug}/manage/resources`, label: "Resources" },
    { href: `/b/${params.slug}/manage/staff`, label: "Staff" },
    { href: `/b/${params.slug}/manage/customers`, label: "Customers" },
    { href: `/b/${params.slug}/manage/receipts`, label: "Receipts" },
    { href: `/b/${params.slug}/manage/settings`, label: "Settings" },
    { href: `/b/${params.slug}/manage/activity`, label: "Activity" },
  ];
  const staffLinks = [
    { href: `/b/${params.slug}/manage/dashboard`, label: "Dashboard" },
    { href: `/b/${params.slug}/manage/bookings`, label: "My appointments" },
  ];

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-brand">
          {business.name}
          <span className="app-nav-business">{session.fullName}</span>
        </div>
        {(isOwner ? ownerLinks : staffLinks).map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <SignOutButton redirectTo={`/b/${params.slug}/manage/login`} />
        </div>
      </nav>
      <main className="app-main">{children}</main>
    </div>
  );
}
