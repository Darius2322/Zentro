import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { assertBusinessActive } from "@/lib/tenant";
import { generateInvitationToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  full_name: z.string().min(2).max(200),
  email: z.string().email(),
  title: z.string().max(100).optional(),
  service_ids: z.array(z.string()).optional(),
});

const INVITATION_TTL_HOURS = 72;

/**
 * Staff invitation creation (spec #6/#7). Only BUSINESS_OWNER may invite —
 * staff can never invite other staff, and this endpoint has no code path
 * that can grant anything other than the STAFF role on acceptance.
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { session, business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    assertBusinessActive(business);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid invitation details." }, { status: 400 });
    }
    const data = parsed.data;

    const existingStaff = await prisma.staff.findFirst({
      where: { businessId: business.id, email: data.email.toLowerCase() },
    });
    if (existingStaff) {
      return NextResponse.json(
        { error: "A staff member with that email already exists for this business." },
        { status: 409 }
      );
    }

    const { raw, hash } = generateInvitationToken();

    const result = await prisma.$transaction(async (tx) => {
      const staff = await tx.staff.create({
        data: {
          businessId: business.id,
          fullName: data.full_name,
          email: data.email.toLowerCase(),
          title: data.title,
          qualifiedServices: data.service_ids
            ? { create: data.service_ids.map((serviceId) => ({ serviceId })) }
            : undefined,
        },
      });

      const invitation = await tx.invitation.create({
        data: {
          businessId: business.id,
          staffId: staff.id,
          email: data.email.toLowerCase(),
          invitedById: session.userId,
          tokenHash: hash,
          expiresAt: new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000),
        },
      });

      await tx.auditLog.create({
        data: {
          businessId: business.id,
          actorId: session.userId,
          actorRole: "BUSINESS_OWNER",
          action: "staff.invited",
          targetType: "Staff",
          targetId: staff.id,
        },
      });

      return { staff, invitation };
    });

    // The raw token is returned exactly once, to the authenticated owner who
    // requested it, and is never stored anywhere (only its hash is). In
    // production this should instead be emailed directly to the invitee
    // (spec #7); it's surfaced here too so the demo/dev flow is usable
    // without an email provider configured.
    return NextResponse.json(
      {
        staff_id: result.staff.id,
        invitation_link: `/invitations/${raw}`,
        expires_at: result.invitation.expiresAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
