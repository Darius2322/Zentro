"use client";

import { useState } from "react";

interface TrackedBooking {
  booking_reference: string;
  service_name: string;
  staff_name: string;
  starts_at: string;
  ends_at: string;
  status: string;
  payment_status: string | null;
}

export default function TrackBookingPage({ params }: { params: { slug: string } }) {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState<TrackedBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setBooking(null);
    try {
      const res = await fetch(
        `/api/b/${params.slug}/public/track?${new URLSearchParams({ reference, phone })}`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Booking not found.");
      setBooking(body.booking);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this appointment?")) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(`/api/b/${params.slug}/public/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, phone }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not cancel this booking.");
      setBooking(body.booking);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div>
      <h1>Track your booking</h1>
      <p className="page-subtitle">Enter your booking reference and the phone number you booked with.</p>

      <form onSubmit={handleLookup} className="card" style={{ maxWidth: 400, marginBottom: 24 }}>
        {error && <p className="error-banner">{error}</p>}
        <div className="field">
          <label htmlFor="ref">Booking reference</label>
          <input id="ref" type="text" required value={reference} onChange={(e) => setReference(e.target.value)} placeholder="BK-2026-XXXXXXXX" />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone number</label>
          <input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button className="btn" type="submit" disabled={loading} style={{ width: "100%" }}>
          {loading ? "Looking up…" : "Find my booking"}
        </button>
      </form>

      {booking && (
        <div className="card" style={{ maxWidth: 400 }}>
          <h2>{booking.service_name}</h2>
          <p style={{ marginBottom: 4 }}>
            {new Date(booking.starts_at).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            {" · "}
            {new Date(booking.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
          <p className="page-subtitle" style={{ marginBottom: 12 }}>with {booking.staff_name}</p>
          <span className={`badge ${booking.status === "CANCELLED" ? "badge-danger" : booking.status === "COMPLETED" ? "badge-success" : "badge-neutral"}`}>
            {booking.status}
          </span>
          {(booking.status === "PENDING" || booking.status === "CONFIRMED") && new Date(booking.starts_at) > new Date() && (
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-danger" disabled={cancelling} onClick={handleCancel}>
                {cancelling ? "Cancelling…" : "Cancel this booking"}
              </button>
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <a href={`/b/${params.slug}/receipt`} className="btn btn-secondary btn-small">
              View receipt
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
