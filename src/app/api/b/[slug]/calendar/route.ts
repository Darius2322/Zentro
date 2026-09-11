import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const connections = await prisma.externalCalendarConnection.findMany({
      where: { businessId: business.id },
      select: { id: true, provider: true, calendarId: true, isActive: true, tokenExpiresAt: true },
    });
    return NextResponse.json({ connections });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
