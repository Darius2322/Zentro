import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, [
      "BUSINESS_OWNER",
      "STAFF",
      "PLATFORM_ADMIN",
    ]);
    const resourceTypes = await prisma.resourceType.findMany({
      where: { businessId: business.id },
      include: { resources: true },
    });
    return NextResponse.json({ resource_types: resourceTypes });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  initial_resource_names: z.array(z.string().min(1).max(100)).default([]),
});

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid resource type." }, { status: 400 });
    const d = parsed.data;

    const resourceType = await prisma.resourceType.create({
      data: {
        businessId: business.id,
        name: d.name,
        resources: { create: d.initial_resource_names.map((name) => ({ businessId: business.id, name })) },
      },
      include: { resources: true },
    });

    return NextResponse.json({ resource_type: resourceType }, { status: 201 });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
