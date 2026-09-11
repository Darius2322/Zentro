import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unsealData } from "iron-session";
import { getSession } from "@/lib/session";
import { decryptSecret } from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  challenge: z.string().min(1),
  code: z.string().min(6).max(6),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  let userId: string;
  try {
    const data = await unsealData<{ userId: string }>(parsed.data.challenge, {
      password: process.env.SESSION_SECRET!,
    });
    userId = data.userId;
  } catch {
    return NextResponse.json({ error: "This login attempt has expired. Please sign in again." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "PLATFORM_ADMIN" || !user.twoFactorEnabled || !user.twoFactorSecretEncrypted) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  const secret = decryptSecret(user.twoFactorSecretEncrypted);
  if (!verifyTotp(secret, parsed.data.code)) {
    return NextResponse.json({ error: "Incorrect code." }, { status: 401 });
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = "PLATFORM_ADMIN";
  session.email = user.email;
  session.fullName = user.fullName;
  await session.save();

  return NextResponse.json({ role: "PLATFORM_ADMIN", full_name: user.fullName });
}
