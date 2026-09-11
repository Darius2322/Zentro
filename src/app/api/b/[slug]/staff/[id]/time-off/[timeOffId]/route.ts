import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; id: string; timeOffId: string } }
) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const timeOff = await prisma.staffTimeOff.findFirst({
      where: { id: params.timeOffId, staff: { businessId: business.id, id: params.id } },
    });
    if (!timeOff) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await prisma.staffTimeOff.delete({ where: { id: params.timeOffId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
