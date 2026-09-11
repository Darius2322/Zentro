import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { exchangeCodeForTokens } from "@/lib/googleCalendar";
import { encryptSecret } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Google redirects the browser here after consent. The tokens Google
 * returns are encrypted immediately (AES-256-GCM, src/lib/auth.ts) before
 * being written to the database — they are never sent to the client, and
 * never appear in a redirect URL or log line.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateRaw = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (!code || !stateRaw) {
    return NextResponse.json({ error: "Missing code or state." }, { status: 400 });
  }

  let state: { businessId: string; slug: string };
  try {
    state = await unsealData(stateRaw, { password: process.env.SESSION_SECRET! });
  } catch {
    return NextResponse.json({ error: "This connection attempt has expired. Please try again." }, { status: 400 });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      // Google omits refresh_token on repeat consents unless prompt=consent
      // forced re-approval (which we do), but guard anyway rather than
      // silently storing a connection that can't refresh itself later.
      throw new Error("Google did not return a refresh token. Please try connecting again.");
    }

    await prisma.externalCalendarConnection.create({
      data: {
        businessId: state.businessId,
        provider: "google",
        encryptedAccessToken: encryptSecret(tokens.access_token),
        encryptedRefreshToken: encryptSecret(tokens.refresh_token),
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        calendarId: "primary",
      },
    });

    await prisma.auditLog.create({
      data: { businessId: state.businessId, action: "calendar.connected", targetType: "ExternalCalendarConnection" },
    });

    return NextResponse.redirect(new URL(`/b/${state.slug}/manage/settings`, req.url));
  } catch (err) {
    console.error("Google Calendar connection failed", err);
    return NextResponse.redirect(new URL(`/b/${state.slug}/manage/settings?calendar_error=1`, req.url));
  }
}
