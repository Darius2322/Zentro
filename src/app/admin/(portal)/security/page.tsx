"use client";

import { useState } from "react";

export default function AdminSecurityPage() {
  const [setup, setSetup] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startSetup() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/auth/2fa/setup", { method: "POST" });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError(body.error);
    setSetup(body);
  }

  async function confirmEnable() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError(body.error);
    setMessage("Two-factor authentication is now enabled.");
    setSetup(null);
    setCode("");
  }

  async function disable() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) return setError(body.error);
    setMessage("Two-factor authentication has been disabled.");
    setCode("");
  }

  return (
    <div>
      <h1>Security</h1>
      <p className="page-subtitle">Two-factor authentication for platform admin accounts.</p>

      <div className="card" style={{ maxWidth: 440 }}>
        {message && <p className="error-banner" style={{ background: "var(--success-bg)", color: "var(--accent)" }}>{message}</p>}
        {error && <p className="error-banner">{error}</p>}

        {!setup && (
          <>
            <p style={{ marginTop: 0 }}>
              Turning this on means every sign-in requires a 6-digit code from an authenticator app
              (Google Authenticator, Authy, 1Password) in addition to your password.
            </p>
            <div className="btn-row">
              <button className="btn" onClick={startSetup} disabled={busy}>
                Set up 2FA
              </button>
            </div>
            <div style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
              <p className="field-hint">Already enabled? Enter your current code to turn it off.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="text" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 100 }} />
                <button className="btn btn-danger" onClick={disable} disabled={busy || code.length !== 6}>
                  Disable 2FA
                </button>
              </div>
            </div>
          </>
        )}

        {setup && (
          <>
            <p style={{ marginTop: 0 }}>Scan this into your authenticator app, or enter the key manually:</p>
            <div className="field">
              <input type="text" readOnly value={setup.secret} onFocus={(e) => e.target.select()} style={{ fontFamily: "monospace" }} />
            </div>
            <p className="field-hint" style={{ wordBreak: "break-all" }}>{setup.otpauth_uri}</p>
            <div className="field">
              <label htmlFor="confirm-code">Enter the 6-digit code to confirm</label>
              <input id="confirm-code" type="text" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} style={{ width: 120 }} />
            </div>
            <div className="btn-row">
              <button className="btn" onClick={confirmEnable} disabled={busy || code.length !== 6}>
                Confirm and enable
              </button>
              <button className="btn btn-secondary" onClick={() => setSetup(null)}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
