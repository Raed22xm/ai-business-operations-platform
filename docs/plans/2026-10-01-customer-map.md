# Customer Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a visual, interactive **Customer Map** page (`/map`) that connects the operator/team to all customers using circular avatar nodes, status-glowing relationship lines, a slide-out customer profile drawer, and a toggleable face-cards grid view.

**Architecture:** 
A Next.js Server Component page (`/map`) fetches existing customers and cases via `@/lib/customers` and `@/lib/cases`. It feeds this data to an interactive React Client Component (`CustomerMapView`) that renders an SVG-assisted relationship network with circular nodes orbiting a central Operations Hub. Clicking any customer node highlights the relationship and opens a detail drawer displaying customer face/avatar, contact info, and active cases. The view also provides a toggle to switch to a visual "Face Cards" grid layout and real-time name/company filtering.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, TypeScript, Tailwind CSS v4, Lucide icons.

---

## Global Constraints
- Preserve existing authentication requirement (`ops_hub_session` JWT required via middleware).
- Zero external charting or heavyweight graphing libraries; use native SVG + React + CSS for blazing-fast 60fps animations and zero bundle bloat.
- Keep the dark charcoal/emerald design system styling consistent with the rest of Operations Hub.
- Accessible keyboard navigation and ARIA attributes for all interactive nodes and drawer controls.
- Works responsively across mobile, tablet, and wide desktop displays.

## Review Focus
1. Empty state when no customers exist: displays an inviting message with a direct link to add a customer.
2. Responsive layout: circular nodes calculate positions cleanly and don't clip outside viewports of various sizes.
3. Selection persistence: selecting a customer highlights the node, brightens the connector line, and opens the slide-out drawer without page reload.
4. View toggle: switching between "Network Map" and "Face Cards Grid" preserves the active search filter and customer selection.
5. Action links: clicking through to "Open Profile" or "View Cases" navigates with valid routes (`/customers/{id}` and `/cases?customerId={id}`).

---

### Task 1: Navigation Integration in AppShell

**Files:**
- Modify: `frontend/src/app/app-shell.tsx`

**Interfaces:**
- Consumes: `Network` (or `Waypoints`) icon from `lucide-react`.
- Produces: Updated `NavKey` type and `links` array with `Customer Map` pointing to `/map`.

- [ ] **Step 1: Add "Customer Map" to `links` and `NavKey` in `frontend/src/app/app-shell.tsx`**
  - Update `NavKey`: `"overview" | "inquiry" | "customers" | "cases" | "tasks" | "map"`.
  - Add `{ key: "map", href: "/map", label: "Customer Map", icon: Network }` to `links`.
  - Update `current` route detection: `pathname.startsWith("/map") ? "map" : ...`.

- [ ] **Step 2: Verify TypeScript compilation**
  Run: `npm --prefix frontend run lint`

---

### Task 2: Data Aggregation & Server Route (`/map`)

**Files:**
- Create: `frontend/src/app/map/page.tsx`

**Interfaces:**
- Consumes: `getCustomers()` from `@/lib/customers`, `getCases()` from `@/lib/cases`.
- Produces: Aggregated customer map data: `MapCustomerNode` array with linked cases, active case count, and status.

- [ ] **Step 1: Create `frontend/src/app/map/page.tsx`**
  - Implement async server component `MapPage({ searchParams })`.
  - Fetch customers and cases in parallel via `Promise.all([getCustomers(), getCases()])`.
  - Map each customer to a structured node containing customer data + linked cases array.
  - Render the client component `<CustomerMapView initialCustomers={nodes} />`.

- [ ] **Step 2: Verify page renders and loads data without errors**
  Test with: `curl -s -I http://localhost:3001/map`

---

### Task 3: Interactive Network Map & Face Cards View Component

**Files:**
- Create: `frontend/src/app/map/customer-map-view.tsx`
- Create: `frontend/src/app/map/map.css`

**Interfaces:**
- Consumes: `initialCustomers` (array of customer objects with their linked cases).
- Produces: Interactive client component with:
  - Central Operations Hub node.
  - Orbiting customer nodes with dynamic SVG lines.
  - Real-time search filter and status filter (All, Active Work, No Cases).
  - Dual view toggle ("Network Map" vs "Face Cards Grid").
  - Slide-out customer detail drawer.

- [ ] **Step 1: Implement circular node positioning & SVG line calculations**
  - Compute angles and `(x, y)` coordinates around the center for $N$ nodes.
  - Render SVG paths from center hub $(cx, cy)$ to each node $(x_i, y_i)$.
  - Apply glowing stroke colors based on status (emerald for active cases, slate for inactive).

- [ ] **Step 2: Implement node interaction & drawer**
  - Click node: set `selectedCustomerId`.
  - Slide-out drawer on the right showing:
    - Circular avatar with initials and gradient background.
    - Name, Company, Email (with copy and mailto:), Phone (with tel:).
    - Cases list with status badges (`Open`, `In Progress`, `Closed`).
    - Links to `/customers/{id}` and `/cases?customerId={id}`.
    - Close button (keyboard Escape support).

- [ ] **Step 3: Implement Face Cards Grid view**
  - Toggle between canvas and card grid.
  - Cards show avatar, contact quick-actions, and case pills.

- [ ] **Step 4: Style with dedicated `map.css`**
  - Dark charcoal aesthetic matching Operations Hub.
  - Subtle radial pulse around the central hub.
  - Smooth hover transitions and node badges.

---

### Task 4: End-to-End Build & Functional Verification

**Files:**
- Verify: `frontend/`

- [ ] **Step 1: Run production build check**
  Run: `npm --prefix frontend run build`
  Expected: Build succeeds with 0 errors.

- [ ] **Step 2: Test live in browser**
  Navigate to `http://localhost:3001/map` and verify:
  - "Customer Map" appears in the sidebar menu.
  - Central hub and customer nodes appear with connecting lines.
  - Clicking any node opens the profile drawer with accurate customer cases and details.
  - Toggling between "Network Map" and "Face Cards" works cleanly.
  - Searching by name/company filters both views instantly.
