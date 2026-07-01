# 🛠️ Recent Changes & Feature Implementations

This document logs all specific additions, bug fixes, database migrations, and code structure updates implemented in this run.

---

## 🚨 1. Lot Creation Notification Fix & Realtime Cleanups

- **Direct Inlined Insertion:** Refactored `createLot` in [_authenticated.worker.dashboard.tsx](file:///c:/Users/ahmad/Downloads/waterflow-manage-main/waterflow-manage-main/src/routes/_authenticated.worker.dashboard.tsx#L145-L188) to:
  - Output explicit trace logs: `console.log("LOT CREATED - starting notification flow")`.
  - Perform an inline Supabase insertion targeting the `notifications` table containing `kind: 'lot'` to satisfy table column constraints.
  - Log result status (`NOTIFICATION INSERT SUCCESS` / `NOTIFICATION INSERT FAILED`).
- **Push Notification server action:** Dispatched `broadcastPushToAdmins` locally within the mutation block, invoking `notifyAdminsPush` and outputting explicit execution logs.
- **SQL Migration [20260702000000_workers_insert_notifications.sql](file:///c:/Users/ahmad/Downloads/waterflow-manage-main/waterflow-manage-main/supabase/migrations/20260702000000_workers_insert_notifications.sql):**
  - Created insert RLS policy `"Workers can insert notifications"` allowing authenticated users to create notifications.
- **Realtime Listener Cleanups:**
  - In [_authenticated.admin.notifications.tsx](file:///c:/Users/ahmad/Downloads/waterflow-manage-main/waterflow-manage-main/src/routes/_authenticated.admin.notifications.tsx) and [admin-shell.tsx](file:///c:/Users/ahmad/Downloads/waterflow-manage-main/waterflow-manage-main/src/components/admin-shell.tsx):
    - Subscribed using unique channel names (`notifications-feed` and `admin-shell-notifications` respectively).
    - Structured code so `.on('postgres_changes', ...)` is chained **before** `.subscribe()`.
    - Always returned a cleanup function returning `supabase.removeChannel(channel)` to avoid duplicate event listeners.
    - Set the dependency array on the admin notifications page `useEffect` to `[]` to execute exactly once.

---

## 🫙 2. Customer Empty Bottles Tracking

- **SQL Migration [20260702000001_add_empty_bottles_to_customers.sql](file:///c:/Users/ahmad/Downloads/waterflow-manage-main/waterflow-manage-main/supabase/migrations/20260702000001_add_empty_bottles_to_customers.sql):**
  - Added the integer column `empty_bottles` (default `0`) to the `customers` table.
- **Type definitions (`src/integrations/supabase/types.ts`):**
  - Added `empty_bottles` properties to the `Row`, `Insert`, and `Update` typescript interfaces.
- **Admin Customer Drawer Forms (`_authenticated.admin.customers.tsx`):**
  - Added the numeric input field "Empty Bottles at Customer" inside the Add/Edit overlay drawer immediately after Route selection.
  - Implemented client-side validations to enforce positive integer values and parsed it into `empty_bottles` database payloads.
- **Visual indicators & ledger headers:**
  - Added `🫙 X empty bottles` subtext under route badges on each customer card.
  - Rendered `Empty Bottles: X` badges in both the Admin and Worker ledger headers (in [_authenticated.worker.customers.tsx](file:///c:/Users/ahmad/Downloads/waterflow-manage-main/waterflow-manage-main/src/routes/_authenticated.worker.customers.tsx)).

---

## 📅 3. Manual Record Entry Screen (Admin Only)

- **Admin Records Page ([_authenticated.admin.records.tsx](file:///c:/Users/ahmad/Downloads/waterflow-manage-main/waterflow-manage-main/src/routes/_authenticated.admin.records.tsx)):**
  - Created a manual entries logging console for past dates.
  - **Date Picker:** Standard HTML5 input picker with `max` value bound to yesterday (disables current and future dates). Forms load dynamically only after selecting a date.
  - **Lots Entry:** Dynamic list cards styling (using `card-surface`) containing input fields for bottles taken out and a button to append deliveries.
  - **Deliveries Entry:** Walk-in / Regular toggle pills. Searchable customer lookup field that auto-fills pricing. Calculates total amounts, displays payment options, and handles item deletions.
  - **Expenses Entry:** Custom fields selecting through the 5 default categories and adding numeric cost sums.
  - **Validation rules:** Blocks submission if there are no lots, no deliveries, missing regular customer selections, or empty/negative numbers. Shows clear inline red text errors.
  - **DML Operations:** Saves entities sequentially in the database (lots, followed by associated deliveries with generated lot IDs, then expenses) and posts a single `Admin manually added records for [Date]` notification.
- **Sidebar & Mobile Bottom Nav:**
  - Registered `Add Record` with a `Clipboard` icon inside both `nav` lists.
  - Resized the mobile bottom nav wrapper grid class from `grid-cols-5` to `grid-cols-6` to fit the layout.
