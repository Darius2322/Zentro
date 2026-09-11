import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import type { BusinessStatus } from "@prisma/client";

const VALID_STATUSES: BusinessStatus[] = ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"];

export async function GET(req: NextRequest) {
  try {
    await requirePlatformAdmin();

    const statusParam = req.nextUrl.searchParams.get("status");
    const status =
      statusParam && VALID_STATUSES.includes(statusParam as BusinessStatus)
        ? (statusParam as BusinessStatus)
        : undefined;

    const [businesses, counts] = await Promise.all([
      prisma.business.findMany({
        where: status ? { status } : undefined,
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          phone: true,
          submittedAt: true,
          reviewedAt: true,
          owner: { select: { fullName: true, email: true } },
        },
        take: 100,
      }),
      // Real counts from the database — never fabricated (spec #2).
      prisma.business.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const countByStatus = Object.fromEntries(VALID_STATUSES.map((s) => [s, 0])) as Record<
      BusinessStatus,
      number
    >;
    for (const c of counts) countByStatus[c.status] = c._count._all;

    return NextResponse.json({
      businesses,
      counts: {
        total: Object.values(countByStatus).reduce((a, b) => a + b, 0),
        ...countByStatus,
      },
    });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
