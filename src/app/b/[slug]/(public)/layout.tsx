import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveBusinessBySlug, TenantError } from "@/lib/tenant";
import OfflineBanner from "@/components/OfflineBanner";

export default async function PublicSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  let business;
  try {
    business = await resolveBusinessBySlug(params.slug);
  } catch (err) {
    if (err instanceof TenantError && err.status === 404) notFound();
    throw err;
  }

  const base = `/b/${params.slug}`;
  const nav = [
    { href: base, label: "Home" },
    { href: `${base}/services`, label: "Services" },
    { href: `${base}/staff`, label: "Staff" },
    { href: `${base}/book`, label: "Book" },
    { href: `${base}/about`, label: "About" },
    { href: `${base}/contact`, label: "Contact" },
  ];

  const unavailable = business.status !== "ACTIVE";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <OfflineBanner />
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Link href={base} style={{ fontWeight: 600, fontSize: 17, textDecoration: "none" }}>
            {business.name}
          </Link>
          <nav style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {nav.map((n) => (
              <Link key={n.href} href={n.href} style={{ fontSize: 14, textDecoration: "none", color: "var(--ink-muted)" }}>
                {n.label}
              </Link>
            ))}
            <Link href={`${base}/track`} style={{ fontSize: 14, textDecoration: "none", color: "var(--ink-muted)" }}>
              Track booking
            </Link>
          </nav>
        </div>
      </header>

      {unavailable && (
        <div style={{ background: "var(--danger-bg)", color: "var(--danger)", textAlign: "center", padding: "10px 16px", fontSize: 14 }}>
          {business.status === "SUSPENDED"
            ? "This business is temporarily unavailable."
            : business.status === "PENDING"
              ? "This business's page is not yet published."
              : "This business is not currently accepting bookings."}
        </div>
      )}

      <main style={{ flex: 1, maxWidth: 1040, margin: "0 auto", padding: "40px 24px", width: "100%" }}>
        {children}
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--ink-muted)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 8 }}>
          <Link href={`${base}/about`} style={{ color: "inherit" }}>
            Privacy
          </Link>
          <Link href={`${base}/about`} style={{ color: "inherit" }}>
            Terms
          </Link>
          <Link href={`${base}/contact`} style={{ color: "inherit" }}>
            Contact
          </Link>
        </div>
        Powered by Zentro
      </footer>
    </div>
  );
}
