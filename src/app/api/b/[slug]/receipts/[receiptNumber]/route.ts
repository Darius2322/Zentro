import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { serializeReceipt } from "@/lib/receipt";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; receiptNumber: string } }
) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER", "STAFF", "PLATFORM_ADMIN"]);
    const receipt = await prisma.receipt.findFirst({
      where: { receiptNumber: params.receiptNumber, businessId: business.id },
      include: {
        booking: { include: { customer: true, staff: true } },
        payment: true,
      },
    });
    if (!receipt) return NextResponse.json({ error: "Receipt not found." }, { status: 404 });

    return NextResponse.json({ receipt: serializeReceipt(receipt, business) });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
