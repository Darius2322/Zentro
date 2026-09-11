import { NextRequest, NextResponse } from "next/server";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { business } = await requireBusinessMember(params.slug, [
      "BUSINESS_OWNER",
      "STAFF",
      "PLATFORM_ADMIN",
    ]);

    const search = req.nextUrl.searchParams.get("q")?.trim();

    const customers = await prisma.customer.findMany({
      where: {
        businessId: business.id,
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        bookings: {
          orderBy: { startsAt: "desc" },
          take: 1,
          select: { startsAt: true, status: true },
        },
        _count: { select: { bookings: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      customers: customers.map((c) => ({
        id: c.id,
        full_name: c.fullName,
        phone: c.phone,
        email: c.email,
        total_appointments: c._count.bookings,
        last_appointment: c.bookings[0]?.startsAt.toISOString() ?? null,
      })),
    });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
