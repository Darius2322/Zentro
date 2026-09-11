import { NextRequest, NextResponse } from "next/server";
import { resolveBusinessBySlug, TenantError } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const business = await resolveBusinessBySlug(params.slug);
    if (business.status !== "ACTIVE") {
      return NextResponse.json({ services: [] });
    }

    const services = await prisma.service.findMany({
      where: { businessId: business.id, isActive: true },
      include: {
        category: { select: { name: true } },
        qualifiedStaff: { include: { staff: { select: { id: true, fullName: true, isActive: true } } } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        image_url: s.imageUrl,
        price_cents: s.priceCents,
        currency: s.currency,
        duration_minutes: s.durationMinutes,
        category: s.category?.name ?? null,
        staff: s.qualifiedStaff
          .filter((qs) => qs.staff.isActive)
          .map((qs) => ({ id: qs.staff.id, full_name: qs.staff.fullName })),
      })),
    });
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("public services lookup failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
