# Tasks Workspace Quick-Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow operators to update task statuses (`Todo`, `InProgress`, `Done`) directly from the global `/tasks` workspace table with optimistic UI feedback and automatic KPI refresh.

**Architecture:** 
Introduce an interactive `TaskStatusSelector` client component within the `/tasks` table rows, connected to a dedicated Next.js Server Action (`updateTaskStatusAction`) that calls the existing ASP.NET Core `PUT /api/tasks/{id}` endpoint. The action triggers `revalidatePath("/tasks")` and `revalidatePath("/")` to keep the table and dashboard KPI counters immediately synchronized.

**Tech Stack:** Next.js 16 (App Router, Server Actions, React useTransition, optimistic updates), ASP.NET Core 10 Web API, Tailwind CSS, Playwright.

**Spec:** Direct task status management in `/tasks` workspace, addressing the limitation documented in `README.md` ("Task create/edit/delete remains on case details; `/tasks` is browse/filter only").

## Global Constraints
- Preserve existing authentication requirement (JWT via `ops_hub_session`).
- Maintain backward compatibility of existing `PUT /api/tasks/{id}` API contract.
- Keep the charcoal/emerald design system styling consistent across desktop and mobile views.
- Ensure accessible keyboard navigation and ARIA attributes for status selectors.
- Block status updates if the parent case is archived (`409 Conflict`).

## Review Focus
1. Optimistic UI update cleanly reverts if the backend server returns an error.
2. Updating a task to `Done` immediately removes or styles overdue badges.
3. Updating task status revalidates both `/tasks` and the dashboard `/` KPIs.
4. Error state displays an inline accessible toast or alert message.
5. Archival lock: tasks belonging to archived cases display a disabled status badge with an explanatory tooltip.

---

### Task 1: Backend Verification & Server Action for Tasks Workspace

**Files:**
- Create: `frontend/src/app/tasks/task-workspace-actions.ts`
- Test: `frontend/e2e/tasks-workspace-actions.spec.ts`

**Interfaces:**
- Consumes: `updateTask(taskId, input)` from `@/lib/tasks`
- Produces: `updateTaskStatusAction(taskId: number, status: TaskStatus)`

- [ ] **Step 1: Write test for updating task status via API**
  Verify `PUT /api/tasks/{id}` updates status and logs a `TaskUpdated` or `TaskCompleted` activity event.

- [ ] **Step 2: Implement `updateTaskStatusAction` in `frontend/src/app/tasks/task-workspace-actions.ts`**
  ```typescript
  "use server";
  import { revalidatePath } from "next/cache";
  import { updateTask, type TaskStatus } from "@/lib/tasks";

  export async function updateTaskStatusAction(taskId: number, status: TaskStatus) {
    const result = await updateTask(taskId, { status });
    if (result.status === "success") {
      revalidatePath("/tasks");
      revalidatePath("/");
    }
    return result;
  }
  ```

- [ ] **Step 3: Run backend test suite to verify no regressions**
  Run: `dotnet test backend/AiBusiness.slnx`
  Expected: PASS (242 tests passed).

---

### Task 2: Interactive Status Selector Component

**Files:**
- Create: `frontend/src/app/tasks/task-status-selector.tsx`
- Modify: `frontend/src/app/tasks/task-table.tsx:80-82`

**Interfaces:**
- Consumes: `TaskSearchItem` from `@/lib/tasks-workspace-shared`
- Produces: `<TaskStatusSelector task={task} />`

- [ ] **Step 1: Create `TaskStatusSelector` with `useTransition` and optimistic feedback**
  - Renders a styled `<select>` or custom dropdown matching the `.record-status` badge styles.
  - Shows a subtle spinner when pending.
  - Reverts gracefully and displays an accessible error toast on failure.

- [ ] **Step 2: Integrate `TaskStatusSelector` into `TaskTable`**
  Replace the static text `{taskStatusLabel(task.status)}` with `<TaskStatusSelector task={task} />`.

- [ ] **Step 3: Verify build**
  Run: `npm run build` in `frontend/`
  Expected: Compiled successfully with zero errors.

---

### Task 3: End-to-End Browser Verification

**Files:**
- Create: `frontend/e2e/tasks-workspace-actions.spec.ts`

- [ ] **Step 1: Write Playwright E2E test covering:**
  1. Navigating to `/tasks`.
  2. Changing task status from `Todo` to `Done`.
  3. Verifying the status badge and overdue badge update immediately.
  4. Navigating to `/` and verifying the "Overdue tasks" and "Due today" KPI tiles update.
  5. Changing status back to `Todo`.

- [ ] **Step 2: Execute E2E test sequentially**
  Run: `npx playwright test e2e/tasks-workspace-actions.spec.ts`
  Expected: PASS.
