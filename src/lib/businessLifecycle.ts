import { prisma } from "./db";
import type { BusinessStatus } from "@prisma/client";

export class TransitionError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const ALLOWED_TRANSITIONS: Record<string, BusinessStatus[]> = {
  approve: ["PENDING"],
  reject: ["PENDING"],
  suspend: ["ACTIVE"],
  reactivate: ["SUSPENDED"],
};

/**
 * Enforces the state machine from spec #3: a business cannot be approved
 * twice, rejected after already being active, suspended before it was ever
 * approved, etc. This is checked server-side regardless of what the admin
 * UI might allow someone to click.
 */
export async function transitionBusinessStatus(
  businessId: string,
  action: "approve" | "reject" | "suspend" | "reactivate",
  adminUserId: string,
  reason?: string
) {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new TransitionError("Business not found.", 404);

  const allowedFrom = ALLOWED_TRANSITIONS[action];
  if (!allowedFrom.includes(business.status)) {
    throw new TransitionError(
      `Cannot ${action} a business with status ${business.status}.`,
      409
    );
  }

  const targetStatus: BusinessStatus =
    action === "approve" ? "ACTIVE" : action === "reject" ? "REJECTED" : action === "suspend" ? "SUSPENDED" : "ACTIVE";

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.business.update({
      where: { id: businessId },
      data: {
        status: targetStatus,
        reviewedAt: action === "approve" || action === "reject" ? new Date() : business.reviewedAt,
        reviewedBy: action === "approve" || action === "reject" ? adminUserId : business.reviewedBy,
        rejectionReason: action === "reject" ? reason : business.rejectionReason,
        suspendedAt: action === "suspend" ? new Date() : action === "reactivate" ? null : business.suspendedAt,
        suspendedReason: action === "suspend" ? reason : action === "reactivate" ? null : business.suspendedReason,
      },
    });

    const auditActionNames: Record<typeof action, string> = {
      approve: "business.approved",
      reject: "business.rejected",
      suspend: "business.suspended",
      reactivate: "business.reactivated",
    };

    await tx.auditLog.create({
      data: {
        businessId,
        actorId: adminUserId,
        actorRole: "PLATFORM_ADMIN",
        action: auditActionNames[action],
        targetType: "Business",
        targetId: businessId,
        metadata: reason ? { reason } : undefined,
      },
    });

    return result;
  });

  return updated;
}
