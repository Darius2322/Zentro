import { NextRequest, NextResponse } from "next/server";
import { hashToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const tokenHash = hashToken(params.token);

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { business: { select: { name: true, logoUrl: true } }, staff: { select: { fullName: true } } },
  });

  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    // Identical response whether the token is unknown, already used, or
    // expired — no information is leaked about which case applies.
    return NextResponse.json({ error: "This invitation link is invalid or has expired." }, { status: 404 });
  }

  return NextResponse.json({
    business_name: invitation.business.name,
    business_logo_url: invitation.business.logoUrl,
    staff_name: invitation.staff.fullName,
    email: invitation.email,
  });
}
