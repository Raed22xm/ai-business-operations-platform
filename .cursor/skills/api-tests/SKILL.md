---
name: api-tests
description: >-
  Runs and updates AiBusiness.Api customer tests without confusing SQLite
  controller tests with PostgreSQL HTTP checks. Use when editing
  CustomersControllerTests or verifying the customers API.
---

# API tests

`CustomersControllerTests` calls the controller directly. Each test gets its own temporary SQLite database. These tests do not send HTTP requests and do not use PostgreSQL.

Keep the existing behavioral coverage: create, get, update, delete, validation, server-controlled id and `CreatedAt`, and updates that must not change other customers.

`dotnet test backend/tests/AiBusiness.Api.Tests/AiBusiness.Api.Tests.csproj` is the controller-test check. Say how many passed only after that command runs.

HTTP checks against PostgreSQL use a new API process on a free port. Do not stop APIs that were already listening, including ports 5223 and 5224.
