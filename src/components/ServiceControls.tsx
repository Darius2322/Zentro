"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StaffOption {
  id: string;
  full_name: string;
}

export function NewServiceForm({ slug, staffOptions }: { slug: string; staffOptions: StaffOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    price: "",
    duration: "60",
    buffer: "0",
    staffIds: [] as string[],
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/b/${slug}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          price_cents: Math.round(parseFloat(form.price || "0") * 100),
          duration_minutes: parseInt(form.duration, 10),
          buffer_minutes: parseInt(form.buffer || "0", 10),
          qualified_staff_ids: form.staffIds,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create service.");
      setOpen(false);
      setForm({ name: "", price: "", duration: "60", buffer: "0", staffIds: [] });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button className="btn" onClick={() => setOpen(true)}>
        Add service
      </button>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 24 }}>
      <h2>New service</h2>
      <form onSubmit={handleSubmit}>
        {error && <p className="error-banner">{error}</p>}
        <div className="field">
          <label htmlFor="svc-name">Name</label>
          <input
            id="svc-name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Gel Manicure"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div className="field">
            <label htmlFor="svc-price">Price</label>
            <input
              id="svc-price"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="svc-duration">Duration (min)</label>
            <input
              id="svc-duration"
              type="number"
              min="5"
              required
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="svc-buffer">Buffer (min)</label>
            <input
              id="svc-buffer"
              type="number"
              min="0"
              value={form.buffer}
              onChange={(e) => setForm({ ...form, buffer: e.target.value })}
            />
          </div>
        </div>
        {staffOptions.length > 0 && (
          <div className="field">
            <label>Qualified staff</label>
            {staffOptions.map((s) => (
              <label key={s.id} style={{ display: "block", fontWeight: 400, fontSize: 14, marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={form.staffIds.includes(s.id)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      staffIds: e.target.checked
                        ? [...form.staffIds, s.id]
                        : form.staffIds.filter((id) => id !== s.id),
                    })
                  }
                  style={{ marginRight: 8 }}
                />
                {s.full_name}
              </label>
            ))}
          </div>
        )}
        <div className="btn-row">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save service"}
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export function ArchiveServiceButton({ slug, serviceId }: { slug: string; serviceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="btn btn-secondary btn-small"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Archive this service? It will no longer be bookable.")) return;
        setBusy(true);
        await fetch(`/api/b/${slug}/services/${serviceId}`, { method: "DELETE" });
        router.refresh();
      }}
    >
      Archive
    </button>
  );
}
