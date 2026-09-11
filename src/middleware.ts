import { NextRequest, NextResponse } from "next/server";
import { isAllowed } from "@/lib/rateLimit";

// Route-specific limits. Login endpoints are tightest (brute-force
// protection, spec #55/#56); booking creation is looser since legitimate
// customers can retry after a "slot taken" conflict.
const RULES: { pattern: RegExp; limit: number; windowMs: number }[] = [
  { pattern: /^\/api\/admin\/auth\/login$/, limit: 5, windowMs: 5 * 60 * 1000 },
  { pattern: /^\/api\/admin\/auth\/2fa\//, limit: 8, windowMs: 5 * 60 * 1000 },
  { pattern: /^\/api\/b\/[^/]+\/auth\/login$/, limit: 8, windowMs: 5 * 60 * 1000 },
  { pattern: /^\/api\/invitations\/[^/]+\/accept$/, limit: 10, windowMs: 15 * 60 * 1000 },
  { pattern: /^\/api\/businesses\/register$/, limit: 5, windowMs: 60 * 60 * 1000 },
  { pattern: /^\/api\/bookings$/, limit: 30, windowMs: 10 * 60 * 1000 },
  { pattern: /^\/api\/b\/[^/]+\/public\/track$/, limit: 20, windowMs: 10 * 60 * 1000 },
];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const rule = RULES.find((r) => r.pattern.test(path));
  if (!rule) return NextResponse.next();

  // x-forwarded-for is set by Vercel's edge network; falls back to a
  // constant key locally (effectively disabling per-IP granularity in dev).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const key = `${ip}:${path}`;

  if (!isAllowed(key, rule.limit, rule.windowMs)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/admin/auth/:path*",
    "/api/b/:slug/auth/login",
    "/api/invitations/:token/accept",
    "/api/businesses/register",
    "/api/bookings",
    "/api/b/:slug/public/track",
  ],
};
