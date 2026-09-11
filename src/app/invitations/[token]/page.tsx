"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface InvitationPreview {
  business_name: string;
  business_logo_url: string | null;
  staff_name: string;
  email: string;
}

export default function AcceptInvitationPage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [businessSlug, setBusinessSlug] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invitations/${params.token}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error);
        return res.json();
      })
      .then(setPreview)
      .catch((err) => setLoadError(err.message));
  }, [params.token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invitations/${params.token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not activate your account.");
      setBusinessSlug(body.business_slug);
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        {loadError && <p className="error-banner">{loadError}</p>}

        {preview && !loadError && !done && (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <p className="page-subtitle" style={{ marginBottom: 4 }}>
                You're invited to join
              </p>
              <h1 style={{ fontSize: 20 }}>{preview.business_name}</h1>
              <p className="page-subtitle" style={{ marginBottom: 0 }}>
                {preview.staff_name} · {preview.email}
              </p>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <p className="error-banner">{error}</p>}
              <div className="field">
                <label htmlFor="password">Create a password</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <input
                  id="confirm"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
                {submitting ? "Activating…" : "Activate account"}
              </button>
            </form>
          </>
        )}

        {done && preview && (
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 20 }}>You're all set</h1>
            <p className="page-subtitle">Your account is active. You can now sign in.</p>
            <button className="btn" onClick={() => router.push(`/b/${businessSlug}/manage/login`)}>
              Continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
