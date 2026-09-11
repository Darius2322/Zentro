import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessMember, toErrorResponse } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { business } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER", "STAFF", "PLATFORM_ADMIN"]);
    const staff = await prisma.staff.findFirst({ where: { id: params.id, businessId: business.id } });
    if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    const timeOff = await prisma.staffTimeOff.findMany({
      where: { staffId: params.id },
      orderBy: { startsAt: "desc" },
    });
    return NextResponse.json({ time_off: timeOff });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const bodySchema = z.object({
  type: z.enum(["HOLIDAY", "SICK", "PERSONAL", "TRAINING", "CUSTOM"]),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  note: z.string().max(500).optional(),
});

// Adding leave here is exactly what makes the availability engine stop
// offering that staff member's slots during this window (spec #32) — no
// separate "blackout" mechanism exists; StaffTimeOff is the single source
// of truth the engine already reads.
export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { business, session } = await requireBusinessMember(params.slug, ["BUSINESS_OWNER"]);
    const staff = await prisma.staff.findFirst({ where: { id: params.id, businessId: business.id } });
    if (!staff) return NextResponse.json({ error: "Staff member not found." }, { status: 404 });

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid leave details." }, { status: 400 });
    const d = parsed.data;

    if (new Date(d.ends_at) <= new Date(d.starts_at)) {
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    }

    const timeOff = await prisma.staffTimeOff.create({
      data: {
        staffId: params.id,
        type: d.type,
        startsAt: new Date(d.starts_at),
        endsAt: new Date(d.ends_at),
        note: d.note,
      },
    });

    await prisma.auditLog.create({
      data: {
        businessId: business.id,
        actorId: session.userId,
        actorRole: session.role,
        action: "staff.time_off_added",
        targetType: "Staff",
        targetId: params.id,
      },
    });

    return NextResponse.json({ time_off: timeOff }, { status: 201 });
  } catch (err) {
    const { body, status } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
