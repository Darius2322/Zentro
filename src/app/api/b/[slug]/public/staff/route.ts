import { NextRequest, NextResponse } from "next/server";
import { resolveBusinessBySlug, TenantError } from "@/lib/tenant";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const business = await resolveBusinessBySlug(params.slug);
    if (business.status !== "ACTIVE") {
      return NextResponse.json({ staff: [] });
    }

    const staff = await prisma.staff.findMany({
      where: { businessId: business.id, isActive: true },
      include: { qualifiedServices: { include: { service: { select: { id: true, name: true, isActive: true } } } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      staff: staff.map((s) => ({
        id: s.id,
        full_name: s.fullName,
        title: s.title,
        services: s.qualifiedServices.filter((qs) => qs.service.isActive).map((qs) => qs.service),
      })),
    });
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("public staff lookup failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
