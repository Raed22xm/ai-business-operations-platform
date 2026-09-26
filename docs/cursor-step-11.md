# Step 11: Delete a customer

Read the existing customer controller and tests. Implement only this step.

## Production behavior

- Add `DELETE /api/customers/{id:int}` to `CustomersController`.
- Use the existing `CustomersLock` around lookup and removal.
- If the ID exists, remove exactly that customer and return `NoContent()` (HTTP 204).
- If the ID does not exist, return `NotFound()` (HTTP 404).
- Do not change any other endpoint or add packages.

## Tests

Extend the existing `CustomersControllerTests` without removing the current 15 tests.

Cover:

- create a fresh customer, delete it, assert `NoContentResult`, then assert `GetById` returns `NotFound`;
- the deleted customer is absent from `GetAll` while an unrelated customer remains unchanged;
- deleting an unknown ID returns `NotFound` and does not change the existing list;
- repeat delete of the same ID returns `NotFound`.

Use IDs returned by `Create`, no fixed counts or hardcoded newly-created IDs. Capture scalar values for unrelated customer assertions. Keep tests as controller unit tests and assert result types, not MVC-populated status codes.

## Scope

Edit only `backend/src/AiBusiness.Api/Controllers/CustomersController.cs` and `backend/tests/AiBusiness.Api.Tests/CustomersControllerTests.cs`. Do not edit models, frontend, database, authentication, configuration, docs, or project files. Do not run shell commands; the coordinating assistant will verify externally.

Report changed files and behavior, then stop.
