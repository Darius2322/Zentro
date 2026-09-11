import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { slug: string; connectionId: string } }
) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const connection = await prisma.externalCalendarConnection.findFirst({
      where: { id: params.connectionId, businessId: business.id },
    });
    if (!connection) return NextResponse.json({ error: "Not found." }, { status: 404 });

    await prisma.externalCalendarConnection.delete({ where: { id: connection.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
