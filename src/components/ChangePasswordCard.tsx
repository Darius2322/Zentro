"use client";

import { useState } from "react";

export default function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const text = await res.text();
      let body: any = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = {};
      }
      if (!res.ok) throw new Error(body.error ?? "Could not change your password. Please try again.");
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 440, marginBottom: 24 }}>
      <h2>Change password</h2>
      <form onSubmit={submit}>
        {error && <p className="error-banner">{error}</p>}
        {done && (
          <p className="error-banner" style={{ background: "var(--success-bg)", color: "var(--accent)" }}>
            Password changed. Use the new one next time you sign in.
          </p>
        )}
        <div className="field">
          <label htmlFor="pw-current">Current password</label>
          <input id="pw-current" type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pw-new">New password</label>
          <input id="pw-new" type="password" required minLength={12} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <p className="field-hint">At least 12 characters.</p>
        </div>
        <div className="field">
          <label htmlFor="pw-confirm">Confirm new password</label>
          <input id="pw-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </div>
  );
}
