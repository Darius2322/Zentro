import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

const bodySchema = z.object({
  business_name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug may only contain lowercase letters, numbers, and hyphens."),
  owner_full_name: z.string().min(2).max(200),
  owner_email: z.string().email(),
  owner_password: z.string().min(10, "Password must be at least 10 characters."),
  phone: z.string().min(6).max(32).optional(),
  description: z.string().max(2000).optional(),
});

/**
 * Business registration (spec #3). This endpoint can NEVER produce an
 * ACTIVE business — status is hardcoded to PENDING regardless of anything
 * in the request body, and there is no other code path anywhere that flips
 * a business to ACTIVE except the platform admin approval endpoint.
 */
export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid registration data." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existingSlug = await prisma.business.findUnique({ where: { slug: data.slug } });
  if (existingSlug) {
    return NextResponse.json({ error: "That business URL is already taken." }, { status: 409 });
  }
  const existingEmail = await prisma.user.findUnique({ where: { email: data.owner_email.toLowerCase() } });
  if (existingEmail) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hashPassword(data.owner_password);

  const result = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.create({
      data: {
        email: data.owner_email.toLowerCase(),
        passwordHash,
        fullName: data.owner_full_name,
        role: "BUSINESS_OWNER",
      },
    });

    const business = await tx.business.create({
      data: {
        slug: data.slug,
        name: data.business_name,
        status: "PENDING", // hardcoded — see comment above
        ownerUserId: owner.id,
        phone: data.phone,
        description: data.description,
      },
    });

    await tx.auditLog.create({
      data: {
        businessId: business.id,
        actorId: owner.id,
        actorRole: "BUSINESS_OWNER",
        action: "business.application_submitted",
        targetType: "Business",
        targetId: business.id,
      },
    });

    return business;
  });

  return NextResponse.json(
    {
      status: "PENDING",
      message:
        "Your application has been submitted and is awaiting review. You'll be notified once it's approved.",
      slug: result.slug,
    },
    { status: 201 }
  );
}
