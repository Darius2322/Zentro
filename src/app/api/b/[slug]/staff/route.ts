import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, [
      "BUSINESS_OWNER",
      "STAFF",
      "PLATFORM_ADMIN",
    ]);
    const staff = await prisma.staff.findMany({
      where: { businessId: business.id },
      include: {
        qualifiedServices: { include: { service: { select: { id: true, name: true } } } },
        workingHours: true,
        breaks: true,
        user: { select: { id: true } }, // presence of `user` = invitation accepted
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      staff: staff.map((s) => ({
        id: s.id,
        full_name: s.fullName,
        email: s.email,
        title: s.title,
        is_active: s.isActive,
        account_activated: Boolean(s.user),
        qualified_services: s.qualifiedServices.map((qs) => qs.service),
        working_hours: s.workingHours,
        breaks: s.breaks,
      })),
    });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
