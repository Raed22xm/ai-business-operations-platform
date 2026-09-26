# Step 9: Customer validation and tests

Implement only this step in the existing backend. Read the current files first and preserve existing changes.

## Current state

- ASP.NET Core API targets .NET 10.
- CustomersController supports GET all, GET by ID, and POST using an in-memory list protected by a lock.
- POST assigns the ID and UTC creation time on the server, checks required name/email, and returns CreatedAtAction pointing to GetById.
- The test project currently contains an empty placeholder test and has no API project reference.
- The .NET executable is /Users/raed22/.dotnet/dotnet.
- Existing servers may be running on 5222 and 5223. Do not stop them.

## Work

1. Add simple email-format validation using built-in .NET validation. Retain required name and email checks and return a validation error for malformed email before saving anything.
2. Replace the empty placeholder with meaningful xUnit tests and add the API project reference. Cover valid creation, retrieval using the returned ID, unknown ID, blank name/email, invalid email, and server-generated ID/time overriding submitted values.
3. Avoid fixed customer counts or assuming ID 3 in tests: the in-memory state is shared. Create fresh controller instances for separate simulated requests so validation state does not leak between requests.
4. Build and run the tests using the existing SDK. Report the exact test results and any limitations. Do not report a controller unit test as an HTTP integration test.
5. Stop after this step. Report changed files and explain the behavior in beginner-friendly language.

Do not add database, authentication, frontend work, AI features, new packages, deployment, commits, or unrelated refactoring. Do not change account settings or sign-in credentials.
