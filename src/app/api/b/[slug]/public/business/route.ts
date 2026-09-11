import { NextRequest, NextResponse } from "next/server";
import { resolveBusinessBySlug, TenantError } from "@/lib/tenant";
import { prisma } from "@/lib/db";

/**
 * Public, unauthenticated business profile. Only ever returns information
 * the owner has configured for public display — never contact-level
 * customer data, never anything about other businesses, and never anything
 * at all if the business isn't ACTIVE (spec #90: a suspended/rejected
 * business's public page must not behave like a normal storefront).
 */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const business = await resolveBusinessBySlug(params.slug);
    const hours = await prisma.businessHours.findMany({
      where: { businessId: business.id },
      orderBy: { weekday: "asc" },
    });

    return NextResponse.json({
      id: business.id,
      slug: business.slug,
      name: business.name,
      status: business.status,
      description: business.description,
      logo_url: business.logoUrl,
      phone: business.phone,
      whatsapp: business.whatsapp,
      email: business.email,
      address: business.address,
      timezone: business.timezone,
      hours: hours.map((h) => ({
        weekday: h.weekday,
        is_closed: h.isClosed,
        start_time: h.startTime,
        end_time: h.endTime,
      })),
    });
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("public business lookup failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
