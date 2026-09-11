"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewResourceTypeForm({ slug }: { slug: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Add resource type
      </button>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 24, maxWidth: 400 }}>
      <h2>New resource type</h2>
      {error && <p className="error-banner">{error}</p>}
      <div className="field">
        <label htmlFor="rt-name">Name</label>
        <input id="rt-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Manicure Table" />
      </div>
      <div className="btn-row">
        <button
          className="btn"
          disabled={busy || !name}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const res = await fetch(`/api/b/${slug}/resource-types`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
            });
            const body = await res.json();
            setBusy(false);
            if (!res.ok) return setError(body.error ?? "Could not create.");
            setOpen(false);
            setName("");
            router.refresh();
          }}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export function AddResourceForm({ slug, resourceTypeId }: { slug: string; resourceTypeId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
      <input
        type="text"
        placeholder="e.g. Table 2"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ maxWidth: 160 }}
      />
      <button
        className="btn btn-small btn-secondary"
        disabled={busy || !name}
        onClick={async () => {
          setBusy(true);
          await fetch(`/api/b/${slug}/resources`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource_type_id: resourceTypeId, name }),
          });
          setBusy(false);
          setName("");
          router.refresh();
        }}
      >
        Add
      </button>
    </div>
  );
}

export function ResourceStatusSelect({
  slug,
  resourceId,
  status,
}: {
  slug: string;
  resourceId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <select
      value={status}
      disabled={busy}
      onChange={async (e) => {
        setBusy(true);
        await fetch(`/api/b/${slug}/resources/${resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: e.target.value }),
        });
        setBusy(false);
        router.refresh();
      }}
      style={{ width: 130 }}
    >
      <option value="AVAILABLE">Available</option>
      <option value="MAINTENANCE">Maintenance</option>
      <option value="RETIRED">Retired</option>
    </select>
  );
}
