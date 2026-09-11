"use client";

import { useState } from "react";
import { ReceiptView } from "@/components/ReceiptView";

export default function PublicReceiptPage({ params }: { params: { slug: string } }) {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReceipt(null);
    try {
      const res = await fetch(`/api/b/${params.slug}/public/receipt?${new URLSearchParams({ reference, phone })}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Receipt not found.");
      setReceipt(body.receipt);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (receipt) return <ReceiptView receipt={receipt} />;

  return (
    <div>
      <h1>View your receipt</h1>
      <p className="page-subtitle">Enter your booking reference and phone number.</p>
      <form onSubmit={handleLookup} className="card" style={{ maxWidth: 400 }}>
        {error && <p className="error-banner">{error}</p>}
        <div className="field">
          <label htmlFor="ref">Booking reference</label>
          <input id="ref" type="text" required value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Looking up…" : "View receipt"}
        </button>
      </form>
    </div>
  );
}
