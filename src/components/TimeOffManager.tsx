"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TimeOff {
  id: string;
  type: string;
  startsAt: string;
  endsAt: string;
  note: string | null;
}

export function TimeOffManager({ slug, staffId, initial }: { slug: string; staffId: string; initial: TimeOff[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ type: "HOLIDAY", start: "", end: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addTimeOff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/b/${slug}/staff/${staffId}/time-off`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          starts_at: new Date(form.start).toISOString(),
          ends_at: new Date(form.end).toISOString(),
          note: form.note || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not add leave.");
      setForm({ type: "HOLIDAY", start: "", end: "", note: "" });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/b/${slug}/staff/${staffId}/time-off/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <div className="list" style={{ marginBottom: 16 }}>
        {initial.length === 0 ? (
          <div className="empty-state">No leave scheduled.</div>
        ) : (
          initial.map((t) => (
            <div className="list-row" key={t.id}>
              <div className="list-row-main">
                <div className="list-row-title">{t.type.charAt(0) + t.type.slice(1).toLowerCase()}</div>
                <div className="list-row-meta">
                  {new Date(t.startsAt).toLocaleDateString()} – {new Date(t.endsAt).toLocaleDateString()}
                  {t.note ? ` · ${t.note}` : ""}
                </div>
              </div>
              <button className="btn btn-small btn-secondary" onClick={() => remove(t.id)}>Remove</button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={addTimeOff} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        {error && <p className="error-banner" style={{ width: "100%" }}>{error}</p>}
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="HOLIDAY">Holiday</option>
            <option value="SICK">Sick</option>
            <option value="PERSONAL">Personal</option>
            <option value="TRAINING">Training</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>From</label>
          <input type="datetime-local" required value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>To</label>
          <input type="datetime-local" required value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
        </div>
        <button className="btn btn-small" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add leave"}
        </button>
      </form>
    </div>
  );
}
