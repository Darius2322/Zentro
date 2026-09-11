"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BusinessApprovalActions({
  businessId,
  status,
}: {
  businessId: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject" | "suspend" | "reactivate") {
    let reason: string | undefined;
    if (action === "reject" || action === "suspend") {
      const input = prompt(`Reason for ${action === "reject" ? "rejecting" : "suspending"} this business (optional):`);
      if (input === null) return; // cancelled
      reason = input || undefined;
    }
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this business?`)) return;

    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/businesses/${businessId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
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
        {status === "PENDING" && (
          <>
            <button className="btn btn-small" disabled={busy !== null} onClick={() => run("approve")}>
              Approve
            </button>
            <button className="btn btn-small btn-danger" disabled={busy !== null} onClick={() => run("reject")}>
              Reject
            </button>
          </>
        )}
        {status === "ACTIVE" && (
          <button className="btn btn-small btn-danger" disabled={busy !== null} onClick={() => run("suspend")}>
            Suspend
          </button>
        )}
        {status === "SUSPENDED" && (
          <button className="btn btn-small" disabled={busy !== null} onClick={() => run("reactivate")}>
            Reactivate
          </button>
        )}
      </div>
      {error && <div className="field-hint" style={{ color: "var(--danger)" }}>{error}</div>}
    </div>
  );
}
