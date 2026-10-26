"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function RegisterBusinessPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ message: string; slug: string } | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    businessName: "",
    slug: "",
    ownerFullName: "",
    ownerEmail: "",
    ownerPassword: "",
    phone: "",
  });

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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
      const text = await res.text();
      let body: any = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      if (!res.ok) throw new Error(body.error ?? "We couldn't submit your application. Please try again.");
      setDone({ message: body.message, slug: body.slug ?? form.slug });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable; the URL is still shown on screen */
    }
  }

  if (done) {
    const bookingUrl = `${origin}/b/${done.slug}`;
    const loginUrl = `${origin}/b/${done.slug}/manage/login`;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ width: "100%", maxWidth: 480 }}>
          <h1 style={{ fontSize: 20 }}>Application received</h1>
          <p className="page-subtitle">{done.message}</p>

          <div className="field">
            <label>Your booking page</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" readOnly value={bookingUrl} onFocus={(e) => e.target.select()} />
              <button className="btn btn-secondary btn-small" type="button" onClick={() => copy("booking", bookingUrl)}>
                {copied === "booking" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="field-hint">Share this with clients once your application is approved.</p>
          </div>

          <div className="field">
            <label>Your owner login</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" readOnly value={loginUrl} onFocus={(e) => e.target.select()} />
              <button className="btn btn-secondary btn-small" type="button" onClick={() => copy("login", loginUrl)}>
                {copied === "login" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="field-hint">Sign in here with the email and password you just used. Save this address.</p>
          </div>

          <Link className="btn btn-secondary" href="/" style={{ width: "100%" }}>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 440 }}>
        <h1 style={{ fontSize: 20 }}>List your business on Zentro</h1>
        <p className="page-subtitle">Your application will be reviewed before your booking page goes live.</p>

        <form onSubmit={handleSubmit}>
          {error && <p className="error-banner">{error}</p>}
          <div className="field">
            <label htmlFor="bname">Business name</label>
            <input id="bname" type="text" required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="slug">Business URL</label>
            <input
              id="slug"
              type="text"
              required
              pattern="[a-z0-9\-]+"
              placeholder="glow-beauty"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
            />
            <p className="field-hint">
              {origin || "your-site"}/b/{form.slug || "your-business"}
            </p>
          </div>
          <div className="field">
            <label htmlFor="oname">Your full name</label>
            <input id="oname" type="text" required value={form.ownerFullName} onChange={(e) => setForm({ ...form, ownerFullName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="oemail">Your email</label>
            <input id="oemail" type="email" required value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ophone">Phone</label>
            <input id="ophone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="opassword">Password</label>
            <input id="opassword" type="password" required minLength={10} value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} />
            <p className="field-hint">At least 10 characters.</p>
          </div>
          <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Submitting…" : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
}
