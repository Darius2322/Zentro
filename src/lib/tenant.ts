import { prisma } from "./db";
import type { Business } from "@prisma/client";

export class TenantError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Resolves a business by its public slug. The slug is ONLY an identifier —
 * never an authorization mechanism (spec #57). Callers still must check the
 * authenticated session's businessId against business.id before allowing
 * any protected action.
 */
export async function resolveBusinessBySlug(slug: string): Promise<Business> {
  const business = await prisma.business.findUnique({ where: { slug } });
  if (!business) throw new TenantError("Business not found.", 404);
  return business;
}

/**
 * Gate for the dedicated per-business login page (spec #5). A suspended or
 * rejected business must not present a working login, even to its own
 * owner/staff.
 */
export function assertLoginAllowed(business: Business) {
  if (business.status === "SUSPENDED") {
    throw new TenantError("This business account has been suspended.", 403);
  }
  if (business.status === "REJECTED") {
    throw new TenantError("This business is not active on the platform.", 403);
  }
  if (business.status === "PENDING") {
    throw new TenantError("This business's application is still awaiting approval.", 403);
  }
}

/** Gate for any action that requires the business to be fully operational. */
export function assertBusinessActive(business: Business) {
  if (business.status !== "ACTIVE") {
    throw new TenantError("This business is not currently active.", 403);
  }
}
