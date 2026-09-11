import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { resolveBusinessBySlug, assertLoginAllowed, TenantError } from "@/lib/tenant";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Login for a SPECIFIC business's owner/staff (spec #5, #6). This is
 * intentionally separate from the platform admin login. A valid
 * email+password is not enough on its own: the authenticated user must
 * actually belong to THIS business as its owner or as active staff, or the
 * login is rejected even though the credentials were correct.
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const business = await resolveBusinessBySlug(params.slug);
    assertLoginAllowed(business);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const user = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!user) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }

    const isOwner = business.ownerUserId === user.id && user.role === "BUSINESS_OWNER";
    const staffRecord = !isOwner
      ? await prisma.staff.findFirst({
          where: { businessId: business.id, userId: user.id, isActive: true },
        })
      : null;

    if (!isOwner && !staffRecord) {
      // Deliberately generic: don't reveal whether the email exists at all,
      // or exists but belongs to a different business.
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }

    const session = await getSession();
    session.userId = user.id;
    session.role = isOwner ? "BUSINESS_OWNER" : "STAFF";
    session.businessId = business.id;
    session.email = user.email;
    session.fullName = user.fullName;
    await session.save();

    return NextResponse.json({
      role: session.role,
      business: { slug: business.slug, name: business.name },
      full_name: user.fullName,
    });
  } catch (err) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("business login failed", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
