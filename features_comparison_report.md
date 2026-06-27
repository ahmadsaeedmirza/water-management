# Shifaf Aab — Feature Comparison & Gaps Report

This report compares the requested specification for **Shifaf Aab** (water bottle delivery management system) with the actual implementation in the current codebase. It outlines the architectural differences, missing features (what is left), and incorrect implementations (what is not implemented right).

---

## 🏗️ 1. Core Architecture & Tech Stack

| Feature                           | Specification                                                                                           | Actual Implementation                                                                                                                                                    | Status                       |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------- |
| **Framework**                     | Next.js (App Router)                                                                                    | Vite (Single Page Application)                                                                                                                                           | ⚠️ **Mismatched Stack**      |
| **Routing**                       | Next.js App Router (`/admin/*`, `/worker/*`)                                                            | React + `@tanstack/react-router`                                                                                                                                         | ⚠️ **Mismatched Router**     |
| **Route Protection**              | Protect all routes — workers cannot access `/admin/*` routes; Admin cannot access worker input screens. | Auth layout (`_authenticated.tsx`) only checks for a valid session. **There are no role checks on route transitions.** A worker can access `/admin/*` by typing the URL. | 🚨 **Critical Security Gap** |
| **Admin Access to Worker Inputs** | Admin cannot access worker input screens (view-only for admin)                                          | Admin dashboard redirects. However, there is no view-only mode implemented on worker screens for admin roles if they access those routes.                                | ❌ **Missing**               |

---

## 🔒 2. Auth & Roles

- **Role Protection Bypass:** `role === 'admin'` is checked only on the root route (`/`) and the `/auth` page after signing in. Once a user has a session, they can navigate to any path (e.g., `/admin/dashboard` or `/worker/dashboard`) because `_authenticated.tsx` does not inspect `role` inside the auth gate.
- **Sign-up Default:** In the auth component (`src/routes/auth.tsx`), signup defaults to inserting role: `"worker"`. This is functional but should be backed by admin-controlled assignment to prevent unauthorized role creations.

---

## 📱 3. Worker Screens (Mobile)

### Navigation Bar

- **Tab Labels:** The bottom tabs are labeled **Home**, **Orders**, **Client**, and **Cost**. The specification explicitly requires: **Home**, **Deliveries**, **Customers**, and **Expenses**.
- **Viewport Width:** The worker shell uses `max-w-[420px]` instead of the requested `max-w-[390px]`.

### Dashboard (`/worker/dashboard`)

- **Active Lot Badge Color:** The active badge uses a warning tone (amber/orange: `#F59E0B`) instead of primary blue (`#0077B6`).
- **Lot Tapping Navigation:** Tapping a lot navigates to `/worker/deliveries` but does not pass a specific lot ID as search parameters (the deliveries page retrieves the latest active lot from Supabase automatically).
- **Worker Notifications (Bell Icon):**
  - **The bell button does nothing when clicked.**
  - The worker notification drawer/feed showing confirmations of their own logged deliveries/expenses is **completely unimplemented**.

### Log Delivery (`/worker/deliveries`)

- **Searchable Customer Dropdown:** The customer selection opens a static scrollable bottom sheet. **It is not searchable** (it lacks a search/filter input field).
- **Quantity Selector:** Uses a +/- stepper, whereas the specification requests a large numeric input.
- **Inline Validation:** Validation checks (e.g., verifying active lot, checking if quantity exceeds available stock) throw standard JS errors which display as top-screen toast notifications. **Inline red error messages below fields are missing.**
- **Payment Mode Pills styling:** The active payment mode pill uses light-blue accent (`#90E0EF`) with primary text (`#0077B6`). The specification requests it to be filled primary (`#0077B6`) with white text.

### Customers (`/worker/customers`)

- No ledger or balance is visible to the worker, which matches the spec.

### Expenses (`/worker/expenses`)

- **Add Expense Date/Time Form Field:** The date/time is shown as a static subtitle "Today, [Time]" instead of a read-only form control value.
- **Inline Validation:** Lacks inline error messages below form fields.

---

## 🖥️ 4. Admin Screens

### Sidebar & Navigation Layout

- **Sidebar Width:** The fixed sidebar uses `w-64` (256px) instead of the specified `240px`.
- **Mobile Admin Layout:** On mobile browsers, the admin interface is toggled via a hamburger menu button in the header that displays the sidebar as an overlay drawer. **It does not use the requested mobile bottom navigation** (Dashboard · Customers · Bills · Reports · Notifications).

### Dashboard (`/admin/dashboard`)

- **KPI Row:** The 4 KPI cards are "Bottles Sold", "Total Sales", "Payments In", and "Expenses". The specification requires: **Total Bottles Sold**, **Total Revenue**, **Total Expenses**, and **Net Revenue**.
- **Weekly Bar Chart:**
  - **No Toggle:** The chart only plots bottle count. The toggle to switch between bottle count and revenue is **missing**.
  - **Bar Highlighting:** All bars use the primary color (`#0077B6`). Today's bar is **not highlighted** in `#00B4D8`.
  - **Click Action:** Clicking/tapping on a bar **does nothing**; it does not open a slide-in panel or modal breakdown showing the day's lots, deliveries, and expenses.
- **Recent Feeds:** Instead of two separate columns for Recent Deliveries (last 10) and Recent Expenses (last 10), the dashboard has a "Pending Dues" card next to the chart and a single "Recent Activity" feed displaying deliveries only (expenses are omitted).
- **Regular Customers Summary Table:** The summary table listing customer name, monthly bottles, balance due, and last delivery date is **completely missing** from the dashboard page.

### Lots (`/admin/lots`)

- **Date Filter:** The date filter picker at the top of the Lots page is **completely missing**.

### Customers (`/admin/customers`)

- **Customer Cards List:** The cards display the name, phone number, monthly bottles, and dues. They **do not show the customer address** on the list view.
- **Customer Ledger Tabs:** The customer ledger sidebar drawer shows a single merged feed of deliveries and payments. **It lacks the two required tabs** (Deliveries / Payments) and their respective columns.
- **Form Validation:** Inline error messages below fields in the "Add Customer" drawer are missing.

### Bills & Reports (`/admin/bills`)

- **PDF Generation Libraries:** The packages `@react-pdf/renderer` and `jspdf` are not in `package.json` and are not used. PDF output relies solely on the browser print prompt (`window.print()`) via `@media print` CSS rules.
- **Section Gaps:**
  - **Section 2 (Monthly Reports cards)** ("June 2025 · Download") is **completely missing**.
  - **Section 3 (Daily Reports)** (Date picker -> Download Daily Report PDF) is **completely missing**.

---

## 🔔 5. Notifications & Real-Time Systems

- **Web Push API:** Push notifications via the browser's Web Push API are **completely unimplemented** (no service worker, PushManager registration, or VAPID key integration).
- **Worker Notification Bells:** Buttons exist in headers but are non-functional placeholders.

---

## 🎨 6. Design System & UX Gaps

- **Form Validation Messages:** Across both worker and admin forms, validation errors are presented via toast alerts (`sonner`) instead of inline red error messages directly below input fields.
- **Input Focus Styling:** Input fields use default focus ring glows instead of the specified custom blue border + soft blue glow (`focus:ring-primary/15`).
- **Numeric Keypads/Stepper Mismatches:** Worker dashboard uses a numeric keypad layout for lot startup, but worker deliveries uses stepper buttons (`+`/`-`) instead of the numeric keypad for quantities.
