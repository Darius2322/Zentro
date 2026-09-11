import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hashToken, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  password: z.string().min(10, "Password must be at least 10 characters."),
});

/**
 * Activates a staff invitation (spec #7). Security properties enforced here:
 *  - The token is looked up only by its hash; the raw token is never stored.
 *  - The transition PENDING -> ACCEPTED is done with a conditional
 *    `updateMany` inside a transaction, so two simultaneous accept attempts
 *    on the same link cannot both succeed (one-time use, even under a race).
 *  - Expired invitations are rejected even if the token is otherwise valid.
 *  - The created User's role is HARDCODED to STAFF. Nothing in this code
 *    path can ever produce a BUSINESS_OWNER or PLATFORM_ADMIN account.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const tokenHash = hashToken(params.token);
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const claim = await tx.invitation.updateMany({
        where: { tokenHash, status: "PENDING", expiresAt: { gt: new Date() } },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (claim.count === 0) {
        throw new Error("INVALID_OR_USED");
      }

      const invitation = await tx.invitation.findUniqueOrThrow({ where: { tokenHash } });

      const existingUser = await tx.user.findUnique({ where: { email: invitation.email } });
      const user =
        existingUser ??
        (await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash,
            fullName: (await tx.staff.findUniqueOrThrow({ where: { id: invitation.staffId } })).fullName,
            role: "STAFF", // hardcoded — see doc comment above
          },
        }));

      await tx.staff.update({
        where: { id: invitation.staffId },
        data: { userId: user.id },
      });

      await tx.auditLog.create({
        data: {
          businessId: invitation.businessId,
          actorId: user.id,
          actorRole: "STAFF",
          action: "staff.invitation_accepted",
          targetType: "Staff",
          targetId: invitation.staffId,
        },
      });

      return { businessId: invitation.businessId, businessSlug: (await tx.business.findUniqueOrThrow({ where: { id: invitation.businessId } })).slug };
    });

    return NextResponse.json({ ok: true, business_id: result.businessId, business_slug: result.businessSlug });
  } catch (err: any) {
    if (err?.message === "INVALID_OR_USED") {
      return NextResponse.json(
        { error: "This invitation link is invalid, expired, or has already been used." },
        { status: 400 }
      );
    }
    console.error("invitation acceptance failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
