import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin, toErrorResponse } from "@/lib/rbac";
import { decryptSecret } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { prisma } from "@/lib/db";

const bodySchema = z.object({ code: z.string().min(6).max(6) });

export async function POST(req: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Enter the 6-digit code." }, { status: 400 });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    if (!user.twoFactorEnabled || !user.twoFactorSecretEncrypted) {
      return NextResponse.json({ error: "2FA is not enabled." }, { status: 400 });
    }

    const secret = decryptSecret(user.twoFactorSecretEncrypted);
    if (!verifyTotp(secret, parsed.data.code)) {
      return NextResponse.json({ error: "Incorrect code." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecretEncrypted: null },
    });
    await prisma.auditLog.create({
      data: { actorId: user.id, actorRole: "PLATFORM_ADMIN", action: "admin.2fa_disabled" },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
