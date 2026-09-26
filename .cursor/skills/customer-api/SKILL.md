---
name: customer-api
description: >-
  Preserves the Customers API contract in AiBusiness.Api. Use when editing
  CustomersController, the Customer model, customer validation, or
  /api/customers.
---

# Customer API

`CustomersController` is the business API. Leave `HealthController` and the weather sample alone unless the user asks to change them.

## Endpoints

- `GET /api/customers` returns 200 and an array.
- `GET /api/customers/{id}` returns 200 or 404.
- `POST /api/customers` returns 201 with `CreatedAtAction` pointing at `GetById`.
- `PUT /api/customers/{id}` returns 200 or 404.
- `DELETE /api/customers/{id}` returns 204 or 404.

## Rules

- Name is required. Email is required and must be a valid email address. Failures return a validation problem and must not write a row.
- Validate before looking up or saving. An invalid update of an unknown id is a validation error, not 404.
- The server assigns `Id` and `CreatedAt` on create. Ignore client values.
- Update may change name, email, phone, and company. Keep the stored id and `CreatedAt`. Null phone or company clears those fields.
- Do not reseed Studio 22 or Danskware Client. A new database starts empty.
