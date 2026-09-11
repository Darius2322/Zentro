import { PrismaClient } from "@prisma/client";

// Standard Next.js singleton pattern to avoid exhausting DB connections
// during dev hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Runs `fn` inside a transaction with Postgres session variables set for Row
 * Level Security (see prisma/migrations_manual/001_double_booking_protection.sql).
 *
 * This is the ONLY place tenant context is bound to a DB session. Every
 * business-scoped API route must go through this so that even a forgotten
 * `where: { businessId }` clause in application code still gets stopped by
 * the database's RLS policies.
 */
export async function withTenantContext<T>(
  ctx: { businessId: string | null; role: string },
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // set_config with is_local=true scopes these to the current transaction only.
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_role', $1, true)`, ctx.role);
    await tx.$executeRawUnsafe(
      `SELECT set_config('app.current_business_id', $1, true)`,
      ctx.businessId ?? ""
    );
    return fn(tx);
  });
}
