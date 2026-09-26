---
name: local-postgres
description: >-
  Uses the dedicated local PostgreSQL database for AiBusiness customer data.
  Use when changing EF Core, migrations, the connection string, or Docker
  Postgres for this project.
---

# Local PostgreSQL

Customer rows are stored through `AppDbContext` and EF Core. Do not move them back to a static list.

## This project's database

- Container: `aibusiness-customers-postgres`
- Host port: `127.0.0.1:5434`
- Database: `aibusiness_customers_dev`
- User: `aibusiness`
- Password: .NET user secrets key `ConnectionStrings:DefaultConnection` on `AiBusiness.Api`

Do not put the password in source files, appsettings, or logs.

## Do not touch

Port 5432 is a different PostgreSQL server. Do not reset it. Do not start, stop, or remove `studio22_verify_pg`, `friserstudio22-postgres-1`, or `pr1-hairadresser-db-1`.

Apply migrations only to `aibusiness_customers_dev`. Use `dotnet ef` from `backend/` via the local tool manifest.
