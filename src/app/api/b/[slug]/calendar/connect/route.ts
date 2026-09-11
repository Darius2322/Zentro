import { NextRequest, NextResponse } from "next/server";
import { sealData } from "iron-session";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { buildGoogleAuthUrl } from "@/lib/googleCalendar";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);

    // The state param round-trips through Google unmodified. Sealing it
    // (rather than passing the businessId in plaintext) means the callback
    // can trust the businessId it contains without a separate DB lookup,
    // and a tampered state value fails to unseal rather than silently
    // attaching the connection to the wrong business.
    const state = await sealData(
      { businessId: business.id, slug: params.slug },
      { password: process.env.SESSION_SECRET!, ttl: 600 }
    );

    return NextResponse.redirect(buildGoogleAuthUrl(state));
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
