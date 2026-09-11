import { resolveBusinessBySlug } from "@/lib/tenant";

export default async function AboutPage({ params }: { params: { slug: string } }) {
  const business = await resolveBusinessBySlug(params.slug);

  return (
    <div>
      <h1>About {business.name}</h1>
      {business.description ? (
        <p style={{ fontSize: 15, color: "var(--ink-muted)", maxWidth: 640 }}>{business.description}</p>
      ) : (
        <p className="page-subtitle">This business hasn't added a description yet.</p>
      )}

      <h2 style={{ marginTop: 32 }}>Privacy</h2>
      <p style={{ fontSize: 14, color: "var(--ink-muted)", maxWidth: 640 }}>
        {business.name} collects only the information needed to manage your appointment — your name,
        phone number, and, if you provide it, your email. This information is never sold and is only
        used to contact you about your bookings.
      </p>

      <h2 style={{ marginTop: 32 }}>Terms</h2>
      <p style={{ fontSize: 14, color: "var(--ink-muted)", maxWidth: 640 }}>
        {business.cancellationPolicy ??
          "Please contact us if you need to change or cancel an appointment. Standard booking terms apply."}
      </p>
    </div>
  );
}
