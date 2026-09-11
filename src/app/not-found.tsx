import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", padding: 24, fontFamily: "var(--font)" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Page not found</h1>
      <p style={{ color: "var(--ink-muted)", marginBottom: 20 }}>
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link className="btn" href="/">Go home</Link>
    </div>
  );
}
