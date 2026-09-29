# Private Pilot Deployment & Rollback Runbook

This runbook provides the operational deployment and rollback procedures for deploying the **AI Business Operations Platform** to a private pilot environment.

---

## 1. System Architecture Overview

```
                      HTTPS (:443)
                            │
               ┌────────────▼────────────┐
               │   Reverse Proxy / TLS   │ (Nginx / Caddy / Cloudflare)
               │ (Terminates SSL & sets) │
               │ (X-Forwarded-* headers) │
               └───────┬───────────┬─────┘
                       │           │
           http://...  │           │ http://...
      ┌────────────────▼─┐       ┌─▼────────────────┐
      │ Next.js Frontend │       │ ASP.NET Core API │
      │   (Port 3000)    │──────▶│   (Port 5222)    │
      └──────────────────┘       └─────────┬────────┘
                                           │
                                 ┌─────────▼────────┐
                                 │ PostgreSQL 16+   │
                                 │   (Port 5432)    │
                                 └──────────────────┘
```

- **Frontend:** Next.js 16 (App Router) serving the web UI. Authentication cookies are HTTP-only session cookies.
- **Backend:** ASP.NET Core 10 Web API. Exposes REST endpoints (`/api/*`), validates JWT bearer tokens, and connects to PostgreSQL using Entity Framework Core.
- **Database:** Dedicated PostgreSQL database (isolated from development/testing).

---

## 2. Environment Variables & Secret Configuration

Set these variables in the host environment, Docker secrets, systemd `EnvironmentFile`, or cloud secret store. **Never commit production credentials to repository files.**

### Backend API (`AiBusiness.Api`)

| Variable | Required? | Example / Default | Description |
| :--- | :---: | :--- | :--- |
| `ConnectionStrings__DefaultConnection` | **Yes** | `Host=db;Port=5432;Database=aibusiness_pilot;Username=app_user;Password=...` | Production PostgreSQL connection string. |
| `Auth__Username` | **Yes** | `pilot-admin` | Workspace operator sign-in username. |
| `Auth__Password` | **Yes** | *(Strong password)* | Workspace operator sign-in password (minimum 12 characters recommended). |
| `Auth__JwtSigningKey` | **Yes** | *(64+ hex or random chars)* | Cryptographic HMAC-SHA256 signing key (must be at least 32 characters / 256 bits). |
| `OpenAI__ApiKey` | No | `sk-...` | Optional OpenAI API key. If omitted, the API safely defaults to local mock responses (`Demo response — AI not connected`). |
| `OpenAI__Model` | No | `gpt-4o-mini` | OpenAI model ID when `OpenAI__ApiKey` is provided. |
| `RateLimiting__Assistant__PermitLimit` | No | `20` | Maximum AI assistant requests permitted per window. |
| `RateLimiting__Assistant__WindowSeconds` | No | `60` | Fixed rate-limit window in seconds. |
| `BusinessTimezone__TimeZoneId` | No | `Europe/Copenhagen` | Time zone used for calendar due dates and overdue calculations. |
| `CsvExport__MaxRows` | No | `10000` | Maximum rows allowed for streaming CSV exports. |
| `ASPNETCORE_ENVIRONMENT` | No | `Production` | Disables OpenAPI explorer endpoints and development diagnostics in production. |

### Frontend (`frontend`)

| Variable | Required? | Example / Default | Description |
| :--- | :---: | :--- | :--- |
| `API_BASE_URL` | **Yes** | `https://api.pilot.internal` or `http://127.0.0.1:5222` | Internal or accessible URL of the backend API. |
| `AUTH_COOKIE_SECURE` | **Yes** (in Prod) | `true` | Enforces the `Secure` flag on the `ops_hub_session` cookie over HTTPS. |
| `NODE_ENV` | **Yes** | `production` | Enables optimized Next.js production builds and runtime. |
| `PORT` | No | `3000` | HTTP port Next.js listens on. |

---

## 3. Pre-Deployment Checklist

Before deploying a release or update:

- [ ] **1. Backup Database:** Create a timestamped backup before touching the schema or binaries:
  ```bash
  ./scripts/db/backup.sh
  ```
- [ ] **2. Verify Restore Integrity:** Confirm the dump can be restored cleanly using a disposable verification database:
  ```bash
  ./scripts/db/restore.sh --dump "$HOME/Library/Application Support/AiBusiness/backups/<dump-file>.dump" --cleanup
  ```
- [ ] **3. Inspect Pending Migrations:** Check which migrations are pending:
  ```bash
  ./scripts/db/migrate.sh --status
  ```
  *(Optional: generate idempotent SQL script for DBA review using `./scripts/db/migrate.sh --script release_migration.sql`)*

---

## 4. Standard Deployment Procedure

### Step 1: Apply Database Migrations
Migrations must be applied **before** starting new application instances:
```bash
./scripts/db/migrate.sh --apply
```
Verify exit code is `0` and all migrations are marked applied:
```bash
./scripts/db/migrate.sh --status
```

### Step 2: Build and Deploy the Backend API
1. Publish the Release binary:
   ```bash
   dotnet publish backend/src/AiBusiness.Api -c Release -o /var/www/aibusiness-api
   ```
2. Restart the backend process (e.g. systemd):
   ```bash
   systemctl restart aibusiness-api
   ```
3. Verify backend health endpoint responds with `200 OK`:
   ```bash
   curl -fsS http://127.0.0.1:5222/api/health
   # Expected output: {"status":"healthy"}
   ```

### Step 3: Build and Deploy the Frontend
1. Install production dependencies and build:
   ```bash
   cd frontend
   npm ci --omit=dev
   npm run build
   ```
2. Restart or start the Next.js process:
   ```bash
   systemctl restart aibusiness-frontend
   # Or using pm2:
   # pm2 restart aibusiness-frontend
   ```
3. Verify frontend responds:
   ```bash
   curl -fsS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/login
   # Expected output: 200
   ```

---

## 5. Post-Deployment Verification (Smoke Tests)

Run these manual checks immediately after deployment:

1. **Sign-in Flow:**
   - Navigate to `https://<pilot-domain>/login`.
   - Sign in using the configured operator credentials.
   - Inspect the session cookie `ops_hub_session` in browser dev tools:
     - `HttpOnly`: **True**
     - `Secure`: **True**
     - `SameSite`: **Lax**
2. **Dashboard Data:**
   - Verify that KPI summary tiles (Overdue, Due today, Active cases, Customers) load accurately.
   - Verify customer search and customer details page (`/customers`).
3. **Core Case Operations:**
   - Create or view an active case.
   - Run **Escalation check** (verify deterministic response without error).
   - Test **Schedule follow-up** task creation.
   - Test AI assistant draft generation (verify `Demo response — AI not connected` or live completion depending on key configuration).
4. **Sign-out:**
   - Click Sign out; verify redirect to `/login` and that visiting `/` requires authentication.

---

## 6. Rollback Procedures

### Scenario A: Frontend-Only Rollback
If a UI defect or rendering bug is discovered:
1. Switch the frontend symlink or repository checkout to the previous stable release commit.
2. Rebuild or point to the previously built standalone bundle (`npm run build`).
3. Restart the frontend process:
   ```bash
   systemctl restart aibusiness-frontend
   ```
4. Confirm login and dashboard pages load normally.

### Scenario B: Backend API Rollback (Without Database Changes)
If an API bug occurs but the database schema is compatible:
1. Revert the API binary directory to the previous published release:
   ```bash
   systemctl restart aibusiness-api
   ```
2. Verify health endpoint:
   ```bash
   curl -fsS http://127.0.0.1:5222/api/health
   ```

### Scenario C: Database Schema Rollback (Reverting Migrations)
If a failed deployment included a schema migration that needs to be reversed:
1. Stop the backend API to prevent active transactions:
   ```bash
   systemctl stop aibusiness-api
   ```
2. Identify the target migration name to roll back to:
   ```bash
   ./scripts/db/migrate.sh --status
   ```
3. Roll back to the target migration (e.g. `20260927160339_AddCaseTemplates`):
   ```bash
   ./scripts/db/migrate.sh --rollback 20260927160339_AddCaseTemplates
   ```
4. Deploy the previous compatible API binary.
5. Restart the backend API:
   ```bash
   systemctl restart aibusiness-api
   ```

### Scenario D: Disaster Recovery Database Restore
If data corruption occurred or a migration cannot be reversed with EF Core:
1. Stop both backend and frontend services:
   ```bash
   systemctl stop aibusiness-frontend
   systemctl stop aibusiness-api
   ```
2. Restore the pre-deployment dump into a verified temporary database to inspect data integrity:
   ```bash
   ./scripts/db/restore.sh \
     --dump "$HOME/Library/Application Support/AiBusiness/backups/aibusiness_pre_deploy_<timestamp>.dump" \
     --verify-only
   ```
3. Once verified, perform an in-place restore using `pg_restore` (or swap database names in PostgreSQL):
   ```bash
   # Connect to postgres server as superuser/admin:
   psql -U postgres -c "DROP DATABASE aibusiness_pilot;"
   psql -U postgres -c "CREATE DATABASE aibusiness_pilot;"
   pg_restore -U postgres -d aibusiness_pilot "$DUMP_PATH"
   ```
4. Restart services and perform Post-Deployment Verification.
