import { NextResponse } from "next/server";
import { requirePlatformAdmin, toErrorResponse } from "@/lib/rbac";
import { encryptSecret } from "@/lib/auth";
import { generateTotpSecret, totpUri } from "@/lib/totp";
import { prisma } from "@/lib/db";

// Generating a new secret here does NOT enable 2FA yet — that only happens
// once /2fa/enable confirms the admin can actually produce a valid code
// from it, so a broken setup can't silently lock the admin out.
export async function POST() {
  try {
    const session = await requirePlatformAdmin();
    const secret = generateTotpSecret();

    await prisma.user.update({
      where: { id: session.userId },
      data: { twoFactorSecretEncrypted: encryptSecret(secret), twoFactorEnabled: false },
    });

    return NextResponse.json({
      secret,
      otpauth_uri: totpUri(secret, session.email),
    });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
