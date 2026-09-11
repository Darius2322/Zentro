"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayHours {
  weekday: number;
  is_closed: boolean;
  start_time: string;
  end_time: string;
}

export function HoursForm({
  slug,
  initialHours,
  initialInterval,
  initialMinNotice,
  initialMaxAdvance,
}: {
  slug: string;
  initialHours: DayHours[];
  initialInterval: number;
  initialMinNotice: number;
  initialMaxAdvance: number;
}) {
  const router = useRouter();
  const [days, setDays] = useState<DayHours[]>(
    Array.from({ length: 7 }, (_, weekday) => {
      const existing = initialHours.find((h) => h.weekday === weekday);
      return existing ?? { weekday, is_closed: true, start_time: "09:00", end_time: "17:00" };
    })
  );
  const [interval_, setInterval_] = useState(String(initialInterval));
  const [minNotice, setMinNotice] = useState(String(initialMinNotice));
  const [maxAdvance, setMaxAdvance] = useState(String(initialMaxAdvance));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDay(weekday: number, patch: Partial<DayHours>) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/b/${slug}/hours`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours: days,
          booking_interval_minutes: parseInt(interval_, 10),
          min_notice_minutes: parseInt(minNotice, 10),
          max_advance_booking_days: parseInt(maxAdvance, 10),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setSaved(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      {error && <p className="error-banner">{error}</p>}
      {days.map((d) => (
        <div
          key={d.weekday}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "8px 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ width: 100, fontWeight: 500, fontSize: 14 }}>{WEEKDAYS[d.weekday]}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 }}>
            <input
              type="checkbox"
              checked={!d.is_closed}
              onChange={(e) => updateDay(d.weekday, { is_closed: !e.target.checked })}
            />
            Open
          </label>
          {!d.is_closed && (
            <>
              <input
                type="time"
                value={d.start_time}
                onChange={(e) => updateDay(d.weekday, { start_time: e.target.value })}
                style={{ width: 120 }}
              />
              <span>to</span>
              <input
                type="time"
                value={d.end_time}
                onChange={(e) => updateDay(d.weekday, { end_time: e.target.value })}
                style={{ width: 120 }}
              />
            </>
          )}
        </div>
      ))}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 20 }}>
        <div className="field">
          <label htmlFor="interval">Booking interval (min)</label>
          <input id="interval" type="number" min="5" value={interval_} onChange={(e) => setInterval_(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="notice">Minimum notice (min)</label>
          <input id="notice" type="number" min="0" value={minNotice} onChange={(e) => setMinNotice(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="advance">Max advance booking (days)</label>
          <input id="advance" type="number" min="1" value={maxAdvance} onChange={(e) => setMaxAdvance(e.target.value)} />
        </div>
      </div>

      <div className="btn-row">
        <button className="btn" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save hours"}
        </button>
        {saved && <span className="field-hint" style={{ alignSelf: "center" }}>Saved.</span>}
      </div>
    </div>
  );
}
