import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sealData } from "iron-session";
import { verifyCredentials } from "@/lib/auth";
import { getSession } from "@/lib/session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Deliberately no rate-limit bypass, no "remember this device" shortcuts,
// and no separate recovery path here beyond the standard password reset —
// this endpoint guards the highest-privilege role on the platform.
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = await verifyCredentials(parsed.data.email, parsed.data.password);
  if (!user || user.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  // If 2FA is enabled, the password alone is not enough — a short-lived,
  // signed challenge is issued instead of a session, and the session is
  // only created after a valid TOTP code is presented (see /2fa/verify).
  if (user.twoFactorEnabled) {
    const challenge = await sealData(
      { userId: user.id },
      { password: process.env.SESSION_SECRET!, ttl: 300 }
    );
    return NextResponse.json({ requires_2fa: true, challenge });
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = "PLATFORM_ADMIN";
  session.email = user.email;
  session.fullName = user.fullName;
  await session.save();

  return NextResponse.json({ role: "PLATFORM_ADMIN", full_name: user.fullName });
}

