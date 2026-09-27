# AI Business Operations Platform

An enterprise-ready, AI-driven operations platform designed to automate and orchestrate core business workflows, starting with comprehensive Customer Relationship Management (CRM) and extensible agentic operations.

**Version 1 so far:** customers, cases, and an overview dashboard. A case is work requested by one existing customer (for example, “Studio 22 needs a booking page”). Each case must belong to a customer that already exists. Tasks, attachments, and AI features are not built yet.

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
│   │       ├── Controllers/                # Customers, Cases, Dashboard, Health
│   │       ├── Data/                       # AppDbContext & EF Core migrations
│   │       ├── Models/                     # Domain models (Customer, Case, DashboardSummary)
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
├── docs/                                   # Architectural step documentation
├── .cursor/                                # ECC rules, commands, and workflow configs
└── README.md
```

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

4. **Run the API server:**
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

## Overview

Open [http://localhost:3000/](http://localhost:3000/).

- Shows total customer and case counts, plus case counts by status (Open, In progress, Closed).
- Shared navigation includes **Overview**, **Customers**, and **Cases** on list and details pages.
- Total cards link to `/customers` and `/cases`. Status cards link to `/cases` with the matching status filter (for example `/cases?status=Open`).
- Loading, empty (“No customers or cases yet”), and API failure (with **Try again**) are handled separately. Failed requests do not show zero counts.
- No charts, trends, percentages, or invented activity data.

---

## Customers

Open [http://localhost:3000/customers](http://localhost:3000/customers).

- **Create:** Add name, email, and optional phone/company. After create, any search is cleared and the list returns to page 1 so the new row is in the ordered list (clearing search was the previous behavior).
- **Search:** Filter by a case-insensitive substring of name, email, or company. The search stays in the URL (for example `/customers?search=studio`). Surrounding whitespace is trimmed; blank search means no filter. Matching is literal (special characters like `%` are not wildcards). Changing search resets to page 1.
- **Pagination:** Lists request page size 20. Previous/Next controls and a results count stay in sync with `?page=` in the URL. Deleting the last row on a page returns to the last valid page.
- **Edit / Delete:** Search and page stay in the URL after edit or delete.
- **Details:** Customer names link to `/customers/{id}` and keep list search and page in the details URL so **Back to customers** returns to the same list page.

Empty list messages: “No customers yet.” or “No customers match your search.”

### `/customers/[id]` page

Open a customer from the list, or go directly to [http://localhost:3000/customers/1](http://localhost:3000/customers/1) (use a real id).

- Shows name, email, phone, company, and created time labeled as UTC. Missing phone or company show “No phone provided” / “No company provided”.
- Loading, missing customer (`404`), and API failure (with **Try again**) are handled separately.
- Lists that customer’s cases (title linked to `/cases/{id}`, status, created time). Empty list shows “No cases for this customer.” A cases-load failure shows an error in the cases section without hiding the customer details.
- Includes a link to the Cases page filtered by this customer (`/cases?customerId={id}`).
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

### `/cases` page

Open [http://localhost:3000/cases](http://localhost:3000/cases).

- **Create:** Choose a customer, enter a title, optionally add a description. New cases start as Open (status is not chosen on create). After create, the list shows that customer and clears status and search filters (and returns to page 1) so the new Open case is visible.
- **Filter:** Filter by customer and/or status (`All statuses`, `Open`, `In progress`, `Closed`), and optionally search title or description. Customer, status, search, and page stay in the URL together (for example `/cases?customerId=3&status=Open&search=booking&page=2`). Changing search or filters resets to page 1.
- **Search:** Case-insensitive substring of title or description. Same trim/blank/literal rules as customer search.
- **Pagination:** Lists request page size 20 with Previous/Next and a results count. Deleting the last row on a page returns to the last valid page.
- **Edit:** Change title, description, and status (Open, In progress, Closed). The customer is shown read-only. Customer, status, search, and page filters stay active after save. If the new status is outside the current status filter, the case leaves that filtered list and a success message still appears.
- **Delete:** Confirm in a dialog before the case is removed. Customer, status, search, and page filters stay in the URL.
- **Details:** Case titles link to `/cases/{id}`. List filters including page are kept in the details URL so **Back to cases** returns to the same filtered page. Opening a details URL directly (no filter query) goes back to `/cases`.

Empty list messages: “No cases yet.”, “No cases for this customer.”, “No cases with this status.”, “No cases match your search.”, or “No cases match these filters.” when more than one of customer/status/search is active.

If there are no customers yet, the page explains that a customer must be added first and links to `/customers`.

### `/cases/[id]` page

Open a case from the list, or go directly to [http://localhost:3000/cases/1](http://localhost:3000/cases/1) (use a real id).

- Shows title, description (or “No description provided”), customer name (linked to `/customers/{customerId}`), status, and created time labeled as UTC.
- Loading, missing case (`404`), and API failure (with **Try again**) are handled separately.
- **Edit case** reuses the same edit form as the list: title, description, and status only. Customer, id, and created time stay unchanged. Failed saves keep entered values; successful saves refresh the details and show a confirmation. Cancel leaves saved data unchanged.
- Deletion is not available on the details page yet.

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
```

### Dashboard (`/api/dashboard`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/dashboard/summary` | Returns count totals calculated in the database: `totalCustomers`, `totalCases`, `openCases`, `inProgressCases`, `closedCases`. Empty tables return zeros. |

### Customers (`/api/customers`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/customers` | Without `page`/`pageSize`: returns an array of all customers, ordered by `id`. With `page` and/or `pageSize`: returns `{ items, page, pageSize, totalCount }`. Defaults: `page=1`, `pageSize=20` (max `100`). Invalid page/pageSize return `400`. Optional `?search=` matches name, email, or company with a case-insensitive substring. Search applies before count and slice. Out-of-range pages return empty `items` with the correct `totalCount`. |
| `GET` | `/api/customers/{id}` | Returns a single customer by ID (`200`), or `404` if missing. |
| `POST` | `/api/customers` | Validates required name/email, sets server ID and UTC timestamp, returns `201 Created`. |
| `PUT` | `/api/customers/{id}` | Updates name, email, phone, and company while preserving ID and creation timestamp (`200`, or `404`). |
| `DELETE` | `/api/customers/{id}` | Deletes the customer (`204`). Returns `404` if missing. Returns `409 Conflict` with detail `This customer has cases and cannot be deleted.` when the customer still has cases. |

### Cases (`/api/cases`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/cases` | Without `page`/`pageSize`: returns an array of cases, newest first (then highest `id`). With `page` and/or `pageSize`: returns `{ items, page, pageSize, totalCount }` with the same defaults/limits as customers. Optional `?customerId=`, `?status=` (`Open`, `InProgress`, or `Closed`), and/or `?search=` (title or description, case-insensitive substring). Filters combine and apply before count and slice. Invalid status or page/pageSize return `400`. Empty unpaginated list is `[]`; out-of-range pages return empty `items` with the correct `totalCount`. |
| `GET` | `/api/cases/{id}` | Returns one case (`200`), or `404` if missing. |
| `POST` | `/api/cases` | Creates a case for an existing customer. Forces status `Open`. Returns `201 Created` with a `Location` header, or `400` for invalid input. |
| `PUT` | `/api/cases/{id}` | Updates title, description, and status only (`200`). Returns `400` for invalid input (including invalid status), or `404` if missing. Does not change `id`, `customerId`, or `createdAt`. |
| `DELETE` | `/api/cases/{id}` | Deletes that case (`204`), or `404` if missing. Leaves the customer and other cases unchanged. |

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

Focused Chromium checks for customers/cases flows. Global setup starts a **separate** disposable PostgreSQL container (`aibusiness_browser_e2e`), API on `127.0.0.1:5230`, builds the frontend, and serves it with `next start` on `localhost:3100` (so it does not conflict with `next dev` on 3000). It never resets `aibusiness_customers_dev` and does not stop the development servers on ports 3000/5222/5434.

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

- No authentication or authorization.
- No tasks on cases.
- No attachments.
- No AI features yet.
