# AI Business Operations Platform

An enterprise-ready, AI-driven operations platform designed to automate and orchestrate core business workflows, starting with comprehensive Customer Relationship Management (CRM) and extensible agentic operations.

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
- **Automated Tests:** **xUnit** suite with SQLite in-memory provider (19 comprehensive tests)
- **Frontend:** **Next.js 16.3** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS v4**
- **Agent System:** Configured with 200+ engineering skills and Model Context Protocol (MCP) integrations

---

## 📁 Repository Structure

```
├── backend/
│   ├── AiBusiness.slnx                     # .NET Solution file
│   ├── src/
│   │   └── AiBusiness.Api/                 # ASP.NET Core Web API project
│   │       ├── Controllers/                # CustomersController, HealthController
│   │       ├── Data/                       # AppDbContext & EF Core migrations
│   │       ├── Models/                     # Domain models (Customer)
│   │       └── Program.cs                  # Service bootstrapping & OpenAPI
│   └── tests/
│       └── AiBusiness.Api.Tests/           # xUnit test suite (19 unit/controller tests)
├── frontend/                               # Next.js 16 App Router application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                    # Landing page
│   │   │   └── customers/                  # Customer listing & creation views
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
   *(All 19 controller unit tests run against an isolated in-memory SQLite database).*

3. **Configure the connection string:**
   ```bash
   dotnet user-secrets set --project src/AiBusiness.Api "ConnectionStrings:DefaultConnection" "Host=localhost;Database=aibusiness;Username=postgres;Password=your_password"
   ```

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

## 📡 API Endpoints (`/api/customers`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/customers` | Returns an array of all customers, ordered by `id`. |
| `GET` | `/api/customers/{id}` | Returns a single customer by ID (or `404 Not Found`). |
| `POST` | `/api/customers` | Validates required name/email format, sets server ID & UTC timestamp, returns `201 Created`. |
| `PUT` | `/api/customers/{id}` | Updates name, email, phone, and company while preserving ID and creation timestamp. |
| `DELETE` | `/api/customers/{id}` | Deletes the specified customer, returning `204 NoContent` (or `404 Not Found`). |

---

## 🧪 Testing Summary

The backend includes a comprehensive xUnit test suite in `backend/tests/AiBusiness.Api.Tests`:
- Valid creation and retrieval by returned ID
- Email format and required field validation
- Server-generated timestamps and IDs protection
- Full update semantics and optional field clearing
- Deletion idempotency and isolation
- Sequential test execution using SQLite in-memory instances to prevent state leakage

Run all tests anytime:
```bash
dotnet test backend
```
