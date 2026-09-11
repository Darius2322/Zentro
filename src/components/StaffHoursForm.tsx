"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayRow {
  weekday: number;
  is_off: boolean;
  start_time: string;
  end_time: string;
}

export function StaffHoursForm({
  slug,
  staffId,
  initialHours,
}: {
  slug: string;
  staffId: string;
  initialHours: DayRow[];
}) {
  const router = useRouter();
  const [days, setDays] = useState<DayRow[]>(
    Array.from({ length: 7 }, (_, weekday) => {
      const existing = initialHours.find((h) => h.weekday === weekday);
      return existing ?? { weekday, is_off: true, start_time: "09:00", end_time: "17:00" };
    })
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(weekday: number, patch: Partial<DayRow>) {
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/b/${slug}/staff/${staffId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ working_hours: days }),
    });
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="card">
      {days.map((d) => (
        <div key={d.weekday} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
          <div style={{ width: 100, fontWeight: 500, fontSize: 14 }}>{WEEKDAYS[d.weekday]}</div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 }}>
            <input type="checkbox" checked={!d.is_off} onChange={(e) => update(d.weekday, { is_off: !e.target.checked })} />
            Working
          </label>
          {!d.is_off && (
            <>
              <input type="time" value={d.start_time} onChange={(e) => update(d.weekday, { start_time: e.target.value })} style={{ width: 120 }} />
              <span>to</span>
              <input type="time" value={d.end_time} onChange={(e) => update(d.weekday, { end_time: e.target.value })} style={{ width: 120 }} />
            </>
          )}
        </div>
      ))}
      <div className="btn-row" style={{ marginTop: 16 }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save working hours"}
        </button>
        {saved && <span className="field-hint" style={{ alignSelf: "center" }}>Saved.</span>}
      </div>
    </div>
  );
}
