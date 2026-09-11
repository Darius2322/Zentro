import { NextRequest, NextResponse } from "next/server";
import { resolveBusinessBySlug, assertLoginAllowed, TenantError } from "@/lib/tenant";

/**
 * Public endpoint backing the dedicated per-business login page (spec #5).
 * The frontend must NEVER hardcode or guess the business name — it always
 * loads it from here using the slug, and the slug is validated server-side
 * against the real business record.
 */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const business = await resolveBusinessBySlug(params.slug);
    try {
      assertLoginAllowed(business);
    } catch (err) {
      if (err instanceof TenantError) {
        return NextResponse.json(
          { name: business.name, logo_url: business.logoUrl, login_allowed: false, reason: err.message },
          { status: 200 }
        );
      }
      throw err;
    }
    return NextResponse.json({
      name: business.name,
      logo_url: business.logoUrl,
      login_allowed: true,
    });
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("business info lookup failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
