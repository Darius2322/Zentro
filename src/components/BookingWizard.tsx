"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  staff: { id: string; full_name: string }[];
}

interface Slot {
  starts_at: string;
  ends_at: string;
  staff_id: string;
  staff_name: string;
}

interface DayAvailability {
  date: string;
  slots: Slot[];
}

interface BusinessHoursDay {
  weekday: number;
  is_closed: boolean;
}

type Step = "service" | "staff" | "datetime" | "details" | "confirmation";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function BookingWizard({ slug, businessId, currency }: { slug: string; businessId: string; currency: string }) {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("service");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHoursDay[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(searchParams.get("service"));
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(searchParams.get("staff"));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [availability, setAvailability] = useState<DayAvailability[] | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const [customer, setCustomer] = useState({ fullName: "", phone: "", email: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ reference: string; receipt: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/b/${slug}/public/services`).then((r) => r.json()),
      fetch(`/api/b/${slug}/public/business`).then((r) => r.json()),
    ])
      .then(([svc, biz]) => {
        setServices(svc.services);
        setBusinessHours(biz.hours ?? []);
        if (selectedServiceId) setStep("staff");
      })
      .catch(() => setLoadError("Could not load booking information. Please try again."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null;

  // Load a month of availability whenever the service, staff choice, or
  // visible month changes. This calls the SAME /api/availability endpoint
  // used everywhere else — nothing here is a client-side guess.
  useEffect(() => {
    if (!selectedServiceId || step !== "datetime") return;
    const from = new Date(monthCursor.year, monthCursor.month, 1);
    const to = new Date(monthCursor.year, monthCursor.month + 1, 0);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    setAvailabilityLoading(true);
    setAvailabilityError(null);
    const params = new URLSearchParams({
      business_id: businessId,
      service_id: selectedServiceId,
      date_from: fmt(from),
      date_to: fmt(to),
    });
    if (selectedStaffId) params.set("staff_id", selectedStaffId);

    fetch(`/api/availability?${params.toString()}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.error && body.dates?.length === undefined) throw new Error(body.error);
        setAvailability(body.dates ?? []);
      })
      .catch((err) => setAvailabilityError(err.message ?? "Could not check availability."))
      .finally(() => setAvailabilityLoading(false));
  }, [selectedServiceId, selectedStaffId, monthCursor, step, businessId]);

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    (availability ?? []).forEach((d) => map.set(d.date, d.slots));
    return map;
  }, [availability]);

  const closedWeekdays = useMemo(() => new Set(businessHours.filter((h) => h.is_closed).map((h) => h.weekday)), [businessHours]);

  async function handleConfirmBooking() {
    if (!selectedService || !selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          service_id: selectedService.id,
          staff_id: selectedSlot.staff_id,
          starts_at: selectedSlot.starts_at,
          customer: {
            full_name: customer.fullName,
            phone: customer.phone,
            email: customer.email || undefined,
            notes: customer.notes || undefined,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not complete your booking.");
      setConfirmation({ reference: body.booking_reference, receipt: body.receipt_number });
      setStep("confirmation");
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <p className="error-banner">{loadError}</p>;

  // Guards against a stale/invalid ?service= query param pointing at a
  // service that no longer exists or isn't active.
  if (step !== "service" && services.length > 0 && !selectedService) {
    return (
      <div>
        <p className="error-banner">That service isn't available. Please choose another.</p>
        <button className="btn" onClick={() => setStep("service")}>Choose a service</button>
      </div>
    );
  }

  // ---------------------------------------------------------------- STEP: service
  if (step === "service") {
    return (
      <div>
        <StepHeader title="Choose a service" step={1} of={4} />
        {services.length === 0 ? (
          <div className="list"><div className="empty-state">No services are available to book right now.</div></div>
        ) : (
          <div className="list">
            {services.map((s) => (
              <button
                key={s.id}
                className="list-row"
                style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => {
                  setSelectedServiceId(s.id);
                  setSelectedStaffId(null);
                  setSelectedSlot(null);
                  setStep("staff");
                }}
              >
                <div className="list-row-main">
                  <div className="list-row-title">{s.name}</div>
                  <div className="list-row-meta">
                    {s.duration_minutes} min · {currency} {(s.price_cents / 100).toLocaleString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------- STEP: staff
  if (step === "staff" && selectedService) {
    return (
      <div>
        <StepHeader title="Choose staff" step={2} of={4} onBack={() => setStep("service")} />
        <div className="list">
          <button
            className="list-row"
            style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
            onClick={() => {
              setSelectedStaffId(null);
              setStep("datetime");
            }}
          >
            <div className="list-row-main">
              <div className="list-row-title">Any available staff</div>
              <div className="list-row-meta">We'll assign a qualified team member automatically</div>
            </div>
          </button>
          {selectedService.staff.map((st) => (
            <button
              key={st.id}
              className="list-row"
              style={{ width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
              onClick={() => {
                setSelectedStaffId(st.id);
                setStep("datetime");
              }}
            >
              <div className="list-row-main">
                <div className="list-row-title">{st.full_name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- STEP: datetime
  if (step === "datetime" && selectedService) {
    const daysInMonth = new Date(monthCursor.year, monthCursor.month + 1, 0).getDate();
    const firstWeekday = new Date(monthCursor.year, monthCursor.month, 1).getDay();
    const todayStr = new Date().toISOString().slice(0, 10);
    const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

    const slotsForSelectedDate = selectedDate ? availabilityByDate.get(selectedDate) ?? [] : [];

    return (
      <div>
        <StepHeader title="Choose date & time" step={3} of={4} onBack={() => setStep("staff")} />
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <button className="btn btn-secondary btn-small" onClick={() => setMonthCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}>
                ←
              </button>
              <strong>{MONTH_NAMES[monthCursor.month]} {monthCursor.year}</strong>
              <button className="btn btn-secondary btn-small" onClick={() => setMonthCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}>
                →
              </button>
            </div>
            {availabilityLoading && <p className="field-hint">Checking availability…</p>}
            {availabilityError && <p className="error-banner">{availabilityError}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 11, color: "var(--ink-muted)" }}>{d}</div>
              ))}
              {cells.map((day, idx) => {
                if (day === null) return <div key={idx} />;
                const dateStr = `${monthCursor.year}-${String(monthCursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isPast = dateStr < todayStr;
                const weekday = new Date(monthCursor.year, monthCursor.month, day).getDay();
                const isClosedWeekday = closedWeekdays.has(weekday);
                const slots = availabilityByDate.get(dateStr);
                const hasData = availability !== null;
                const slotCount = slots?.length ?? 0;

                let state: "past" | "closed" | "full" | "limited" | "available" | "loading" = "loading";
                if (isPast) state = "past";
                else if (!hasData) state = "loading";
                else if (isClosedWeekday && slotCount === 0) state = "closed";
                else if (slotCount === 0) state = "full";
                else if (slotCount <= 3) state = "limited";
                else state = "available";

                const disabled = state === "past" || state === "closed" || state === "full" || state === "loading";

                return (
                  <button
                    key={idx}
                    disabled={disabled}
                    onClick={() => { setSelectedDate(dateStr); setSelectedSlot(null); }}
                    title={state}
                    style={{
                      aspectRatio: "1",
                      border: selectedDate === dateStr ? "2px solid var(--accent)" : "1px solid var(--border)",
                      borderRadius: 4,
                      background: disabled ? "var(--bg)" : "var(--surface)",
                      color: disabled ? "var(--ink-muted)" : "var(--ink)",
                      cursor: disabled ? "default" : "pointer",
                      fontSize: 13,
                      position: "relative",
                    }}
                  >
                    {day}
                    {state === "limited" && <span style={{ position: "absolute", bottom: 2, right: 2, width: 5, height: 5, borderRadius: "50%", background: "var(--brass)" }} />}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, color: "var(--ink-muted)", flexWrap: "wrap" }}>
              <span>● Limited availability</span>
              <span>Greyed out = closed, fully booked, or past</span>
            </div>
          </div>

          <div style={{ flex: "1 1 240px" }}>
            <h2>{selectedDate ? new Date(selectedDate + "T00:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }) : "Select a date"}</h2>
            {!selectedDate && <p className="page-subtitle">Pick a date on the calendar to see available times.</p>}
            {selectedDate && slotsForSelectedDate.length === 0 && (
              <p className="page-subtitle">No appointments available for this date. Try another date.</p>
            )}
            {selectedDate && slotsForSelectedDate.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {slotsForSelectedDate.map((slot) => (
                  <button
                    key={slot.starts_at + slot.staff_id}
                    className={`btn btn-small ${selectedSlot?.starts_at === slot.starts_at && selectedSlot?.staff_id === slot.staff_id ? "" : "btn-secondary"}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {new Date(slot.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </button>
                ))}
              </div>
            )}
            {selectedSlot && (
              <button className="btn" style={{ marginTop: 20, width: "100%" }} onClick={() => setStep("details")}>
                Continue with {new Date(selectedSlot.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {!selectedStaffId ? ` — ${selectedSlot.staff_name}` : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- STEP: details
  if (step === "details" && selectedService && selectedSlot) {
    return (
      <div>
        <StepHeader title="Your details" step={4} of={4} onBack={() => setStep("datetime")} />
        <div className="card" style={{ maxWidth: 420 }}>
          {submitError && <p className="error-banner">{submitError}</p>}
          <div className="field">
            <label htmlFor="cust-name">Full name</label>
            <input id="cust-name" type="text" required value={customer.fullName} onChange={(e) => setCustomer({ ...customer, fullName: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cust-phone">Phone</label>
            <input id="cust-phone" type="tel" required value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cust-email">Email (optional)</label>
            <input id="cust-email" type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="cust-notes">Notes (optional)</label>
            <textarea id="cust-notes" rows={2} value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} />
          </div>
          <button className="btn" style={{ width: "100%" }} disabled={submitting || !customer.fullName || !customer.phone} onClick={handleConfirmBooking}>
            {submitting ? "Booking…" : "Confirm booking"}
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- STEP: confirmation
  if (step === "confirmation" && confirmation && selectedService && selectedSlot) {
    return (
      <div className="card" style={{ maxWidth: 440 }}>
        <h1 style={{ fontSize: 20 }}>Booking confirmed</h1>
        <p style={{ marginBottom: 4 }}>{selectedService.name}</p>
        <p className="page-subtitle" style={{ marginBottom: 20 }}>
          {new Date(selectedSlot.starts_at).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          {" · "}
          {new Date(selectedSlot.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {" – "}
          {new Date(selectedSlot.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {" · "}
          {selectedSlot.staff_name}
        </p>
        <div className="field-hint" style={{ marginBottom: 4 }}>Booking reference</div>
        <p style={{ fontFamily: "monospace", fontSize: 16, marginTop: 0 }}>{confirmation.reference}</p>
        <p className="field-hint">Keep this reference and your phone number to track or cancel this booking.</p>
        <a href={`/b/${slug}/receipt`} className="btn btn-secondary btn-small" style={{ marginTop: 8 }}>
          View receipt
        </a>
      </div>
    );
  }

  return null;
}

function StepHeader({ title, step, of, onBack }: { title: string; step: number; of: number; onBack?: () => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {onBack && (
        <button className="btn btn-secondary btn-small" style={{ marginBottom: 12 }} onClick={onBack}>
          ← Back
        </button>
      )}
      <p className="field-hint" style={{ margin: "0 0 4px" }}>Step {step} of {of}</p>
      <h1 style={{ fontSize: 22 }}>{title}</h1>
    </div>
  );
}
