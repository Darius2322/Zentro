import { getSession } from "./session";
import { resolveBusinessBySlug } from "./tenant";
import type { PlatformRole, Business } from "@prisma/client";

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Any authenticated user, regardless of role. */
export async function requireUser() {
  const session = await getSession();
  if (!session.userId) throw new AuthError("Authentication required.", 401);
  return session;
}

export async function requirePlatformAdmin() {
  const session = await requireUser();
  if (session.role !== "PLATFORM_ADMIN") {
    throw new AuthError("This action requires platform administrator access.", 403);
  }
  return session;
}

/**
 * The central tenant-authorization check (spec #8, #9, #57, #88).
 *
 * Resolves the business from the URL slug, then verifies:
 *   1. The caller is authenticated.
 *   2. The caller's role is one of `allowedRoles`.
 *   3. The caller's SESSION-derived businessId (set at login from the DB,
 *      never from client input) matches the business resolved from the
 *      slug. A staff/owner session for Business A can never pass this
 *      check for Business B's slug, no matter what the URL says.
 *
 * PLATFORM_ADMIN is exempt from the business-match check by design, since
 * admins operate across tenants — but only on admin-designated routes that
 * explicitly include PLATFORM_ADMIN in allowedRoles.
 */
export async function requireBusinessMember(
  slug: string,
  allowedRoles: PlatformRole[]
): Promise<{ session: Awaited<ReturnType<typeof getSession>>; business: Business }> {
  const session = await requireUser();
  const business = await resolveBusinessBySlug(slug);

  if (!allowedRoles.includes(session.role)) {
    throw new AuthError("You do not have permission to perform this action.", 403);
  }

  if (session.role !== "PLATFORM_ADMIN" && session.businessId !== business.id) {
    throw new AuthError("You do not have access to this business.", 403);
  }

  if (session.role !== "PLATFORM_ADMIN" && business.status === "SUSPENDED") {
    throw new AuthError("This business account has been suspended.", 403);
  }

  return { session, business };
}

/** Converts an AuthError/TenantError into a JSON response body + status. */
export function toErrorResponse(err: unknown): { body: { error: string }; status: number } {
  if (err instanceof AuthError) return { body: { error: err.message }, status: err.status };
  // Duck-type TenantError to avoid a circular import with tenant.ts.
  if (err && typeof err === "object" && "status" in err && "message" in err) {
    return { body: { error: String((err as any).message) }, status: Number((err as any).status) };
  }
  console.error("Unhandled error", err);
  return { body: { error: "Something went wrong. Please try again." }, status: 500 };
}
