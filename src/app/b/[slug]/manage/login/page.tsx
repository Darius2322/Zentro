"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BusinessInfo {
  name: string;
  logo_url: string | null;
  login_allowed: boolean;
  reason?: string;
}

export default function BusinessLoginPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [info, setInfo] = useState<BusinessInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/b/${params.slug}/info`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "This business could not be found.");
        }
        return res.json();
      })
      .then(setInfo)
      .catch((err) => setLoadError(err.message));
  }, [params.slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/b/${params.slug}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Sign in failed.");
      router.push(`/b/${params.slug}/manage/dashboard`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 380 }}>
        {loadError && <p className="error-banner">{loadError}</p>}

        {info && !loadError && (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              {info.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.logo_url}
                  alt={`${info.name} logo`}
                  style={{ height: 48, marginBottom: 12 }}
                />
              ) : null}
              <h1 style={{ fontSize: 20 }}>{info.name}</h1>
              <p className="page-subtitle" style={{ marginBottom: 0 }}>
                Owner &amp; staff login
              </p>
            </div>

            {!info.login_allowed ? (
              <p className="error-banner">{info.reason}</p>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && <p className="error-banner">{error}</p>}
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <button className="btn" type="submit" disabled={submitting} style={{ width: "100%" }}>
                  {submitting ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
