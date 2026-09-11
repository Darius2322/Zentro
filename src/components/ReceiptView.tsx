"use client";

interface ReceiptData {
  receipt_number: string;
  issued_at: string;
  business: { name: string; address: string | null; phone: string | null; email: string | null; logo_url: string | null };
  customer_name: string;
  service_name: string;
  staff_name: string;
  starts_at: string;
  duration_minutes: number;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  payment_method: string | null;
  payment_status: string;
}

function money(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toLocaleString()}`;
}

/**
 * Thermal mode is a genuinely different layout (narrow column, condensed
 * spacing, monospace-leaning), not the standard receipt shrunk down — per
 * spec #50 ("Do not simply shrink the normal receipt.").
 */
export function ReceiptView({ receipt, thermal = false }: { receipt: ReceiptData; thermal?: boolean }) {
  if (thermal) {
    return (
      <div
        className="receipt-print"
        style={{
          width: "80mm",
          maxWidth: 320,
          margin: "0 auto",
          fontFamily: "monospace",
          fontSize: 12,
          lineHeight: 1.5,
          padding: 12,
          background: "#fff",
          color: "#000",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{receipt.business.name.toUpperCase()}</div>
          {receipt.business.phone && <div>{receipt.business.phone}</div>}
        </div>
        <Divider thermal />
        <div>Receipt #{receipt.receipt_number}</div>
        <div>{new Date(receipt.issued_at).toLocaleString()}</div>
        <Divider thermal />
        <div>{receipt.service_name}</div>
        <div>Staff: {receipt.staff_name}</div>
        <div>Customer: {receipt.customer_name}</div>
        <div>{new Date(receipt.starts_at).toLocaleString()}</div>
        <Divider thermal />
        <Row label="Subtotal" value={money(receipt.subtotal_cents, receipt.currency)} />
        {receipt.discount_cents > 0 && <Row label="Discount" value={`-${money(receipt.discount_cents, receipt.currency)}`} />}
        {receipt.tax_cents > 0 && <Row label="Tax" value={money(receipt.tax_cents, receipt.currency)} />}
        <Divider thermal />
        <Row label="TOTAL" value={money(receipt.total_cents, receipt.currency)} bold />
        <div style={{ marginTop: 4 }}>Payment: {receipt.payment_method ?? "—"}</div>
        <div>Status: {receipt.payment_status}</div>
        <Divider thermal />
        <div style={{ textAlign: "center", marginTop: 8 }}>Thank you for choosing us.</div>
      </div>
    );
  }

  return (
    <div className="receipt-print card" style={{ maxWidth: 420, margin: "0 auto", background: "#fff" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        {receipt.business.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={receipt.business.logo_url} alt="" style={{ height: 40, marginBottom: 8 }} />
        )}
        <div style={{ fontWeight: 600, fontSize: 18 }}>{receipt.business.name}</div>
        {receipt.business.address && <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>{receipt.business.address}</div>}
        {receipt.business.phone && <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>{receipt.business.phone}</div>}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ink-muted)", marginBottom: 16 }}>
        <span>Receipt #{receipt.receipt_number}</span>
        <span>{new Date(receipt.issued_at).toLocaleDateString()}</span>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", padding: "14px 0", marginBottom: 14 }}>
        <Row label="Customer" value={receipt.customer_name} />
        <Row label="Service" value={receipt.service_name} />
        <Row label="Staff" value={receipt.staff_name} />
        <Row label="Date & time" value={new Date(receipt.starts_at).toLocaleString()} />
        <Row label="Duration" value={`${receipt.duration_minutes} min`} />
      </div>

      <Row label="Subtotal" value={money(receipt.subtotal_cents, receipt.currency)} />
      {receipt.discount_cents > 0 && <Row label="Discount" value={`-${money(receipt.discount_cents, receipt.currency)}`} />}
      {receipt.tax_cents > 0 && <Row label="Tax" value={money(receipt.tax_cents, receipt.currency)} />}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8 }}>
        <Row label="Total" value={money(receipt.total_cents, receipt.currency)} bold />
      </div>

      <div style={{ marginTop: 16, fontSize: 13, color: "var(--ink-muted)" }}>
        <Row label="Payment method" value={receipt.payment_method ?? "—"} />
        <Row label="Status" value={receipt.payment_status} />
      </div>

      <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--ink-muted)" }}>Thank you for choosing us.</p>

      <div className="no-print btn-row" style={{ justifyContent: "center", marginTop: 20 }}>
        <button className="btn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 600 : 400, marginBottom: 4 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Divider({ thermal }: { thermal?: boolean }) {
  return <div style={{ borderTop: thermal ? "1px dashed #000" : "1px solid var(--border)", margin: "6px 0" }} />;
}
