# Event Platform — Frontend

React + Vite + Tailwind, JavaScript (not TypeScript, per your call).

## Setup

```bash
npm install
cp .env.example .env   # point VITE_API_BASE at your backend (default http://localhost:3012)
npm run dev            # runs on port 5544
```

## What's here

- **Login** (`/login`)
- **Admin**: Dashboard (Super Admin overview cards), Events list, event
  create/status-management, per-event tabs (Overview, Form Builder,
  Registrations, Gates, Scanners, Analytics with charts), Users
  management, Audit logs
- **Public**: event landing page (`/events/:slug`), dynamic registration
  form (`/events/:slug/register`) that renders whatever fields you built
  in the Form Builder tab, mobile ticket page with a real QR code
  (`/ticket/:ticketId`)
- **Scanner** (`/scanner/:eventId`): mobile-first, uses the phone's rear
  camera via `html5-qrcode`, shows the valid/already-checked-in/invalid
  states, gate selector, manual search fallback, running checked-in count

## Honest gaps vs. the original spec

- **Not shadcn/ui** — plain Tailwind components in a similar dark
  SaaS-dashboard style, not the actual shadcn/ui component library (which
  needs its own CLI to scaffold each component one at a time — didn't fit
  this round's time budget). Visually similar, not the same library.
- **Not React Hook Form + Zod** — the dynamic registration form and admin
  forms use plain React state + the backend's own validation (which does
  run real checks). RHF+Zod would add matching client-side validation —
  doable, just not built yet.
- **No offline scanner support** — needs a service worker + IndexedDB
  sync queue, a significant chunk of work on its own.
- **No real-time (WebSocket) dashboard updates** — analytics/dashboards
  refetch on load, not live-updating as scans happen.
- **No CSV/XLSX export UI**, no bulk email UI, no email template editor
  UI, no certificate pages — their backend pieces are partial/absent too.
- Command menu, drawers, toasts — not built. Basic loading/empty states
  are (`Spinner`, `EmptyState`, `Skeleton` in `components/ui.jsx`), but
  not the full shadcn interaction polish.

## Testing the flow end-to-end

1. Get the backend running + seeded (see its README) — you'll have a
   Super Admin login and 3 sample events.
2. `npm run dev` here, log in with the seeded Super Admin.
3. Open an event → Form Builder tab → the sample events already have a
   basic form (Name/Email/Phone/College) from the seed script.
4. Open the event's public page in a new tab (`Overview` tab has the
   link) → register as a test attendee → you land on the ticket page
   with a real scannable QR code.
5. Create a Gate under the event's Gates tab.
6. Create a SCANNER-role user under `/admin/users`, assign them to that
   event.
7. Open `/scanner/<eventId>` on your phone (same network, or after
   deploying — **camera access needs HTTPS in production**, `localhost`
   is fine for local testing) — log in as that scanner user, select the
   gate, and scan the ticket QR from the previous step.
