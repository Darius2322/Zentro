import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin, toErrorResponse } from "@/lib/rbac";
import { transitionBusinessStatus, TransitionError } from "@/lib/businessLifecycle";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePlatformAdmin();
    const business = await transitionBusinessStatus(params.id, "reactivate", session.userId);
    return NextResponse.json({ id: business.id, status: business.status });
  } catch (err) {
    if (err instanceof TransitionError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
