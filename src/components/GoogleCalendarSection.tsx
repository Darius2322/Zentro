"use client";

import { useEffect, useState } from "react";

interface Connection {
  id: string;
  provider: string;
  calendarId: string;
  isActive: boolean;
  tokenExpiresAt: string;
}

export function GoogleCalendarSection({ slug }: { slug: string }) {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    fetch(`/api/b/${slug}/calendar`)
      .then((r) => r.json())
      .then((body) => setConnections(body.connections ?? []));
  }

  useEffect(() => {
    load();
  }, [slug]);

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h2>Google Calendar</h2>
      <p className="page-subtitle" style={{ marginTop: -4 }}>
        Connect a calendar to keep external events blocked out of your availability automatically.
      </p>

      {connections === null ? (
        <p className="field-hint">Loading…</p>
      ) : connections.length === 0 ? (
        <a className="btn" href={`/api/b/${slug}/calendar/connect`}>
          Connect Google Calendar
        </a>
      ) : (
        <div className="list">
          {connections.map((c) => (
            <div className="list-row" key={c.id}>
              <div className="list-row-main">
                <div className="list-row-title">{c.calendarId}</div>
                <div className="list-row-meta">
                  Token expires {new Date(c.tokenExpiresAt).toLocaleString()}
                </div>
              </div>
              <div className="btn-row">
                <button
                  className="btn btn-small btn-secondary"
                  disabled={busy === c.id}
                  onClick={async () => {
                    setBusy(c.id);
                    await fetch(`/api/b/${slug}/calendar/${c.id}/sync`, { method: "POST" });
                    setBusy(null);
                  }}
                >
                  {busy === c.id ? "Syncing…" : "Sync now"}
                </button>
                <button
                  className="btn btn-small btn-danger"
                  onClick={async () => {
                    await fetch(`/api/b/${slug}/calendar/${c.id}`, { method: "DELETE" });
                    load();
                  }}
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
