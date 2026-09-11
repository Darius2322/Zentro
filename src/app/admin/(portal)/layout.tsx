import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import SignOutButton from "@/components/SignOutButton";

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (session.role !== "PLATFORM_ADMIN") {
    redirect("/admin/login");
  }

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <div className="app-nav-brand">
          Zentro Admin
          <span className="app-nav-business">{session.fullName}</span>
        </div>
        <Link href="/admin/businesses">Businesses</Link>
        <Link href="/admin/activity">Activity</Link>
        <Link href="/admin/security">Security</Link>
        <div style={{ marginTop: "auto", paddingTop: 16 }}>
          <SignOutButton redirectTo="/admin/login" />
        </div>
      </nav>
      <main className="app-main">{children}</main>
    </div>
  );
}
