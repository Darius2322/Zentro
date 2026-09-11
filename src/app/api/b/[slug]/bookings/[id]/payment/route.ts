import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  status: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]),
  method: z.string().max(50).optional(),
  provider_ref: z.string().max(200).optional(),
});

/**
 * This endpoint is the ONLY way a booking's payment status changes today.
 * There is deliberately no client-settable "paid" flag anywhere else —
 * when a real payment provider is wired in, its webhook handler should
 * call the same underlying update, not a separate path (spec #26/#51:
 * "Do not mark a transaction as paid simply because the frontend says it
 * was paid.").
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { session, business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment update." }, { status: 400 });

    const payment = await prisma.payment.findFirst({
      where: { bookingId: params.id, businessId: business.id },
    });
    if (!payment) return NextResponse.json({ error: "Payment record not found." }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: parsed.data.status,
          method: parsed.data.method,
          providerRef: parsed.data.provider_ref,
        },
      });
      await tx.auditLog.create({
        data: {
          businessId: business.id,
          actorId: session.userId,
          actorRole: session.role,
          action: "payment.updated",
          targetType: "Payment",
          targetId: payment.id,
          metadata: { status: parsed.data.status, method: parsed.data.method },
        },
      });
      return result;
    });

    return NextResponse.json({ payment: updated });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
