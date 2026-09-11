# Zentro

A multi-tenant appointment booking and business management platform for
salons, barbershops, and beauty studios. Built in stages; this covers all
five.

- **Stage 1** — database schema + the real-time availability engine.
- **Stage 2** — authentication, RBAC, tenant isolation, business
  registration/approval, staff invitations.
- **Stage 3** — the owner/staff portal (`/b/[slug]/manage/...`) and the
  platform admin business-approval UI.
- **Stage 4** — the public customer-facing booking site.
- **Stage 5** — receipts, payment recording, resource management UI, staff
  time-off UI, notifications architecture, an onboarding checklist,
  audit-log viewers, rate limiting, platform-admin 2FA, Google Calendar
  OAuth, and the PWA shell.

---

## Quick start

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL from Supabase/Neon, generate secrets (see comments)
npx prisma migrate dev --name init
psql "$DATABASE_URL" -f prisma/migrations_manual/001_double_booking_protection.sql
npx prisma db seed
npm run dev
```

Seeded accounts (see `prisma/seed.ts`):
- Platform admin: `admin@zentro.demo` / `DemoAdminPass123!` → `/admin/login`
- Business owner: `owner@glowbeauty.demo` / `DemoPassword123!` → `/b/glow-beauty-demo/manage/login`
- Demo business slug: `glow-beauty-demo`

Try the customer flow at `/b/glow-beauty-demo`, `/services`, `/book`, `/track`.

---

## Architecture at a glance

```
PLATFORM ADMIN (/admin)
  └─ approves/rejects/suspends businesses, platform-wide activity log, 2FA

BUSINESS (tenant, /b/[slug])
  ├─ PUBLIC SITE          home, services, staff, book, track, receipt, about, contact
  ├─ OWNER/STAFF PORTAL    /manage/dashboard, bookings, services, staff, resources,
  │  (/manage/...)         customers, receipts, settings, activity
  └─ backing APIs          /api/b/[slug]/... (authenticated) and
                           /api/b/[slug]/public/... (unauthenticated, narrow)
```

Every business-owned database row carries `businessId`. Every business-scoped
route calls `requireBusinessMember(slug, allowedRoles)`
(`src/lib/rbac.ts`), which resolves the business from the slug and checks it
against the caller's *session*-derived `businessId` — never the URL. That's
what makes cross-tenant access via a modified URL fail by construction
(spec #57/#88), not just by UI convention.

---

## The two things that matter most

**The availability engine** (`src/lib/availability.ts`) is the core of the
product. Given a service, a date range, and optionally a specific staff
member, it intersects business hours, staff hours, breaks, leave, existing
bookings, resource occupancy, and external-calendar busy periods, and
returns only slots where the *full* required duration (service + buffer) is
genuinely free. Nothing is hardcoded.

**Booking creation never trusts the browser.** `src/lib/booking.ts`
re-runs the exact same availability computation at write time, then commits
inside a transaction. The final backstop is at the database level: raw SQL
in `prisma/migrations_manual/001_double_booking_protection.sql` adds
Postgres `EXCLUDE` constraints (via `btree_gist`) so two concurrent requests
for the same staff/resource/time cannot both succeed, even if application
logic somehow raced. A losing request gets `"This time was just booked."`,
not a duplicate appointment. Manual bookings created from the owner portal
and reschedules both go through this same path — there's no looser,
parallel code path for internal use.

Row Level Security policies (same SQL file) are a second, independent
layer beneath the application code, scoped by `app.current_business_id` /
`app.current_role` session variables.

---

## Feature map

| Area | Where | Notes |
|---|---|---|
| Schema | `prisma/schema.prisma` | Full relational model: businesses, staff, services, resources, hours, breaks, leave, bookings, payments, receipts, invitations, audit logs, external calendars, notifications. |
| Double-booking protection | `prisma/migrations_manual/001_*.sql` | Postgres EXCLUDE constraints + RLS. |
| Availability engine | `src/lib/availability.ts` | See above. |
| Booking transaction | `src/lib/booking.ts`, `src/lib/bookingTransitions.ts` | Create, confirm, complete, cancel, no-show, reschedule — all a real state machine. |
| Auth & sessions | `src/lib/session.ts`, `src/lib/auth.ts` | iron-session, httpOnly/secure/sameSite cookies, bcrypt (12 rounds), constant-shape credential checks. |
| Authorization | `src/lib/rbac.ts`, `src/lib/tenant.ts` | The `requireBusinessMember` guard described above. |
| Business lifecycle | `src/lib/businessLifecycle.ts` | PENDING → ACTIVE/REJECTED, ACTIVE ⇄ SUSPENDED, as a real state machine with audit logging. |
| Staff invitations | `/api/b/[slug]/staff/invite`, `/api/invitations/[token]/*` | One-time hashed tokens, 72h expiry, atomic accept-once, hardcoded STAFF role on activation. |
| Owner/staff portal | `src/app/b/[slug]/manage/**` | Dashboard, bookings, services, staff (+ per-staff hours/leave), resources, customers, receipts, settings, activity. |
| Public site | `src/app/b/[slug]/(public)/**` | Home, services, staff, book (wizard), track, receipt, about, contact. |
| Platform admin | `src/app/admin/**` | Business approval queue, platform activity log, 2FA setup. |
| Receipts | `src/lib/receipt.ts`, `ReceiptView` component | Standard + genuinely distinct thermal layout, printable, shared serializer between owner and public views. |
| Payments | `/api/b/[slug]/bookings/[id]/payment` | Owner-recorded (no live provider); server is always the source of truth. |
| Notifications | `src/lib/notifications.ts` | Queues + a logging adapter; swap `sendViaAdapter()` for a real provider. |
| Rate limiting | `src/middleware.ts`, `src/lib/rateLimit.ts` | In-memory, single-instance (see caveats). |
| Admin 2FA | `src/lib/totp.ts`, `/api/admin/auth/2fa/*` | RFC 6238 TOTP, no external dependency, admin-only. |
| Google Calendar | `src/lib/googleCalendar.ts`, `/api/auth/google/callback`, `/api/b/[slug]/calendar/*` | OAuth2 + FreeBusy sync; **untested against live Google credentials** (see below). |
| PWA | `public/manifest.json`, `public/sw.js`, `OfflineBanner` | Network-first service worker, offline fallback page. |

---

## Known gaps and honest caveats

- **No real payment provider integration.** Payment status is currently
  owner-recorded, not collected via M-Pesa/Stripe/etc. A real integration's
  webhook should update the same `Payment` row this endpoint updates.
- **No cron/scheduler exists in this codebase.** Notification delivery and
  Google Calendar sync are both triggered at the call site (booking
  creation, a "Sync now" button), not on a schedule. On Vercel, each is one
  `vercel.json` cron entry away from a real recurring job.
- **Google Calendar OAuth is implemented against Google's documented API
  contracts but has not been exercised against live credentials** in this
  sandbox (no outbound network access here). Test against a real Google
  Cloud OAuth client before depending on it.
- **Rate limiting is in-memory** — correct for a single running instance,
  not shared across multiple serverless instances. Swap in Upstash Redis or
  Vercel KV behind the same `isAllowed()` signature for real production use.
- **2FA is platform-admin only**, not extended to business owners/staff yet
  (would reuse the same `src/lib/totp.ts`).
- **CSRF mitigation relies on `SameSite=Lax` cookies**, not a dedicated
  double-submit token.
- **PWA icons are a placeholder SVG monogram**, not designed assets.
- **Owner onboarding is a checklist**, not a guided multi-step wizard with
  persisted progress.
- No custom 403 page (404, 500/global-error exist); no dedicated FAQ page
  (folded into About).

---

## Why some things are done the way they are

- **Snapshotted service data on `Booking`** (`serviceNameSnapshot`,
  `servicePriceCentsSnapshot`, `serviceDurationSnapshot`): editing a
  service's price later must never silently rewrite historical
  bookings/receipts (spec #45).
- **Money as integer cents**, not floats, to avoid rounding artifacts.
- **Receipt numbers via a per-business/year counter row**, incremented
  inside the same transaction as the booking, so numbers stay sequential
  and collision-free under concurrent bookings (spec #49/#80).
- **Invitation tokens stored only as a hash**; the raw token is shown once
  and never persisted, so a database leak alone can't activate a staff
  account.
- **Booking tracking/receipts require reference *and* phone number**,
  never reference alone — a reference is easily shared or guessable and
  should not by itself unlock someone's private booking data.
- **The `/manage` prefix on the owner portal** exists because the public
  site needs `/b/[slug]/services`, `/b/[slug]/staff`, etc. for itself, and
  those would otherwise collide with identically-named owner-portal routes.

---

## Deploying

Target stack: **Vercel** (Next.js hosting) + **Supabase or Neon**
(Postgres). Both support the `btree_gist` extension the exclusion
constraints need — enable it in your provider's dashboard if
`CREATE EXTENSION` is restricted on your plan. See `.env.example` for every
required/optional environment variable, including the Google OAuth ones
(only needed if you connect a calendar).
