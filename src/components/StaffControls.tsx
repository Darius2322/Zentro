"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteStaffForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", title: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/b/${slug}/staff/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: form.fullName, email: form.email, title: form.title || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not send invitation.");
      setLink(`${window.location.origin}${body.invitation_link}`);
      setForm({ fullName: "", email: "", title: "" });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Invite staff
      </button>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h2>Invite a staff member</h2>
      {link ? (
        <>
          <p style={{ marginTop: 0 }}>
            Invitation created. Send this link to {form.email || "the new staff member"} — it expires in
            72 hours and can only be used once.
          </p>
          <div className="field">
            <input type="text" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setLink(null);
              setOpen(false);
            }}
          >
            Done
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <p className="error-banner">{error}</p>}
          <div className="field">
            <label htmlFor="staff-name">Full name</label>
            <input
              id="staff-name"
              type="text"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="staff-email">Email</label>
            <input
              id="staff-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="staff-title">Title (optional)</label>
            <input
              id="staff-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Senior Stylist"
            />
          </div>
          <div className="btn-row">
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send invitation"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function ToggleStaffActiveButton({
  slug,
  staffId,
  isActive,
}: {
  slug: string;
  staffId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="btn btn-secondary btn-small"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/b/${slug}/staff/${staffId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !isActive }),
        });
        router.refresh();
      }}
    >
      {isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}
