import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  status: z.enum(["AVAILABLE", "MAINTENANCE", "RETIRED"]).optional(),
  name: z.string().min(1).max(100).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const existing = await prisma.resource.findFirst({ where: { id: params.id, businessId: business.id } });
    if (!existing) return NextResponse.json({ error: "Resource not found." }, { status: 404 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

    const resource = await prisma.resource.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json({ resource });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
