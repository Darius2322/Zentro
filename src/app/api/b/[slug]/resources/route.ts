import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  resource_type_id: z.string(),
  name: z.string().min(1).max(100),
});

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid resource." }, { status: 400 });
    const d = parsed.data;

    const resourceType = await prisma.resourceType.findFirst({
      where: { id: d.resource_type_id, businessId: business.id },
    });
    if (!resourceType) return NextResponse.json({ error: "Resource type not found." }, { status: 404 });

    const resource = await prisma.resource.create({
      data: { businessId: business.id, resourceTypeId: d.resource_type_id, name: d.name },
    });
    return NextResponse.json({ resource }, { status: 201 });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
