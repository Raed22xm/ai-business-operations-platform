# Customer Inquiry Intake: Milestone Documentation

## Overview

The **Customer Inquiry Intake** milestone introduces a streamlined, internal workflow that turns incoming customer inquiries into verified customers and tracked `Open` cases in a single atomic database transaction.

Route: `/inquiry`  
Backend Controller: [`InquiriesController`](file:///Users/raed22/Desktop/%20%20%20%20ai-business-operations-platform/backend/src/AiBusiness.Api/Controllers/InquiriesController.cs) (`/api/inquiries`)

---

## Key Capabilities

### 1. Internal Intake Form (`/inquiry`)
- **Required fields**: Customer Name, Customer Email, Request Title.
- **Optional fields**: Customer Company, Customer Phone, Inquiry Description.
- **Security & Authorization**: Strictly internal. Protected by authentication middleware (`middleware.ts`) and `[Authorize]` attribute on the API controller. Unauthenticated requests are redirected to `/login?next=%2Finquiry`.
- **Validation limits**:
  - Customer Name: max 100 characters, required when creating new customer.
  - Customer Email: max 320 characters, required, RFC-compliant email address format.
  - Company: max 100 characters, optional.
  - Phone: max 50 characters, optional.
  - Title: max 200 characters, required.
  - Description: max 4000 characters, optional.

### 2. Intelligent Customer Resolution & Overwrite Protection
- **Email-based Resolution**: Lookups occur on-the-fly (`GET /api/inquiries/resolve-customer?email=...`) using trimmed, case-insensitive comparison (`email.Trim().ToLower()`).
- **Zero Silent Overwrites**:
  - When an existing customer record is matched and confirmed, the case is linked directly to `customer.Id`.
  - The customer's existing profile (Name, Phone, Company) is **never silently mutated**.
- **Disambiguation**:
  - **Single Match**: Displays matched customer summary with radio options to either link the inquiry to the existing customer or explicitly confirm creating a new customer with the same email.
  - **Multiple Matches**: Displays all matched profiles in an accessible radio selection group, requiring the user to explicitly select the target profile or choose to create a new customer.

### 3. Atomic Database Transactions & Activity Tracking
- **Single Transaction**: Both customer creation (when needed) and case creation execute inside `await using var transaction = await _database.Database.BeginTransactionAsync()`.
- **Case State**: Initial status is always `CaseStatus.Open`.
- **Activity Logging**: Emits `CaseActivityEventType.CaseCreated` ("Inquiry intake: {title} for {customer.Name}") with the authenticated operator identity within the same database transaction.
- **Duplicate Prevention**: Immediate retries or double-submissions for the same customer with an identical title within a 2-minute cutoff window return `409 Conflict` (`DuplicateInquiry`).

### 4. User Experience & Navigation
- **Redirect on Success**: Navigates immediately to `/cases/{id}` with a flash notice banner.
- **Form State Preservation**: If any validation error or conflict occurs, all entered form values are preserved without loss.
- **Accessibility & Mobile Layout**: Fully keyboard accessible (tested with Tab order and keyboard input) and responsive on both mobile (<620px) and wide desktop viewports.

---

## API Endpoints

### 1. `GET /api/inquiries/resolve-customer?email={email}`
- **Summary**: Resolve customer by email
- **Query**: `email` (string, required)
- **Response**: `200 OK`
  ```json
  {
    "queryEmail": "client@example.com",
    "matches": [
      {
        "id": 14,
        "name": "Jane Doe",
        "email": "client@example.com",
        "company": "Acme Corp",
        "phone": "+45 12 34 56 78",
        "createdAt": "2026-09-27T18:00:00Z"
      }
    ],
    "hasExactMatch": true,
    "hasMultipleMatches": false
  }
  ```

### 2. `POST /api/inquiries`
- **Summary**: Create inquiry as customer and case
- **Body**:
  ```json
  {
    "customerName": "Jane Doe",
    "customerEmail": "client@example.com",
    "customerPhone": "+45 12 34 56 78",
    "customerCompany": "Acme Corp",
    "selectedCustomerId": 14,
    "confirmCreateNew": false,
    "title": "HVAC System Maintenance Request",
    "description": "Annual service check for warehouse ventilation."
  }
  ```
- **Responses**:
  - `201 Created`: Returns `CreateInquiryResponse` with Location header pointing to `/api/cases/{id}`.
  - `400 Bad Request`: `ValidationProblemDetails` with field errors.
  - `409 Conflict`: Returned with code `"CustomerMatchRequired"` if unconfirmed matches exist, or `"DuplicateInquiry"` if identical case submitted within 2 minutes.

---

## Verification & Test Results

1. **Backend Unit & Integration Tests**:
   - `InquiriesControllerTests.cs`: 12 automated test cases covering empty email validation, case-insensitive single/multiple email lookup, validation errors, atomic creation, profile preservation, conflict on unconfirmed matches, explicit confirmation of new customer, duplicate prevention within 2-minute window, and `[Authorize]` enforcement.
   - Test run: `218 passed, 0 failed, 0 skipped`.

2. **Frontend Quality & Static Analysis**:
   - `npm run lint`: 0 errors, 0 warnings.
   - `npm run build`: Successfully generated dynamic `/inquiry` route and optimized production bundle.

3. **Playwright Browser E2E Tests** (`e2e/inquiry-intake.spec.ts`):
   - Unauthenticated access rejection: verified redirection to `/login?next=%2Finquiry`.
   - New customer intake: verified validation errors on empty submission, resolution, atomic creation, redirect to `/cases/{id}`, and activity history logging.
   - Existing customer match: verified resolution, profile preservation, case linking, and duplicate submission conflict rejection.
   - Multiple matches disambiguation: verified explicit customer selection linking the case to the chosen customer.
   - Responsive mobile layout & keyboard navigation: verified mobile viewport (375x667) and Tab key focus navigation.
   - Test run: `5 passed (23.8s)`.
