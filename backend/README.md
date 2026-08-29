# Event Platform — Backend

## Phase 1-4 (done)
Auth + Roles, Multi-Event Architecture, Dynamic Registration Form Builder,
Registration + Ticket + secure QR generation.

## Phase 5-12 (this round — backend/data layer)

- **Phase 5 — Mobile scanner (backend)**: `POST /api/events/:eventId/scan/checkin`
  accepts either a scanned QR token or a manual search value (ticket ID /
  email / phone). No scanner *UI* yet — that's frontend work, not started.
- **Phase 6 — Attendance + duplicate protection**: `Attendance.ticketId` has
  a **unique index**, and check-in works by attempting an *insert* rather
  than read-then-write — MongoDB's index enforcement makes this atomic, so
  two simultaneous scans of the same ticket can never both succeed. Tested
  explicitly with `Promise.all()` firing two concurrent check-ins (see
  `src/tests/checkin.test.js`).
- **Phase 7 — Gates + scanner devices**: `Gate` and `ScannerDevice` models
  + CRUD routes, device revocation.
- **Phase 8 — Analytics (data layer)**: `/api/events/:eventId/analytics`
  (registrations/check-ins over time, gate-wise breakdown, attendance
  rate) and `/api/analytics/overview` (Super Admin cross-event cards). No
  chart *UI* yet — just the aggregation endpoints a dashboard would call.
- **Phase 9 — Email (partial)**: Nodemailer send + `Notification` model
  tracking `PENDING/SENT/FAILED`. Registration confirmation is wired in.
  Built as a queue-*ready* abstraction (`queueEmail()`) per the spec — a
  real background worker (BullMQ/Redis) could later poll `PENDING`
  Notification rows without any calling code changing. Bulk email +
  admin-editable templates UI not built yet (the `EmailTemplate` model
  exists, but there's no route/UI to manage it yet).
- **Phase 10 — Audit logs (partial)**: `AuditLog` model + `GET
  /api/audit-logs` (Super Admin). Wired into gate/scanner
  creation/revocation and check-ins as examples — not yet hooked into
  every single admin action the spec lists (events, users, etc.).
  Exports (CSV/XLSX) not built yet.
- **Phase 11 — Offline scanner**: **not started**. This is fundamentally
  frontend/service-worker/IndexedDB architecture and won't be meaningful
  until the scanner UI itself exists.
- **Phase 12 — Testing (partial)**: Jest + Supertest + mongodb-memory-server
  suite covering auth, event isolation, dynamic-form validation, duplicate
  registration, QR signing/tampering, cross-event ticket rejection, manual
  check-in, and — the one the spec calls out as critical — **the
  concurrent duplicate-check-in race condition**, verified by firing two
  check-ins at the same ticket simultaneously and asserting exactly one
  succeeds.

  ⚠️ **I could not execute this test suite in my own sandbox** —
  `mongodb-memory-server` needs to download a MongoDB binary from
  `fastdl.mongodb.org`, which isn't reachable from my sandboxed
  environment's network. The test code itself is syntactically verified
  and logically sound, but you should run `npm test` yourself to get a
  real pass/fail — normal internet access should let the binary download
  fine.

## Still not built at all

Full offline scanner (Phase 11), CSV/XLSX export, bulk email UI,
admin-editable email template UI, complete audit coverage of every admin
action, certificate system, sessions/sub-events, ticket types with
capacity/access-rules, and — critically — **any frontend whatsoever**.
Nothing in this project can be used through a browser yet; everything so
far is API-only.

## Setup

```bash
npm install
cp .env.example .env
# fill in MONGO_URI, JWT_SECRET, QR_SECRET (SMTP optional — email just
# gets logged as FAILED without it, doesn't crash anything)
npm run seed
npm run dev     # port 3012
npm test        # run the test suite (needs real internet access)
```

## Full API overview (Phases 1-10)

```
POST   /api/auth/login
GET    /api/auth/me

GET    /api/users                          (Super Admin)
POST   /api/users                          (Super Admin)
PATCH  /api/users/:id                      (Super Admin)
POST   /api/users/:id/reset-password
DELETE /api/users/:id

GET    /api/events
POST   /api/events                         (Super Admin)
GET    /api/events/:id
PATCH  /api/events/:id
PATCH  /api/events/:id/status
POST   /api/events/:id/duplicate           (Super Admin)
DELETE /api/events/:id                     (Super Admin)

GET    /api/events/public/:slug            (public)
GET    /api/events/:eventId/form           (public)
PUT    /api/events/:eventId/form
POST   /api/events/:eventId/register       (public)
GET    /api/events/:eventId/registrations

GET    /api/events/:eventId/gates
POST   /api/events/:eventId/gates
PATCH  /api/events/:eventId/gates/:gateId
DELETE /api/events/:eventId/gates/:gateId

GET    /api/events/:eventId/scanners
POST   /api/events/:eventId/scanners
POST   /api/events/:eventId/scanners/:scannerId/revoke

POST   /api/events/:eventId/scan/checkin
GET    /api/events/:eventId/attendance
GET    /api/events/:eventId/analytics

GET    /api/tickets/:ticketId              (public)

GET    /api/audit-logs                     (Super Admin)
GET    /api/analytics/overview             (Super Admin)
```

## Next step

Given none of this is usable through a browser yet, the highest-value
next slice is almost certainly the **React frontend** — starting with
login + event management + the form builder + public registration/ticket
pages, since that's what makes Phases 1-4 actually demoable — then the
mobile scanner screen to make Phases 5-7 demoable too.

