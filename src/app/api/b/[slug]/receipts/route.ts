import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER", "PLATFORM_ADMIN"]);
    const q = req.nextUrl.searchParams.get("q")?.trim();

    const receipts = await prisma.receipt.findMany({
      where: {
        businessId: business.id,
        ...(q
          ? {
              OR: [
                { receiptNumber: { contains: q, mode: "insensitive" } },
                { booking: { customer: { fullName: { contains: q, mode: "insensitive" } } } },
              ],
            }
          : {}),
      },
      include: {
        booking: { include: { customer: { select: { fullName: true } }, staff: { select: { fullName: true } } } },
        payment: { select: { status: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      receipts: receipts.map((r) => ({
        receipt_number: r.receiptNumber,
        customer_name: r.booking.customer.fullName,
        service_name: r.booking.serviceNameSnapshot,
        total_cents: r.totalCents,
        currency: r.currency,
        payment_status: r.payment?.status ?? "PENDING",
        issued_at: r.issuedAt.toISOString(),
      })),
    });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
