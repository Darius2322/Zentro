export default function OfflinePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 24, textAlign: "center" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>You're offline</h1>
      <p style={{ color: "var(--ink-muted)", maxWidth: 340 }}>
        Live availability and booking require an internet connection. Please reconnect and try again.
      </p>
    </div>
  );
}
