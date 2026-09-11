import { NextRequest, NextResponse } from "next/server";
import { resolveBusinessBySlug, TenantError } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { serializeReceipt } from "@/lib/receipt";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const business = await resolveBusinessBySlug(params.slug);
    const reference = req.nextUrl.searchParams.get("reference");
    const phone = req.nextUrl.searchParams.get("phone");
    if (!reference || !phone) {
      return NextResponse.json({ error: "Booking reference and phone number are required." }, { status: 400 });
    }

    const receipt = await prisma.receipt.findFirst({
      where: {
        businessId: business.id,
        booking: { bookingReference: reference.trim().toUpperCase(), customer: { phone: phone.trim() } },
      },
      include: { booking: { include: { customer: true, staff: true } }, payment: true },
    });

    if (!receipt) {
      return NextResponse.json(
        { error: "We couldn't find a receipt with that reference and phone number." },
        { status: 404 }
      );
    }

    return NextResponse.json({ receipt: serializeReceipt(receipt, business) });
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("public receipt lookup failed", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
