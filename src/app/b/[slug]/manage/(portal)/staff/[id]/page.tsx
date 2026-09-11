import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveBusinessBySlug } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { StaffHoursForm } from "@/components/StaffHoursForm";
import { TimeOffManager } from "@/components/TimeOffManager";

export default async function StaffDetailPage({ params }: { params: { slug: string; id: string } }) {
  const business = await resolveBusinessBySlug(params.slug);
  const staff = await prisma.staff.findFirst({
    where: { id: params.id, businessId: business.id },
    include: {
      workingHours: true,
      breaks: true,
      timeOff: { orderBy: { startsAt: "desc" } },
      qualifiedServices: { include: { service: true } },
    },
  });
  if (!staff) notFound();

  return (
    <div>
      <Link className="btn btn-secondary btn-small" href={`/b/${params.slug}/manage/staff`} style={{ marginBottom: 16, display: "inline-flex" }}>
        ← All staff
      </Link>
      <h1>{staff.fullName}</h1>
      <p className="page-subtitle">{staff.title ?? "Staff member"} · {staff.email}</p>

      <h2>Qualified services</h2>
      <p className="page-subtitle" style={{ marginTop: -8 }}>
        {staff.qualifiedServices.length > 0
          ? staff.qualifiedServices.map((qs) => qs.service.name).join(", ")
          : "None assigned yet — edit from the Services page."}
      </p>

      <h2>Working hours</h2>
      <StaffHoursForm
        slug={params.slug}
        staffId={staff.id}
        initialHours={staff.workingHours.map((h) => ({
          weekday: h.weekday,
          is_off: h.isOff,
          start_time: h.startTime ?? "09:00",
          end_time: h.endTime ?? "17:00",
        }))}
      />

      <h2 style={{ marginTop: 32 }}>Leave</h2>
      <TimeOffManager
        slug={params.slug}
        staffId={staff.id}
        initial={staff.timeOff.map((t) => ({
          id: t.id,
          type: t.type,
          startsAt: t.startsAt.toISOString(),
          endsAt: t.endsAt.toISOString(),
          note: t.note,
        }))}
      />
    </div>
  );
}
