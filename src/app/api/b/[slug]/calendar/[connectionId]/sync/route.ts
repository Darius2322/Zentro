import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/auth";
import { fetchFreeBusy, refreshAccessToken } from "@/lib/googleCalendar";

const SYNC_WINDOW_DAYS = 60;

/**
 * No cron/scheduler exists in this codebase, so syncing is triggered
 * manually from the settings page for now. In production this should also
 * run on a schedule (e.g. hourly via Vercel Cron hitting this same route
 * for every active connection) so availability reflects external calendar
 * changes without the owner remembering to click "Sync".
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: { slug: string; connectionId: string } }
) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const connection = await prisma.externalCalendarConnection.findFirst({
      where: { id: params.connectionId, businessId: business.id, isActive: true },
    });
    if (!connection) return NextResponse.json({ error: "Connection not found." }, { status: 404 });

    let accessToken = decryptSecret(connection.encryptedAccessToken);

    // Refresh if the token is expired or expiring within the next minute.
    if (connection.tokenExpiresAt.getTime() < Date.now() + 60_000) {
      const refreshToken = decryptSecret(connection.encryptedRefreshToken);
      const refreshed = await refreshAccessToken(refreshToken);
      accessToken = refreshed.access_token;
      await prisma.externalCalendarConnection.update({
        where: { id: connection.id },
        data: {
          encryptedAccessToken: encryptSecret(refreshed.access_token),
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
    }

    const timeMin = new Date();
    const timeMax = new Date(Date.now() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const busyPeriods = await fetchFreeBusy(accessToken, connection.calendarId, timeMin, timeMax);

    await prisma.$transaction([
      prisma.externalCalendarBusyPeriod.deleteMany({ where: { connectionId: connection.id } }),
      prisma.externalCalendarBusyPeriod.createMany({
        data: busyPeriods.map((b) => ({ connectionId: connection.id, startsAt: b.start, endsAt: b.end })),
      }),
    ]);

    return NextResponse.json({ ok: true, synced: busyPeriods.length });
  } catch (err) {
    console.error("calendar sync failed", err);
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
