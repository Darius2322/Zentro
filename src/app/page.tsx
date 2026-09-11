export default function Home() {
  return (
    <main style={{ fontFamily: "var(--font)", padding: "4rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>Zentro</h1>
      <p className="page-subtitle">
        Appointment booking and business management for salons, barbershops, and
        beauty studios.
      </p>
      <div className="btn-row">
        <a className="btn" href="/register">
          List your business
        </a>
        <a className="btn btn-secondary" href="/admin/login">
          Platform admin
        </a>
      </div>
      <p className="field-hint" style={{ marginTop: 32 }}>
        The public customer-facing booking site (services, staff, calendar, and
        checkout) is built in the next stage — see README.md for what's live so
        far and what's next.
      </p>
    </main>
  );
}
