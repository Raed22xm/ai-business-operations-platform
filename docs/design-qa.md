# Dashboard design verification

Reference: [reference-inspiration.jpg](screenshots/reference-inspiration.jpg).

The dashboard follows the reference's narrow sidebar, compact top bar, three-column composition, charcoal panels, restrained green lighting, customer selection, central case timeline, assistant panel, and four KPI tiles. On small screens the panels stack and navigation uses a keyboard-accessible dialog.

## Captures

- [Desktop, 1440 × 960](screenshots/dashboard-reference-desktop.png)
- [Mobile, 390px wide](screenshots/dashboard-reference-mobile.png)

These captures use disposable example records in the isolated browser-test database. The development database was not populated with example customers.

## Product differences from the reference

- Customer initials replace portraits because customer records have no photo field.
- Case details, tasks, customer status indicators, and KPI counts use saved data. Customer status indicators describe their cases, not an unsupported customer-status field.
- The assistant explicitly marks AI actions as unavailable. Its working case brief copies saved information; it does not claim AI generation.
- Account information describes the existing local workspace; there is no invented signed-in user.

## Verification

- Frontend lint passed.
- Production build passed as part of the isolated Playwright setup.
- Full browser suite: 10 passed, 0 failed, 0 skipped.
- Dashboard coverage includes customer and case selection, search, empty results, saved tasks, unavailable AI actions, no horizontal page overflow at desktop/mobile sizes, and mobile menu Escape/focus return.
- Existing customer/case/task workflows, error recovery, search, pagination, and deletion checks passed.
- Live Safari rendering visually inspected; Next.js reported no runtime/configuration errors.
- Impeccable detector returned no findings.
- Development customers 7 and 8 and case 8 were preserved.

The two older search tests now select the exact list-search label to distinguish it from the new top-bar customer search.

## Connected pages

Customers, Cases, customer/case details, task forms, and confirmation dialogs now use the same palette, controls, and panels. Creation forms sit beside the records on large screens and stack above them on narrow screens. Status badges include readable labels as well as color.

- [Customers desktop](screenshots/customers-1440.png) / [mobile](screenshots/customers-390.png)
- [Cases desktop](screenshots/cases-1440.png) / [mobile](screenshots/cases-390.png)
- [Customer details desktop](screenshots/customer-details-1440.png) / [mobile](screenshots/customer-details-390.png)
- [Case and tasks desktop](screenshots/case-tasks-1440.png) / [mobile](screenshots/case-tasks-390.png)

The final full suite passed all 10 tests, including overflow checks for these four pages at 1440px and 390px. Lint and the production build passed. An absolutely positioned screen-reader table heading initially widened the mobile document; giving its scrolling container a positioning context fixed the underlying issue without hiding page overflow. Existing development records remain unchanged.
