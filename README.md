# AI Business Operations Platform

An enterprise-ready, AI-driven operations platform designed to automate and orchestrate core business workflows, starting with comprehensive Customer Relationship Management (CRM) and extensible agentic operations.

**Version 1 so far:** customers, cases, a Tasks workspace (search/filter across cases), tasks on case details (with activity history), overview dashboard with AI assistant (summaries/drafts), private workspace sign-in (JWT + httpOnly cookie), overdue task visibility, CSV export, and manual PostgreSQL backup/restore scripts. A case is work requested by one existing customer (for example, “Studio 22 needs a booking page”). Each case must belong to a customer that already exists. Each task belongs to one case. There is no public registration. Attachments are not built yet.

---

## 🏗️ Architecture & Technology Stack

```
                          ┌───────────────────────────┐
                          │   Next.js 16 (React 19)   │
                          │   Tailwind CSS v4 App     │
                          └─────────────┬─────────────┘
                                        │ HTTP / REST
                                        ▼
                          ┌───────────────────────────┐
                          │   .NET 10 Web API         │
                          │   (AiBusiness.Api)        │
                          └─────────────┬─────────────┘
                                        │ EF Core 10
                                        ▼
                          ┌───────────────────────────┐
                          │   PostgreSQL Database     │
                          └───────────────────────────┘
```

- **Backend:** ASP.NET Core Web API targeting **.NET 10**
- **ORM & Data:** **Entity Framework Core 10** with **Npgsql** (PostgreSQL)
- **Automated Tests:** **xUnit** controller tests (SQLite in-memory) plus HTTP integration tests (disposable PostgreSQL via Testcontainers)
- **Frontend:** **Next.js 16.3** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS v4**
- **Agent System:** Configured with 200+ engineering skills and Model Context Protocol (MCP) integrations

---

## 📁 Repository Structure

```
├── backend/
│   ├── AiBusiness.slnx                     # .NET Solution file
│   ├── src/
│   │   └── AiBusiness.Api/                 # ASP.NET Core Web API project
│   │       ├── Controllers/                # Customers, Cases, Tasks, Dashboard, Health
│   │       ├── Data/                       # AppDbContext & EF Core migrations
│   │       ├── Models/                     # Domain models (Customer, Case, CaseTask, DashboardSummary)
│   │       └── Program.cs                  # Service bootstrapping & OpenAPI
│   └── tests/
│       └── AiBusiness.Api.Tests/           # xUnit test suite
├── frontend/                               # Next.js 16 App Router application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                    # Overview dashboard
│   │   │   ├── customers/                  # Customer list, create, edit, delete
│   │   │   └── cases/                      # Case list, create, edit, delete
│   │   └── lib/                            # API client & form state utilities
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   └── db/                                 # Manual PostgreSQL backup / restore
├── docs/                                   # Architectural step documentation
├── .cursor/                                # ECC rules, commands, and workflow configs
└── README.md
```

---

## Backup and recovery

Manual backups use PostgreSQL’s `pg_dump` / `pg_restore` (custom format `-Fc`). Scripts live in `scripts/db/` and write dumps **outside the repository**.

**Default storage (protected local folder):**

- macOS: `~/Library/Application Support/AiBusiness/backups/`
- Linux: `~/.local/share/aibusiness/backups/` (or `$XDG_DATA_HOME/aibusiness/backups/`)

Override with `AIBUSINESS_BACKUP_DIR`. Dump files are mode `600`. **Backups contain customer data** — keep them private, do not commit them, and do not share them over insecure channels. Cloud upload and scheduled jobs are not included yet.

### Backup

```bash
# Uses ConnectionStrings:DefaultConnection from API user-secrets (password never printed)
./scripts/db/backup.sh --from-user-secrets
```

Creates `aibusiness_customers_dev_<UTC-timestamp>.dump` plus a small `.meta.json` (host/db/size only — no row contents). Includes `Customers`, `CustomerNotes`, `Cases`, `CaseTasks`, `CaseActivities`, and `__EFMigrationsHistory`.

Equivalent: set `ConnectionStrings__DefaultConnection` (or `AIBUSINESS_DATABASE_URL`) and run `./scripts/db/backup.sh`.

### Restore (disposable database only)

```bash
./scripts/db/restore.sh --from-user-secrets \
  --dump "$HOME/Library/Application Support/AiBusiness/backups/<file>.dump" \
  --cleanup
```

- Restores into a **new** database named `aibusiness_restore_<UTC-timestamp>` by default.
- **Refuses** destination `aibusiness_customers_dev` and any name that does not start with `aibusiness_restore_`.
- Leaves the live development database and running containers/services unchanged.
- Compares customer/case/task/note **counts**, checks orphan relationships, and confirms joins are readable.
- `--cleanup` drops the disposable database after a successful check. Without it, drop later:

```bash
./scripts/db/drop-restore-db.sh --from-user-secrets --database aibusiness_restore_<timestamp>
```

### Cleanup of old dump files

Delete outdated `.dump` / `.dump.meta.json` files from the backup folder when you no longer need them (Finder/`rm`). Do not move dumps into the git work tree.

---

## 🚀 Getting Started

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/)
- [PostgreSQL](https://www.postgresql.org/)

---

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Run tests:**
   ```bash
   /Users/raed22/.dotnet/dotnet test
   ```
   *(Controller tests use in-memory SQLite. HTTP integration tests start their own disposable PostgreSQL container and never use the development database.)*

3. **Configure the connection string:**
   ```bash
   dotnet user-secrets set --project src/AiBusiness.Api "ConnectionStrings:DefaultConnection" "Host=localhost;Database=aibusiness;Username=postgres;Password=your_password"
   ```
   Use your own database host, name, username, and password. Do not commit real credentials.

4. **Configure workspace sign-in (required) and OpenAI (optional for local mock):**
   ```bash
   # Private workspace credentials — never commit these values
   dotnet user-secrets set --project src/AiBusiness.Api "Auth:Username" "your-workspace-user"
   dotnet user-secrets set --project src/AiBusiness.Api "Auth:Password" "your-long-password"
   dotnet user-secrets set --project src/AiBusiness.Api "Auth:JwtSigningKey" "replace-with-32-or-more-random-characters"

   # Optional OpenAI
   dotnet user-secrets set --project src/AiBusiness.Api "OpenAI:ApiKey" "your-openai-api-key"
   dotnet user-secrets set --project src/AiBusiness.Api "OpenAI:Model" "gpt-4o-mini"
   ```
   Equivalent environment variables: `Auth__Username`, `Auth__Password`, `Auth__JwtSigningKey`, `OpenAI__ApiKey`, `OpenAI__Model`. Never put secrets in frontend code, logs, or committed files. If `OpenAI:ApiKey` is missing, the API uses a deterministic mock provider and returns `source: "mock"` with a setup hint. If Auth secrets are missing, health still works but login returns `503`.

5. **Run the API server:**
   ```bash
   dotnet run --project src/AiBusiness.Api
   ```
   The API will listen on `http://localhost:5222` (and HTTPS on `5223`).

---

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   Create a `.env.local` file based on `.env.example`:
   ```bash
   cp .env.example .env.local
   ```
   Ensure `API_BASE_URL` points to your backend:
   ```env
   API_BASE_URL=http://localhost:5222
   ```

4. **Start the Next.js development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Sign-in

Open [http://localhost:3000/login](http://localhost:3000/login).

- One private workspace user (configured via `Auth:*` secrets). No public registration.
- Successful sign-in stores a JWT in an **httpOnly** cookie (`ops_hub_session`). The browser never receives the API password.
- Next.js server components and server actions send `Authorization: Bearer <token>` to the ASP.NET API.
- Middleware redirects unauthenticated visitors to `/login`. Sign out clears the cookie.
- All CRM and assistant API routes require a valid JWT. Public: `GET /api/health`, `POST /api/auth/login`, `POST /api/auth/logout`.
- Assistant endpoints are rate-limited per authenticated user (`RateLimiting:Assistant:PermitLimit` / `WindowSeconds`, defaults 20 / 60s). Over quota returns **HTTP 429**; the assistant panel shows a wait-and-retry message.

**Deployment notes (not done here):** use HTTPS and `AUTH_COOKIE_SECURE=true`, rotate `Auth:JwtSigningKey`, keep passwords only in a secret store, and place the API behind a private network or reverse proxy. Multi-instance rate limits need a shared store.

---

## Dashboard

Open [http://localhost:3000/](http://localhost:3000/).

- Three columns connect the customer list, selected case and tasks, and assistant/KPI panels. Selecting a customer or case keeps the selection in the URL. The top bar searches customers.
- Shared navigation includes **Dashboard**, **Customers**, and **Cases**. It becomes a keyboard-accessible menu on mobile.
- KPI tiles include **Overdue tasks** and **Due today** counts (all matching rows, not one page), plus active cases and customers. An **Outstanding tasks** list shows open work earliest due first (with priority labels), each linking to its case.
- Due dates are calendar dates. A task is **Overdue** when its due date is before today in the business time zone (`BusinessTimezone:TimeZoneId`, default `Europe/Copenhagen`) and status is not Done. Tasks due today are not overdue.
- The case timeline shows the actual creation time and current tasks (with priority and Overdue when applicable). The case brief can be copied from saved data.
- **AI assistant:** With a case selected, **Generate summary** and **Draft response** call the backend. Results appear in an editable panel with **Copy**, loading text, errors, and **Retry**. Duplicate clicks are blocked while a request is in flight; output clears when the selected case changes. **Schedule follow-up** and **Escalation check** stay disabled and marked Coming soon.
- Generation sends the selected case’s title, description, and status, the customer’s name/company/email, and task titles/statuses/priorities/due dates/descriptions to the configured OpenAI-compatible provider (or the local mock). Treat that as sharing operational data with the provider.
- Loading, empty results, and API failure (with **Try again**) are handled separately. Failed requests do not show zero counts.
- Customers, Cases, details, and task forms share the dashboard's charcoal/green design. Desktop lists place the creation form beside the records; narrow screens stack the panels and scroll tables within their own area.

---

## Customers

Open [http://localhost:3000/customers](http://localhost:3000/customers).

- **Create:** Add name, email, and optional phone/company. After create, any search is cleared and the list returns to page 1 so the new row is in the ordered list (clearing search was the previous behavior).
- **Search:** Filter by a case-insensitive substring of name, email, or company. The search stays in the URL (for example `/customers?search=studio`). Surrounding whitespace is trimmed; blank search means no filter. Matching is literal (special characters like `%` are not wildcards). Changing search resets to page 1.
- **Export CSV:** Downloads all customers matching the current search (every page, not only the rows on screen). Columns: Id, Name, Email, Phone, Company, Created At (UTC). Formula-like values are neutralized for spreadsheets. Rejected when the match set exceeds `CsvExport:MaxRows` (default 10,000). Export does not change records; no file is kept on the server.
- **Pagination:** Lists request page size 20. Previous/Next controls and a results count stay in sync with `?page=` in the URL. Deleting the last row on a page returns to the last valid page.
- **Edit / Delete:** Search and page stay in the URL after edit or delete.
- **Details:** Customer names link to `/customers/{id}` and keep list search and page in the details URL so **Back to customers** returns to the same list page.

Empty list messages: “No customers yet.” or “No customers match your search.”

### `/customers/[id]` page

Open a customer from the list, or go directly to [http://localhost:3000/customers/1](http://localhost:3000/customers/1) (use a real id).

- Shows name, email, phone, company, and created time labeled as UTC. Missing phone or company show “No phone provided” / “No company provided”.
- Loading, missing customer (`404`), and API failure (with **Try again**) are handled separately.
- Lists that customer’s cases (title linked to `/cases/{id}`, status, created time, Archived label when archived). Empty list shows “No cases for this customer.” A cases-load failure shows an error in the cases section without hiding the customer details.
- Includes a link to the Cases page filtered by this customer (`/cases?customerId={id}`).
- **Notes:** Plain-text internal notes for the customer (author + created/edited UTC times). Add, edit with cancel, and confirmed delete. Loading, empty, error/retry, and **Load more**. Entered text is kept after validation errors; submit is disabled while pending. Content is rendered as plain text (not HTML). Notes are not sent to the AI provider and are not included in CSV exports. When a customer is deleted, their notes are removed with them (cascade).
- **Edit customer** reuses the same edit form as the list: name, email, phone, and company. Id and created time stay unchanged. Failed saves keep entered values; successful saves refresh the details and show a confirmation. Cancel leaves saved data unchanged.
- Deletion is not available on the details page yet.

---

## Cases

A **case** is a piece of work requested by one existing customer. The customer must already exist; a case cannot be created without a valid `customerId`, and a case cannot be moved to another customer after creation.

### Case fields

| Field | Notes |
| :--- | :--- |
| `id` | Server-assigned. |
| `customerId` | Required. Must refer to an existing customer. Set at creation and not changed by update. |
| `title` | Required. Non-whitespace text, maximum 200 characters. |
| `description` | Optional. May be cleared on update. |
| `status` | `Open`, `InProgress`, or `Closed`. New cases always start as `Open`. |
| `createdAt` | Server-assigned UTC time. Preserved on update. |
| `archivedAt` | Nullable server-assigned UTC time. Set when a Closed case is archived; cleared on restore. Existing rows stay null until archived. |

### `/cases` page

Open [http://localhost:3000/cases](http://localhost:3000/cases).

- **Create:** Choose a customer, enter a title, optionally add a description. New cases start as Open (status is not chosen on create). After create, the list shows that customer and clears status and search filters (and returns to page 1) so the new Open case is visible.
- **Filter:** Filter by customer and/or status (`All statuses`, `Open`, `In progress`, `Closed`), archive (`Active` default, `Archived`, or `All`), and optionally search title or description. Filters and page stay in the URL together. Changing search or filters resets to page 1. Active excludes archived cases.
- **Search:** Case-insensitive substring of title or description. Same trim/blank/literal rules as customer search.
- **Export CSV:** Downloads all cases matching the current customer/status/search/archive filters (every page). Columns: Id, Customer Id, Customer Name, Title, Description, Status, Created At (UTC), Archived At (UTC). Same size limit and spreadsheet-safety rules as customer export. Does not include activity history or credentials. Export does not change records.
- **Pagination:** Lists request page size 20 with Previous/Next and a results count. Deleting the last row on a page returns to the last valid page.
- **Edit:** Change title, description, and status (Open, In progress, Closed). The customer is shown read-only. Customer, status, search, archive, and page filters stay active after save. If the new status is outside the current status filter, the case leaves that filtered list and a success message still appears. Archived cases cannot be edited until restored.
- **Archive:** Closed cases with every task Done (or no tasks) can be archived from the list or details after a named confirmation. Archiving preserves the case, tasks, and activity history and marks the case read-only. The UI explains why archive is unavailable when status is not Closed or tasks are incomplete. Already archived cases cannot be archived again.
- **Restore:** Clears `archivedAt`, leaves status Closed, and returns the case to the Active list.
- **Delete:** Confirm in a dialog before the case is removed. Customer, status, search, archive, and page filters stay in the URL. Archived cases are not deleted from the list actions (restore first if needed). Customer delete remains blocked while any associated cases exist, including archived ones.
- **Details:** Case titles link to `/cases/{id}`. List filters including page and archive are kept in the details URL so **Back to cases** returns to the same filtered page. Opening a details URL directly (no filter query) goes back to `/cases`.

Empty list messages: “No cases yet.”, “No cases for this customer.”, “No cases with this status.”, “No archived cases.”, “No cases match your search.”, or “No cases match these filters.” when more than one filter is active.

If there are no customers yet, the page explains that a customer must be added first and links to `/customers`.

### `/cases/[id]` page

Open a case from the list, or go directly to [http://localhost:3000/cases/1](http://localhost:3000/cases/1) (use a real id).

- Shows title, description (or “No description provided”), customer name (linked to `/customers/{customerId}`), status, created time labeled as UTC, and archived time when archived.
- Loading, missing case (`404`), and API failure (with **Try again**) are handled separately.
- **Edit case** reuses the same edit form as the list: title, description, and status only. Customer, id, and created time stay unchanged. Failed saves keep entered values; successful saves refresh the details and show a confirmation. Cancel leaves saved data unchanged. Hidden while archived.
- **Archive / Restore:** Archive uses a named confirmation. Archived cases show an **Archived** label and a Restore action; the case and its tasks stay read-only until restored.
- Deletion is not available on the details page yet.
- **Tasks:** Loads `GET /api/tasks?caseId={id}` under the case details (case fields stay visible while tasks load, show empty, or fail with **Try again**). The table shows Title, Status (`To do`, `In progress`, `Done`), Priority (`Low`, `Normal`, `High`), and Due date (date-only values displayed without timezone conversion; empty due dates show as —). Compact priority labels use text and color. An **Overdue** label (text + color) appears when the due date is before business today and status is not Done. Create/edit/delete are hidden while the case is archived (API also rejects those mutations).
- **Activity:** Read-only product history for the case (separate from the task list). Shows creates, edits, status changes, archive/restore, and task create/update/complete/delete events (including priority changes) with UTC times and the authenticated actor when available. Includes loading, empty, error/retry, and **Load more**. History starts when activity tracking was enabled — older cases are not backfilled. This is product activity history, not a tamper-proof audit log.
- **Add task:** Title required; optional Description and Due date; Priority selector (defaults to Normal). The open case supplies `caseId`; new tasks start as To do. Failed creates keep entered values and disable repeat submits while pending. Successful creates clear the form, refresh the list, and show a confirmation.
- **Edit task:** Change Title, Description, Due date, Status, and Priority. Optional fields can be cleared. Cancel leaves saved data unchanged. Failed saves keep entered values.
- **Delete task:** Confirm in an accessible dialog that names the task. Cancel closes without deleting. Success removes the row and shows confirmation outside the closed dialog; failure keeps the row and shows the error. The case and other tasks stay unchanged.

---

## Tasks workspace

Open [http://localhost:3000/tasks](http://localhost:3000/tasks).

- **Browse:** Lists tasks across cases with title, customer, case, status, priority, and due date. Title and case link to case details; customer links to the customer. Edit and delete stay on case details for this milestone.
- **Filters:** Customer, case, status (`To do` / `In progress` / `Done`), priority (`Low` / `Normal` / `High`), due date (`Overdue` / `Due today` / `Upcoming` / `No due date`), sort (`Due date` default, or `Priority`), and title/description search. Filters, sort, and page stay in the URL. Changing filters or sort resets to page 1.
- **Due buckets:** Use the same business-timezone rules as the dashboard (default Europe/Copenhagen). Overdue / due today / upcoming exclude Done tasks.
- **Sort:** Due date sorts earliest first (undated last), then by id. Priority sorts High → Normal → Low, then due date, then id.
- **Pagination:** Page size 20 with Previous/Next.
- **Dashboard:** Business KPI tiles for overdue and due-today open `/tasks?due=overdue` and `/tasks?due=today`.

---

## 📡 API Endpoints

### OpenAPI document

In Development, the generated OpenAPI 3 document is served at:

[http://localhost:5222/openapi/v1.json](http://localhost:5222/openapi/v1.json)

No Swagger UI is bundled. Use that URL with any OpenAPI client, or open it in a browser.

### Example requests (placeholders)

```bash
# Dashboard summary
curl -s http://localhost:5222/api/dashboard/summary

# Create customer
curl -s -X POST http://localhost:5222/api/customers \
  -H 'Content-Type: application/json' \
  -d '{"name":"Example Customer","email":"example@example.com","phone":null,"company":null}'

# List customers (unpaginated array)
curl -s 'http://localhost:5222/api/customers?search=Example'

# List customers (paginated)
curl -s 'http://localhost:5222/api/customers?search=Example&page=1&pageSize=20'

# Get / update / delete customer (replace {customerId})
curl -s http://localhost:5222/api/customers/{customerId}
curl -s -X PUT http://localhost:5222/api/customers/{customerId} \
  -H 'Content-Type: application/json' \
  -d '{"name":"Example Customer","email":"example@example.com","phone":null,"company":null}'
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://localhost:5222/api/customers/{customerId}

# Create case (always stored as Open; replace {customerId})
curl -s -X POST http://localhost:5222/api/cases \
  -H 'Content-Type: application/json' \
  -d '{"customerId":{customerId},"title":"Example case","description":"Optional details"}'

# List cases with filters + pagination
curl -s 'http://localhost:5222/api/cases?customerId={customerId}&status=Open&search=Example&page=1&pageSize=20'

# Update case status (replace {caseId}); id/customerId/createdAt in the body are ignored
curl -s -X PUT http://localhost:5222/api/cases/{caseId} \
  -H 'Content-Type: application/json' \
  -d '{"title":"Example case","description":"Optional details","status":"InProgress"}'

# Delete case then customer
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://localhost:5222/api/cases/{caseId}
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://localhost:5222/api/customers/{customerId}

# Create task (always stored as Todo; priority defaults to Normal; replace {caseId})
curl -s -X POST http://localhost:5222/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"caseId":{caseId},"title":"Design the booking page","description":"Optional","dueDate":"2026-10-15","priority":"High"}'

# List / update / delete task (replace {taskId}); omit priority on update to leave it unchanged
curl -s 'http://localhost:5222/api/tasks?caseId={caseId}&status=Todo'
curl -s -X PUT http://localhost:5222/api/tasks/{taskId} \
  -H 'Content-Type: application/json' \
  -d '{"title":"Design the booking page","description":null,"dueDate":null,"status":"InProgress"}'
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://localhost:5222/api/tasks/{taskId}

# Search tasks (optional priority filter and sort=due|priority)
curl -s 'http://localhost:5222/api/tasks/search?priority=High&sort=priority&page=1&pageSize=20'

# AI assistant (replace {caseId}; loads case/customer/tasks server-side; requires Bearer token)
curl -s -X POST http://localhost:5222/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"your-workspace-user","password":"your-long-password"}'
# Use the returned accessToken:
curl -s -X POST http://localhost:5222/api/assistant/cases/{caseId}/summary \
  -H "Authorization: Bearer {accessToken}"
curl -s -X POST http://localhost:5222/api/assistant/cases/{caseId}/draft-response \
  -H "Authorization: Bearer {accessToken}"
```

### Auth (`/api/auth`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Validates configured workspace credentials. Returns `{ accessToken, expiresAt, displayName }`. `401` on bad credentials; `503` if Auth secrets are missing. |
| `POST` | `/api/auth/logout` | No-op for the API (JWT is stateless). Clients clear their session cookie. |
| `GET` | `/api/auth/me` | Returns the authenticated display name (`401` without a token). |

### Dashboard (`/api/dashboard`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard/summary` | Returns DB totals: `totalCustomers`, `totalCases`, `openCases`, `inProgressCases`, `closedCases`, `overdueTasks`, `dueTodayTasks`, compact `outstandingTasks` (earliest due first, max 8), plus `businessTimeZone` and `businessToday`. Case and task counts exclude archived cases by default. Overdue = due before business today and not Done. Empty tables return zeros. |

### Assistant (`/api/assistant`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/assistant/cases/{caseId}/summary` | Loads the case, customer, and tasks server-side and returns a short summary (`requestSummary`, `status`, `outstandingTasks`, `suggestedNextAction`, `formattedText`). Facts come from saved data; the suggested next action is labeled as a suggestion. Uses OpenAI when `OpenAI:ApiKey` is set; otherwise a mock (`source: "mock"`) with `setupHint`. `404` if the case is missing; `502` on provider failure; `504` on timeout. |
| `POST` | `/api/assistant/cases/{caseId}/draft-response` | Same data load; returns editable `draftText` for review/copy (does not send messages). Same status codes and mock behavior as summary. |

**Privacy:** these endpoints send case title/description/status, customer name/company/email, and task title/description/status/due date to the provider. Customer notes are never included. Do not use production secrets in the frontend.

### Customers (`/api/customers`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/customers` | Without `page`/`pageSize`: returns an array of all customers, ordered by `id`. With `page` and/or `pageSize`: returns `{ items, page, pageSize, totalCount }`. Defaults: `page=1`, `pageSize=20` (max `100`). Invalid page/pageSize return `400`. Optional `?search=` matches name, email, or company with a case-insensitive substring. Search applies before count and slice. Out-of-range pages return empty `items` with the correct `totalCount`. |
| `GET` | `/api/customers/export` | UTF-8 CSV (BOM) of all customers matching the same optional `?search=` as the list, ordered by `id` (not paginated). Columns: Id, Name, Email, Phone, Company, Created At (UTC). Returns `400` when matches exceed `CsvExport:MaxRows`. Auth required. Read-only. |
| `GET` | `/api/customers/{id}` | Returns a single customer by ID (`200`), or `404` if missing. |
| `POST` | `/api/customers` | Validates required name/email, sets server ID and UTC timestamp, returns `201 Created`. |
| `PUT` | `/api/customers/{id}` | Updates name, email, phone, and company while preserving ID and creation timestamp (`200`, or `404`). |
| `DELETE` | `/api/customers/{id}` | Deletes the customer (`204`). Returns `404` if missing. Returns `409 Conflict` with detail `This customer has cases and cannot be deleted.` when the customer still has cases. When deletion succeeds, related `CustomerNotes` rows are removed with the customer (cascade). |
| `GET` | `/api/customers/{customerId}/notes` | Paginated notes for one customer, newest first (`{ items, page, pageSize, totalCount }`; defaults page=1, pageSize=20, max 100). `404` if the customer is missing. Auth required. |
| `POST` | `/api/customers/{customerId}/notes` | Creates a plain-text note. Required non-blank `content` (max 5,000). Server sets `id`, authenticated `authorName`, UTC `createdAt`, and clears `updatedAt`. Returns `201`, `400`, or `404`. |
| `PUT` | `/api/customers/{customerId}/notes/{noteId}` | Updates content only; preserves `authorName` and `createdAt`; sets UTC `updatedAt`. Returns `200`, `400`, or `404` (including when the note is not on that customer). |
| `DELETE` | `/api/customers/{customerId}/notes/{noteId}` | Deletes that note (`204`), or `404` if missing / not on that customer. Leaves the customer and other notes unchanged. |

### Cases (`/api/cases`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/cases` | Without `page`/`pageSize`: returns an array of cases, newest first (then highest `id`). With `page` and/or `pageSize`: returns `{ items, page, pageSize, totalCount }` with the same defaults/limits as customers. Optional `?customerId=`, `?status=` (`Open`, `InProgress`, or `Closed`), `?archive=` (`active` default, `archived`, or `all`), and/or `?search=` (title or description, case-insensitive substring). Filters combine and apply before count and slice. Invalid status or page/pageSize return `400`. Empty unpaginated list is `[]`; out-of-range pages return empty `items` with the correct `totalCount`. |
| `GET` | `/api/cases/export` | UTF-8 CSV (BOM) of all cases matching the same optional filters as the list (including `archive`), newest first. Columns: Id, Customer Id, Customer Name, Title, Description, Status, Created At (UTC), Archived At (UTC). Returns `400` when matches exceed `CsvExport:MaxRows` or status is invalid. Auth required. Read-only; excludes activity history. |
| `GET` | `/api/cases/{id}` | Returns one case (`200`), or `404` if missing. |
| `POST` | `/api/cases` | Creates a case for an existing customer. Forces status `Open`. Returns `201 Created` with a `Location` header, or `400` for invalid input. |
| `PUT` | `/api/cases/{id}` | Updates title, description, and status only (`200`). Returns `400` for invalid input (including invalid status), `404` if missing, or `409` when the case is archived. Does not change `id`, `customerId`, `createdAt`, or `archivedAt`. |
| `DELETE` | `/api/cases/{id}` | Deletes that case (`204`), or `404` if missing. Returns `409 Conflict` with detail `This case has tasks and cannot be deleted.` when the case still has tasks, or when the case is archived. Leaves the customer and other cases unchanged. Related `CaseActivities` rows are removed with the case (cascade). |
| `POST` | `/api/cases/{id}/archive` | Archives a Closed case when every related task is Done (or there are no tasks). Sets server UTC `archivedAt`, preserves case/tasks/activity, records CaseArchived. Returns `200`, `404`, or `409` when ineligible or already archived. |
| `POST` | `/api/cases/{id}/restore` | Clears `archivedAt`, leaves status Closed, records CaseRestored. Returns `200`, `404`, or `409` when not archived. |
| `GET` | `/api/cases/{caseId}/activity` | Paginated product activity for one case, newest first (`{ items, page, pageSize, totalCount }`; defaults page=1, pageSize=20, max 100). `404` if the case is missing. Auth required. Read-only — no create/update/delete activity endpoints. |

### Tasks (`/api/tasks`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/tasks` | Returns an array of tasks, newest `createdAt` first (then highest `id`). Optional `?caseId=` and/or `?status=` (`Todo`, `InProgress`, or `Done`, case-sensitive). Filters combine. Invalid status returns `400`. |
| `GET` | `/api/tasks/search` | Cross-case workspace search. Returns `{ items, page, pageSize, totalCount }` (defaults page=1, pageSize=20, max 100). Optional `search` (title/description), `customerId`, `caseId`, `status`, and `due` (`overdue`\|`today`\|`upcoming`\|`none`). Due buckets use BusinessTimezone today; overdue/today/upcoming exclude Done. Excludes tasks on archived cases. Filters apply before count/slice. Order: earliest due date, undated last, then `id`. Each item includes customer/case names and overdue/due-today flags. Auth required. |
| `GET` | `/api/tasks/{id}` | Returns one task (`200`), or `404` if missing. |
| `POST` | `/api/tasks` | Creates a task for an existing case. Forces status `Todo`. Required `caseId` and `title` (1–200 chars). Optional `description` and `dueDate` (date only). Returns `201 Created` with a `Location` header, or `400` for invalid input. Ignores submitted `id`, `status`, and `createdAt`. |
| `PUT` | `/api/tasks/{id}` | Updates `title`, `description`, `dueDate`, and `status` only (`200`). Null/blank description or null `dueDate` clears those fields. Returns `400` for invalid input, or `404` if missing. Does not change `id`, `caseId`, or `createdAt`. |
| `DELETE` | `/api/tasks/{id}` | Deletes that task (`204`), or `404` if missing. Leaves the case and other tasks unchanged. |

---

## 🧪 Testing Summary

The backend includes an xUnit test suite in `backend/tests/AiBusiness.Api.Tests`:

- **Controller / storage tests** — call controllers (or EF) directly against an in-memory SQLite database. They do not use PostgreSQL or HTTP.
- **HTTP integration tests** — real requests through `WebApplicationFactory` against a disposable PostgreSQL database started by Testcontainers. A guard rejects the known development database name `aibusiness_customers_dev`. Tests never reset or truncate the development database; cleanup is limited to the container the suite started (stopped on dispose).

### Controller suite (SQLite)

```bash
dotnet test backend/tests/AiBusiness.Api.Tests --filter "FullyQualifiedName!~Integration"
```

### Integration suite (PostgreSQL)

**Prerequisites:** .NET 10 SDK, Docker available to the test process.

**Copyable command:**

```bash
dotnet test backend/tests/AiBusiness.Api.Tests --filter "FullyQualifiedName~Integration"
```

If Docker/PostgreSQL cannot start, those tests are **skipped** (suite not run)—they are not reported as passed.

Environment variables or secrets are optional for integration tests; the suite builds its own connection string to the disposable container. Do not point tests at the development database.

**Packages added for this suite (test project only):**

| Package | Why |
| :--- | :--- |
| `Microsoft.AspNetCore.Mvc.Testing` | In-process HTTP test host (`WebApplicationFactory`) |
| `Testcontainers.PostgreSql` | Starts/stops a disposable PostgreSQL container owned by the tests |
| `Xunit.SkippableFact` | Marks the integration suite skipped when PostgreSQL is unavailable |

Run everything:
```bash
dotnet test backend
```

### Browser regression suite (Playwright)

Focused Chromium checks for customers/cases flows and case-details task CRUD (including mocked delay/failure checks through an e2e-only API proxy on port 5230 in front of the disposable API on 5231). Global setup starts a **separate** disposable PostgreSQL container (`aibusiness_browser_e2e`), API behind that proxy, builds the frontend, and serves it with `next start` on `localhost:3100` (so it does not conflict with `next dev` on 3000). It never resets `aibusiness_customers_dev` and does not stop the development servers on ports 3000/5222/5434.

**Prerequisites:** Node.js 20+, .NET 10 SDK (`~/.dotnet/dotnet`), Docker, Playwright Chromium (`npx playwright install chromium`).

**Copyable command:**

```bash
cd frontend && npm run test:e2e
```

Each test creates disposable records and deletes them (UI path or API fallback). Teardown stops only the API/frontend processes and Docker container started by the suite. If Docker or the disposable stack cannot start, tests are **skipped** (not passed).

**Dev dependency:** `@playwright/test` (browser automation only).

Frontend checks:
```bash
cd frontend
npm run lint
npm run build
```

---

## Current limitations

- Single configured workspace user (no multi-user roles or public registration).
- JWT logout is cookie-clear only; tokens remain valid until expiry unless the signing key is rotated.
- In-memory assistant rate limits are per API process.
- Backup/restore is manual only (no cloud storage or scheduling yet).
- Case activity history is product event history (not a tamper-proof audit log) and starts when recording was enabled.
- Task create/edit/delete remains on case details (the `/tasks` workspace is browse/filter only).
- No attachments.
- Browser e2e does not cover mocked network-drop failures for task create/edit/delete (HTTP error mocks are covered).
- Manual screen-reader verification of task live regions and dialog announcements is not part of the automated suite.
