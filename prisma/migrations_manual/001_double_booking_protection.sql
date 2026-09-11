-- ============================================================================
-- Double-booking protection at the DATABASE level.
--
-- Run this AFTER `prisma migrate deploy` has created the base tables.
-- Prisma cannot express range-exclusion constraints, so this lives as a
-- hand-applied migration. Add it to your deploy pipeline right after
-- `prisma migrate deploy`, e.g.:
--
--   npx prisma migrate deploy
--   psql "$DATABASE_URL" -f prisma/migrations_manual/001_double_booking_protection.sql
--
-- This is the enforcement layer referenced in spec section 27/89: even if
-- application code has a bug, or two requests race past the app-level check,
-- Postgres itself will refuse the second overlapping INSERT/UPDATE.
-- ============================================================================

-- Required for GiST-based range exclusion on non-range types (uuid/text + tsrange).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ----------------------------------------------------------------------------
-- 1) A staff member cannot have two bookings with overlapping [startsAt, endsAt)
--    ranges, for bookings that are still "live" (not cancelled/no-show).
-- ----------------------------------------------------------------------------

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "timeRange" tsrange
  GENERATED ALWAYS AS (tsrange("startsAt", "endsAt", '[)')) STORED;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_staff_overlap
  EXCLUDE USING gist (
    "staffId" WITH =,
    "timeRange" WITH &&
  )
  WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

-- ----------------------------------------------------------------------------
-- 2) A resource cannot be double-booked either. BookingResource rows don't
--    carry their own time range, so we denormalize the parent booking's
--    range onto the join row via a trigger, then apply the same exclusion.
-- ----------------------------------------------------------------------------

ALTER TABLE "BookingResource"
  ADD COLUMN IF NOT EXISTS "timeRange" tsrange,
  ADD COLUMN IF NOT EXISTS "bookingStatus" text;

CREATE OR REPLACE FUNCTION sync_booking_resource_range() RETURNS trigger AS $$
BEGIN
  SELECT tsrange(b."startsAt", b."endsAt", '[)'), b.status
    INTO NEW."timeRange", NEW."bookingStatus"
  FROM "Booking" b WHERE b.id = NEW."bookingId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_booking_resource_range ON "BookingResource";
CREATE TRIGGER trg_sync_booking_resource_range
  BEFORE INSERT OR UPDATE ON "BookingResource"
  FOR EACH ROW EXECUTE FUNCTION sync_booking_resource_range();

-- Keep BookingResource rows in sync when the parent Booking's time/status changes
-- (e.g. rescheduled or cancelled after the resource link was created).
CREATE OR REPLACE FUNCTION propagate_booking_range_to_resources() RETURNS trigger AS $$
BEGIN
  UPDATE "BookingResource"
    SET "timeRange" = tsrange(NEW."startsAt", NEW."endsAt", '[)'),
        "bookingStatus" = NEW.status
    WHERE "bookingId" = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_propagate_booking_range ON "Booking";
CREATE TRIGGER trg_propagate_booking_range
  AFTER UPDATE OF "startsAt", "endsAt", status ON "Booking"
  FOR EACH ROW EXECUTE FUNCTION propagate_booking_range_to_resources();

ALTER TABLE "BookingResource"
  ADD CONSTRAINT booking_resource_no_overlap
  EXCLUDE USING gist (
    "resourceId" WITH =,
    "timeRange" WITH &&
  )
  WHERE ("bookingStatus" NOT IN ('CANCELLED', 'NO_SHOW'));

-- ----------------------------------------------------------------------------
-- 3) Row Level Security — defense in depth beneath the application layer.
--    The app connects using a role that has `app.current_business_id` and
--    `app.current_role` set per-request via `SET LOCAL` inside each
--    transaction (see src/lib/db.ts). RLS then makes cross-tenant reads/writes
--    fail at the database, even if an application bug forgets a WHERE clause.
-- ----------------------------------------------------------------------------

ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Resource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Receipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;

-- PLATFORM_ADMIN bypasses tenant scoping entirely (app.current_role = 'PLATFORM_ADMIN').
-- All other roles are restricted to rows matching app.current_business_id.
CREATE POLICY tenant_isolation_service ON "Service"
  USING (
    current_setting('app.current_role', true) = 'PLATFORM_ADMIN'
    OR "businessId" = current_setting('app.current_business_id', true)
  );

CREATE POLICY tenant_isolation_staff ON "Staff"
  USING (
    current_setting('app.current_role', true) = 'PLATFORM_ADMIN'
    OR "businessId" = current_setting('app.current_business_id', true)
  );

CREATE POLICY tenant_isolation_booking ON "Booking"
  USING (
    current_setting('app.current_role', true) = 'PLATFORM_ADMIN'
    OR "businessId" = current_setting('app.current_business_id', true)
  );

CREATE POLICY tenant_isolation_customer ON "Customer"
  USING (
    current_setting('app.current_role', true) = 'PLATFORM_ADMIN'
    OR "businessId" = current_setting('app.current_business_id', true)
  );

CREATE POLICY tenant_isolation_resource ON "Resource"
  USING (
    current_setting('app.current_role', true) = 'PLATFORM_ADMIN'
    OR "businessId" = current_setting('app.current_business_id', true)
  );

CREATE POLICY tenant_isolation_receipt ON "Receipt"
  USING (
    current_setting('app.current_role', true) = 'PLATFORM_ADMIN'
    OR "businessId" = current_setting('app.current_business_id', true)
  );

CREATE POLICY tenant_isolation_payment ON "Payment"
  USING (
    current_setting('app.current_role', true) = 'PLATFORM_ADMIN'
    OR "businessId" = current_setting('app.current_business_id', true)
  );
