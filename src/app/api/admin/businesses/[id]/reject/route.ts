import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin, toErrorResponse } from "@/lib/rbac";
import { transitionBusinessStatus, TransitionError } from "@/lib/businessLifecycle";

const bodySchema = z.object({ reason: z.string().max(1000).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePlatformAdmin();
    const { reason } = bodySchema.parse(await req.json().catch(() => ({})));
    const business = await transitionBusinessStatus(params.id, "reject", session.userId, reason);
    return NextResponse.json({ id: business.id, status: business.status });
  } catch (err) {
    if (err instanceof TransitionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
