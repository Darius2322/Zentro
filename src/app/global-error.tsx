"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 24, fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#565b57", marginBottom: 20 }}>
            We hit an unexpected error. Please try again.
          </p>
          <button
            onClick={reset}
            style={{ padding: "9px 16px", borderRadius: 6, border: "none", background: "#1F6F5C", color: "#fff", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
