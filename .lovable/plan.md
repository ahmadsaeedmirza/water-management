## Shifaf Aab — Water Delivery Management System

A mobile-first PWA with two roles (Admin, Worker), Supabase-backed auth/data/realtime, and PDF reporting. Built on the existing TanStack Start + Tailwind v4 stack with Lovable Cloud.

### Approach

Because this scope is very large, I'll deliver it in two phases so you get a working app fast and can validate direction before I build the heavier admin reporting pieces.

**Phase 1 — Foundation + Worker app (this build)**

1. Enable Lovable Cloud and create the full schema (users/profiles, customers, lots, deliveries, payments, expenses, notifications) with RLS + a `user_roles` table + `has_role()` SECURITY DEFINER function.
2. Design system in `src/styles.css`: exact tokens from the spec (Primary `#0077B6`, etc.), Inter font via `<link>`, tabular numerals, card/button/input variants matching the screenshots.
3. Auth: single `/auth` login screen (email + password) matching the login mock; role-based redirect; `_authenticated` gate; admin-only and worker-only nested gates.
4. Worker screens (mobile, max-w 390): Dashboard, Start New Lot bottom sheet with numeric keypad, Log Delivery, Customers list, Expenses + add sheet, Notifications drawer, bottom nav.
5. Server functions for all writes (create lot, log delivery, add expense, record payment) — each inserts a notification row for admins.
6. Supabase Realtime on lots/deliveries for live "sold so far" counts.

**Phase 2 — Admin app + PDFs (next turn after you confirm Phase 1 looks right)**

- Admin dashboard with KPI cards, weekly bar chart (recharts), today/month filter, recent activity, customers summary.
- Lots accordion, Customers list + ledger + Record Payment sheet, Expenses (read-only), Notifications feed with realtime + unread state.
- Bills page with date-range / monthly / daily PDF downloads via `@react-pdf/renderer`.
- Web Push notifications for admins.

### Technical Details

- **Stack**: Existing TanStack Start v1 + React 19 + Tailwind v4 + Lovable Cloud (Supabase). No framework swap — the spec says "Next.js or React.js", and the project is already on a compatible React/SSR stack.
- **Auth**: `supabase.auth` email/password. Users created via Cloud user management; role stored in `user_roles` table (NOT on profiles) per security rules. Login screen auto-redirects by role.
- **Routing**: `/auth` (public), `/_authenticated/worker/*`, `/_authenticated/admin/*`. Inner gates check role via `has_role()` server fn.
- **Schema highlights**:
  - `profiles(id, name, created_at)` linked to `auth.users`
  - `user_roles(user_id, role)` with enum `app_role` = admin|worker
  - `customers`, `lots(status)`, `deliveries(customer_type, payment_mode)`, `payments`, `expenses`, `notifications`
  - GRANTS for `authenticated` + `service_role` on every public table
  - RLS: workers read/write only their own lots/deliveries/expenses; admins read all via `has_role(auth.uid(), 'admin')`; customers readable by all authenticated users
- **Realtime**: subscribe to `deliveries` (worker dashboard for own lot updates), `notifications` (admin bell).
- **Money/date formatting**: `Rs. X,XXX`, `DD MMM YYYY`, 12h time — centralised in `src/lib/format.ts`.
- **No edge functions** — all server logic via `createServerFn` per stack rules.

### Out of scope for Phase 1

Admin screens, PDF generation, Web Push, and the chart are scheduled for Phase 2 to keep this build focused and reviewable. The schema and notifications system land in Phase 1 so Phase 2 is purely UI + reports.

Shall I proceed with Phase 1?
