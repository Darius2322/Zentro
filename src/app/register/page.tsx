"use client";

import { useState } from "react";

export default function RegisterBusinessPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessName: "",
    slug: "",
    ownerFullName: "",
    ownerEmail: "",
    ownerPassword: "",
    phone: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/businesses/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_name: form.businessName,
          slug: form.slug,
          owner_full_name: form.ownerFullName,
          owner_email: form.ownerEmail,
          owner_password: form.ownerPassword,
          phone: form.phone || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Registration failed.");
      setDone(body.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 440 }}>
        <h1 style={{ fontSize: 20 }}>List your business on Zentro</h1>
        <p className="page-subtitle">
          Your application will be reviewed before your booking page goes live.
        </p>

        {done ? (
          <p className="error-banner" style={{ background: "var(--success-bg)", color: "var(--accent)" }}>
            {done}
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <p className="error-banner">{error}</p>}
            <div className="field">
              <label htmlFor="bname">Business name</label>
              <input
                id="bname"
                type="text"
                required
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="slug">Business URL</label>
              <input
                id="slug"
                type="text"
                required
                pattern="[a-z0-9-]+"
                placeholder="glow-beauty"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
              />
              <p className="field-hint">zentro.app/b/{form.slug || "your-business"}</p>
            </div>
            <div className="field">
              <label htmlFor="oname">Your full name</label>
              <input
                id="oname"
                type="text"
                required
                value={form.ownerFullName}
                onChange={(e) => setForm({ ...form, ownerFullName: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="oemail">Your email</label>
              <input
                id="oemail"
                type="email"
                required
                value={form.ownerEmail}
                onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="ophone">Phone</label>
              <input
                id="ophone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="opassword">Password</label>
              <input
                id="opassword"
                type="password"
                required
                minLength={10}
                value={form.ownerPassword}
                onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
              />
            </div>
            <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
              {submitting ? "Submitting…" : "Submit application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
