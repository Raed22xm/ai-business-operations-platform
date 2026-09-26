# Step 10: Update an existing customer

Read the current backend controller, model and tests before editing. Implement this one step only.

## Behavior

- Add PUT /api/customers/{id:int} to CustomersController.
- Require name and email; validate email format using the same built-in validation as POST. A small shared validation helper is fine; preserve POST behavior.
- For a valid request with an unknown ID, return NotFound. Invalid input returns ValidationProblem and must not change stored data.
- Replace Name, Email, Phone and Company for the customer identified by the route. Null optional Phone/Company clears the old values (full replacement of editable fields).
- Preserve stored Id and CreatedAt even when different values are supplied in the body. Return Ok with the updated customer.
- Protect the in-memory lookup and replacement with the existing lock. Replace the stored Customer with a new object rather than mutating an object previously returned to a GET caller. This keeps already-captured GET snapshots stable.

## Tests

Extend CustomersControllerTests in the existing test class (which keeps these shared-state tests sequential). Use newly created customers and returned IDs, not hardcoded counts or ID 3. Use fresh controllers for separate simulated requests.

Cover successful update and subsequent GET, unchanged ID/CreatedAt despite forged body values, cleared optional fields, unknown ID, invalid name/email (blank and malformed) without any field changing, and an unrelated customer remaining unchanged. Capture scalar originals or copies so assertions cannot accidentally compare a mutated object with itself. Keep the seven existing tests.

Controller unit tests should assert result types and ValidationProblemDetails.Errors; do not assume ObjectResult.StatusCode has been set by MVC in a direct controller call. Use Predicate<Customer> where xUnit expects it.

## Scope and verification

Edit only the controller and its tests. No packages, database, deletion endpoint, frontend, account/config changes, commits or deployment. Do not stop running servers.

Do not run shell commands in this delegated step: prior Cursor shell attempts were blocked by its approval review. The coordinating assistant will build, run tests, and verify real HTTP responses using /Users/raed22/.dotnet/dotnet.

Report changed files and behavior, then stop. Do not claim tests passed without executing them.
