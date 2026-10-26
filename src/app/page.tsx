import Link from "next/link";
import FindSalon from "@/components/FindSalon";

const STEPS = [
  {
    n: "01",
    title: "Set up your salon",
    body: "Add your services, your team and their working hours, and the chairs or tables each service needs.",
  },
  {
    n: "02",
    title: "Share your booking page",
    body: "You get your own web address. Clients choose a service, a stylist and a time from their phone, with no account to create.",
  },
  {
    n: "03",
    title: "Run the day from one screen",
    body: "See who is booked, confirm or reschedule, mark payments and print receipts for the till or the thermal printer.",
  },
];

const FEATURES = [
  {
    title: "Only real times are shown",
    body: "Clients never see a slot that will not work. Every time accounts for opening hours, lunch breaks, leave, existing bookings, and whether a chair is free.",
  },
  {
    title: "No double bookings",
    body: "If two people tap the same time together, one gets it and the other is asked to pick again. The database itself enforces this, not just the app.",
  },
  {
    title: "Your team, your rules",
    body: "Each stylist has their own hours and services. Clients can pick a favourite or choose anyone available.",
  },
  {
    title: "Chairs and equipment tracked",
    body: "A manicure needs a table as well as a technician. Mark a station as under maintenance and it stops being booked.",
  },
  {
    title: "Receipts that print properly",
    body: "A clean full-page receipt, and a separate narrow layout designed for thermal receipt printers.",
  },
  {
    title: "Works on any phone",
    body: "Clients and staff use it straight from the browser, and it can be installed on the home screen.",
  },
];

const wrap: React.CSSProperties = { maxWidth: 1040, margin: "0 auto", padding: "0 24px" };

export default function Home() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div
          style={{
            ...wrap,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Link href="/" style={{ fontWeight: 600, fontSize: 19, textDecoration: "none", letterSpacing: "-0.01em" }}>
            Zentro
          </Link>
          <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <a href="#book" style={{ fontSize: 14, color: "var(--ink-muted)", textDecoration: "none" }}>
              Book an appointment
            </a>
            <Link className="btn btn-small" href="/register">
              List your business
            </Link>
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero */}
        <section style={{ ...wrap, padding: "72px 24px 64px" }}>
          <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 500, color: "var(--accent)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Booking for salons, barbershops and beauty studios
          </p>
          <h1
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              lineHeight: 1.08,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: "0 0 20px",
              maxWidth: 720,
            }}
          >
            Fewer phone calls. Fewer no-shows. A diary that fills itself.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, color: "var(--ink-muted)", margin: "0 0 32px", maxWidth: 560 }}>
            Zentro gives your business its own booking page. Clients pick a service, a stylist and a time that is genuinely
            free, and you see it on your schedule straight away.
          </p>
          <div className="btn-row">
            <Link className="btn" href="/register" style={{ padding: "12px 22px", fontSize: 16 }}>
              List your business
            </Link>
            <a className="btn btn-secondary" href="#how" style={{ padding: "12px 22px", fontSize: 16, textDecoration: "none" }}>
              See how it works
            </a>
          </div>
        </section>

        {/* How it works */}
        <section id="how" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{ ...wrap, padding: "64px 24px" }}>
            <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 32px" }}>How it works</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 32 }}>
              {STEPS.map((s) => (
                <div key={s.n} style={{ borderTop: "2px solid var(--ink)", paddingTop: 16 }}>
                  <div style={{ fontSize: 13, color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums", marginBottom: 8 }}>{s.n}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>{s.title}</h3>
                  <p style={{ margin: 0, color: "var(--ink-muted)", lineHeight: 1.6 }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ borderTop: "1px solid var(--border)" }}>
          <div style={{ ...wrap, padding: "64px 24px" }}>
            <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 8px" }}>Built for how salons really work</h2>
            <p style={{ color: "var(--ink-muted)", margin: "0 0 32px", maxWidth: 560 }}>
              The hard part of booking software is knowing what is actually free. That is the part we spent the most time on.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 0, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", background: "var(--surface)" }}>
              {FEATURES.map((f) => (
                <div key={f.title} style={{ padding: 24, borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", marginRight: -1, marginBottom: -1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>{f.title}</h3>
                  <p style={{ margin: 0, color: "var(--ink-muted)", lineHeight: 1.6, fontSize: 15 }}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* For clients */}
        <section id="book" style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
          <div style={{ ...wrap, padding: "64px 24px" }}>
            <div style={{ maxWidth: 520 }}>
              <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 8px" }}>Booking an appointment?</h2>
              <p style={{ color: "var(--ink-muted)", margin: "0 0 24px", lineHeight: 1.6 }}>
                Your salon or barbershop will have shared its booking address with you. Enter the name from that address below.
              </p>
              <FindSalon />
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ borderTop: "1px solid var(--border)" }}>
          <div style={{ ...wrap, padding: "64px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
            <div style={{ maxWidth: 520 }}>
              <h2 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em", margin: "0 0 8px" }}>Ready to take bookings online?</h2>
              <p style={{ color: "var(--ink-muted)", margin: 0, lineHeight: 1.6 }}>
                Apply in a couple of minutes. We review every application, then your booking page goes live.
              </p>
            </div>
            <Link className="btn" href="/register" style={{ padding: "12px 22px", fontSize: 16 }}>
              List your business
            </Link>
          </div>
        </section>
      </main>

      <footer style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ ...wrap, padding: "24px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, fontSize: 13, color: "var(--ink-muted)" }}>
          <span>Zentro</span>
          <span>Appointment booking for beauty and grooming businesses</span>
        </div>
      </footer>
    </div>
  );
}
