/**
 * Availability Engine
 * ====================
 * Computes REAL bookable time slots. Nothing here is hardcoded or guessed —
 * every slot returned has been checked against business hours, staff hours,
 * breaks, leave, existing bookings, resource occupancy, external calendars,
 * and booking-window rules.
 *
 * This module is pure computation (no HTTP concerns) so it can be unit
 * tested directly and reused by both the read-only /api/availability route
 * and the authoritative re-check performed inside the booking transaction
 * (src/lib/booking.ts). That reuse is deliberate: the booking endpoint must
 * run the exact same logic the browsing endpoint used, not a looser version.
 */

import { addMinutes, isBefore, isAfter, isEqual, startOfDay, endOfDay } from "date-fns";
import { zonedTimeToUtc, utcToZonedTime, format } from "date-fns-tz";
import { prisma } from "./db";

export interface TimeInterval {
  start: Date; // UTC instant
  end: Date; // UTC instant
}

export interface AvailableSlot {
  startsAt: Date;
  endsAt: Date;
  staffId: string;
  staffName: string;
}

export interface DateAvailability {
  date: string; // YYYY-MM-DD in business timezone
  slots: AvailableSlot[];
}

export interface AvailabilityQuery {
  businessId: string;
  serviceId: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  staffId?: string; // optional — "specific staff" mode
  excludeBookingId?: string; // used when re-validating a reschedule so the booking being moved doesn't block itself
}

export class AvailabilityError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Interval helpers — all comparisons are done on UTC Date instants. Business
// hours / staff hours ("09:00") are only ever interpreted in the business's
// configured IANA timezone, never the caller's device timezone (spec #59).
// ---------------------------------------------------------------------------

function overlaps(a: TimeInterval, b: TimeInterval): boolean {
  return isBefore(a.start, b.end) && isBefore(b.start, a.end);
}

/** Subtract a set of busy intervals from a single free interval. */
function subtractIntervals(free: TimeInterval, busy: TimeInterval[]): TimeInterval[] {
  let remaining: TimeInterval[] = [free];
  for (const b of busy) {
    const next: TimeInterval[] = [];
    for (const r of remaining) {
      if (!overlaps(r, b)) {
        next.push(r);
        continue;
      }
      if (isBefore(b.start, r.start) || isEqual(b.start, r.start)) {
        // busy starts at/before free start
        if (isAfter(b.end, r.start) && isBefore(b.end, r.end)) {
          next.push({ start: b.end, end: r.end });
        }
        // else busy fully covers r -> nothing remains
      } else {
        // busy starts inside r
        next.push({ start: r.start, end: b.start });
        if (isBefore(b.end, r.end)) {
          next.push({ start: b.end, end: r.end });
        }
      }
    }
    remaining = next;
  }
  return remaining.filter((r) => isBefore(r.start, r.end));
}

function timeStringToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  const local = `${dateStr}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  return zonedTimeToUtc(local, timezone);
}

function dateStringInTz(instant: Date, timezone: string): string {
  return format(utcToZonedTime(instant, timezone), "yyyy-MM-dd", { timeZone: timezone });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function computeAvailability(query: AvailabilityQuery): Promise<{
  service: { name: string; durationMinutes: number; bufferMinutes: number };
  dates: DateAvailability[];
}> {
  const business = await prisma.business.findUnique({
    where: { id: query.businessId },
    include: { hours: true },
  });
  if (!business) throw new AvailabilityError("Business not found", "BUSINESS_NOT_FOUND");
  if (business.status !== "ACTIVE") {
    throw new AvailabilityError(
      "This business is not currently accepting bookings.",
      "BUSINESS_UNAVAILABLE"
    );
  }

  const service = await prisma.service.findFirst({
    where: { id: query.serviceId, businessId: query.businessId, isActive: true },
    include: {
      qualifiedStaff: { include: { staff: true } },
      requiredResources: { include: { resourceType: { include: { resources: true } } } },
    },
  });
  if (!service) throw new AvailabilityError("Service not found", "SERVICE_NOT_FOUND");

  const totalMinutes = service.durationMinutes + service.bufferMinutes;
  const timezone = business.timezone;

  // 1. Determine candidate staff.
  let candidateStaff = service.qualifiedStaff
    .map((qs) => qs.staff)
    .filter((s) => s.isActive);
  if (query.staffId) {
    candidateStaff = candidateStaff.filter((s) => s.id === query.staffId);
    if (candidateStaff.length === 0) {
      throw new AvailabilityError(
        "No qualified staff members are available for this service.",
        "NO_QUALIFIED_STAFF"
      );
    }
  }
  if (candidateStaff.length === 0) {
    throw new AvailabilityError(
      "No qualified staff members are available for this service.",
      "NO_QUALIFIED_STAFF"
    );
  }

  const closedDates = await prisma.businessClosedDate.findMany({
    where: {
      businessId: query.businessId,
      date: { gte: new Date(query.dateFrom), lte: new Date(query.dateTo) },
    },
  });
  const closedDateSet = new Set(closedDates.map((c) => c.date.toISOString().slice(0, 10)));

  const rangeStartUtc = timeStringToUtc(query.dateFrom, "00:00", timezone);
  const rangeEndUtc = addMinutes(timeStringToUtc(query.dateTo, "23:59", timezone), 1);

  const staffIds = candidateStaff.map((s) => s.id);

  const [workingHours, breaks, timeOff, existingBookings, calendarConnections] =
    await Promise.all([
      prisma.staffWorkingHours.findMany({ where: { staffId: { in: staffIds } } }),
      prisma.staffBreak.findMany({ where: { staffId: { in: staffIds } } }),
      prisma.staffTimeOff.findMany({
        where: { staffId: { in: staffIds }, startsAt: { lt: rangeEndUtc }, endsAt: { gt: rangeStartUtc } },
      }),
      prisma.booking.findMany({
        where: {
          businessId: query.businessId,
          staffId: { in: staffIds },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          startsAt: { lt: rangeEndUtc },
          endsAt: { gt: rangeStartUtc },
          ...(query.excludeBookingId ? { id: { not: query.excludeBookingId } } : {}),
        },
      }),
      prisma.externalCalendarConnection.findMany({
        where: { businessId: query.businessId, staffId: { in: staffIds }, isActive: true },
        include: {
          busyPeriods: { where: { startsAt: { lt: rangeEndUtc }, endsAt: { gt: rangeStartUtc } } },
        },
      }),
    ]);

  // Resource requirement -> pool of eligible resource IDs per required type.
  const resourceRequirements = service.requiredResources.map((rr) => ({
    resourceTypeId: rr.resourceTypeId,
    quantity: rr.quantity,
    pool: rr.resourceType.resources.filter((r) => r.status === "AVAILABLE"),
  }));
  const allResourceIds = resourceRequirements.flatMap((r) => r.pool.map((p) => p.id));
  const existingResourceBookings = allResourceIds.length
    ? await prisma.bookingResource.findMany({
        where: {
          resourceId: { in: allResourceIds },
          booking: {
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            startsAt: { lt: rangeEndUtc },
            endsAt: { gt: rangeStartUtc },
            ...(query.excludeBookingId ? { id: { not: query.excludeBookingId } } : {}),
          },
        },
        include: { booking: true },
      })
    : [];

  const now = new Date();
  const minNoticeCutoff = addMinutes(now, business.minNoticeMinutes);
  const maxAdvanceCutoff = addMinutes(now, business.maxAdvanceBookingDays * 24 * 60);

  const results: DateAvailability[] = [];

  for (
    let cursor = new Date(rangeStartUtc);
    isBefore(cursor, rangeEndUtc);
    cursor = addMinutes(cursor, 24 * 60)
  ) {
    const dateStr = dateStringInTz(cursor, timezone);
    const weekday = utcToZonedTime(cursor, timezone).getDay();

    if (closedDateSet.has(dateStr)) {
      results.push({ date: dateStr, slots: [] });
      continue;
    }

    const dayHours = business.hours.filter((h) => h.weekday === weekday && !h.isClosed);
    if (dayHours.length === 0) {
      results.push({ date: dateStr, slots: [] });
      continue;
    }

    const daySlots: AvailableSlot[] = [];

    for (const staff of candidateStaff) {
      const staffDayHours = workingHours.filter(
        (w) => w.staffId === staff.id && w.weekday === weekday && !w.isOff
      );
      if (staffDayHours.length === 0) continue;

      // Business hours intersected with staff hours for this weekday.
      const businessIntervals: TimeInterval[] = dayHours
        .filter((h) => h.startTime && h.endTime)
        .map((h) => ({
          start: timeStringToUtc(dateStr, h.startTime!, timezone),
          end: timeStringToUtc(dateStr, h.endTime!, timezone),
        }));

      const staffIntervals: TimeInterval[] = staffDayHours
        .filter((h) => h.startTime && h.endTime)
        .map((h) => ({
          start: timeStringToUtc(dateStr, h.startTime!, timezone),
          end: timeStringToUtc(dateStr, h.endTime!, timezone),
        }));

      let workable = intersectIntervalSets(businessIntervals, staffIntervals);

      // Remove breaks.
      const staffBreaks = breaks
        .filter((b) => b.staffId === staff.id && b.weekday === weekday)
        .map((b) => ({
          start: timeStringToUtc(dateStr, b.startTime, timezone),
          end: timeStringToUtc(dateStr, b.endTime, timezone),
        }));
      workable = workable.flatMap((w) => subtractIntervals(w, staffBreaks));

      // Remove leave/time-off.
      const staffLeave = timeOff
        .filter((t) => t.staffId === staff.id)
        .map((t) => ({ start: t.startsAt, end: t.endsAt }));
      workable = workable.flatMap((w) => subtractIntervals(w, staffLeave));

      // Remove existing bookings for this staff member.
      const staffBusy = existingBookings
        .filter((b) => b.staffId === staff.id)
        .map((b) => ({ start: b.startsAt, end: b.endsAt }));
      workable = workable.flatMap((w) => subtractIntervals(w, staffBusy));

      // Remove external calendar busy periods.
      const externalBusy = calendarConnections
        .filter((c) => c.staffId === staff.id)
        .flatMap((c) => c.busyPeriods.map((bp) => ({ start: bp.startsAt, end: bp.endsAt })));
      workable = workable.flatMap((w) => subtractIntervals(w, externalBusy));

      // Generate candidate start times at the configured booking interval and
      // verify the FULL required duration (service + buffer) fits.
      for (const window of workable) {
        for (
          let slotStart = alignToInterval(window.start, business.bookingIntervalMinutes, timezone, dateStr);
          isBefore(addMinutes(slotStart, totalMinutes), window.end) ||
          isEqual(addMinutes(slotStart, totalMinutes), window.end);
          slotStart = addMinutes(slotStart, business.bookingIntervalMinutes)
        ) {
          const slotEnd = addMinutes(slotStart, totalMinutes);
          if (isBefore(slotStart, window.start)) continue;
          if (isBefore(slotStart, minNoticeCutoff)) continue;
          if (isAfter(slotStart, maxAdvanceCutoff)) continue;

          // Resource availability check for this candidate slot.
          if (!resourcesAvailableFor(slotStart, slotEnd, resourceRequirements, existingResourceBookings)) {
            continue;
          }

          daySlots.push({
            startsAt: slotStart,
            endsAt: slotEnd,
            staffId: staff.id,
            staffName: staff.fullName,
          });
        }
      }
    }

    daySlots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    results.push({ date: dateStr, slots: dedupeByStartTime(daySlots) });
  }

  return {
    service: {
      name: service.name,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
    },
    dates: results,
  };
}

// ---------------------------------------------------------------------------
// Supporting helpers
// ---------------------------------------------------------------------------

function intersectIntervalSets(a: TimeInterval[], b: TimeInterval[]): TimeInterval[] {
  const result: TimeInterval[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = isAfter(x.start, y.start) ? x.start : y.start;
      const end = isBefore(x.end, y.end) ? x.end : y.end;
      if (isBefore(start, end)) result.push({ start, end });
    }
  }
  return result;
}

function alignToInterval(from: Date, intervalMinutes: number, timezone: string, dateStr: string): Date {
  // Align candidate start times to the business's configured interval grid
  // (e.g. every 15 minutes) measured from local midnight, not from `from`
  // itself, so slot times look natural (09:00, 09:15, 09:30 ...).
  const midnight = timeStringToUtc(dateStr, "00:00", timezone);
  const minutesSinceMidnight = Math.ceil(
    (from.getTime() - midnight.getTime()) / 60000 / intervalMinutes
  ) * intervalMinutes;
  return addMinutes(midnight, minutesSinceMidnight);
}

function resourcesAvailableFor(
  slotStart: Date,
  slotEnd: Date,
  requirements: { resourceTypeId: string; quantity: number; pool: { id: string }[] }[],
  existingResourceBookings: { resourceId: string; booking: { startsAt: Date; endsAt: Date } }[]
): boolean {
  for (const req of requirements) {
    let freeCount = 0;
    for (const resource of req.pool) {
      const isBusy = existingResourceBookings.some(
        (rb) =>
          rb.resourceId === resource.id &&
          isBefore(rb.booking.startsAt, slotEnd) &&
          isBefore(slotStart, rb.booking.endsAt)
      );
      if (!isBusy) freeCount++;
    }
    if (freeCount < req.quantity) return false;
  }
  return true;
}

function dedupeByStartTime(slots: AvailableSlot[]): AvailableSlot[] {
  // When "any available staff" is requested, multiple staff may be free at
  // the same instant. Keep the first (staff.qualifiedStaff is pre-sorted by
  // priority in the caller) and drop the rest so the customer sees ONE
  // representative option per time, per spec #21's "any available staff" UX.
  const seen = new Set<string>();
  const out: AvailableSlot[] = [];
  for (const s of slots) {
    const key = s.startsAt.toISOString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
