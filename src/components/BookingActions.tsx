"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

const NEXT_ACTIONS: Record<Status, { action: string; label: string; danger?: boolean }[]> = {
  PENDING: [
    { action: "confirm", label: "Confirm" },
    { action: "cancel", label: "Cancel", danger: true },
    { action: "no_show", label: "No-show", danger: true },
  ],
  CONFIRMED: [
    { action: "complete", label: "Complete" },
    { action: "cancel", label: "Cancel", danger: true },
    { action: "no_show", label: "No-show", danger: true },
  ],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function RecordPaymentButton({
  slug,
  bookingId,
  currentStatus,
}: {
  slug: string;
  bookingId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus === "PENDING" ? "PAID" : currentStatus);
  const [method, setMethod] = useState("Cash");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="btn btn-small btn-secondary" onClick={() => setOpen(true)}>
        Record payment
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 110 }}>
        <option value="PAID">Paid</option>
        <option value="FAILED">Failed</option>
        <option value="REFUNDED">Refunded</option>
      </select>
      <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: 100 }}>
        <option>Cash</option>
        <option>M-Pesa</option>
        <option>Card</option>
      </select>
      <button
        className="btn btn-small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await fetch(`/api/b/${slug}/bookings/${bookingId}/payment`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, method }),
          });
          setBusy(false);
          setOpen(false);
          router.refresh();
        }}
      >
        Save
      </button>
    </div>
  );
}
export function BookingActions({
  slug,
  bookingId,
  status,
}: {
  slug: string;
  bookingId: string;
  status: Status;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const actions = NEXT_ACTIONS[status] ?? [];
  if (actions.length === 0) return null;

  async function run(action: string) {
    if (action === "cancel" && !confirm("Cancel this booking?")) return;
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/b/${slug}/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Action failed.");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="btn-row">
        {actions.map((a) => (
          <button
            key={a.action}
            className={`btn btn-small ${a.danger ? "btn-danger" : "btn-secondary"}`}
            disabled={busy !== null}
            onClick={() => run(a.action)}
          >
            {busy === a.action ? "…" : a.label}
          </button>
        ))}
      </div>
      {error && <div className="field-hint" style={{ color: "var(--danger)" }}>{error}</div>}
    </div>
  );
}
