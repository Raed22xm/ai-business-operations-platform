# Graph Report - frontend  (2026-09-27)

## Corpus Check
- 89 files · ~25,437 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .css 2, .example 1, (none) 1)

## Summary
- 488 nodes · 1135 edges · 24 communities (12 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4366ee53`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/page.tsx
- cases.ts
- customers.ts
- global-setup.ts
- auth.ts
- package.json
- cases/page.tsx
- helpers.ts
- assistant-panel.tsx
- compilerOptions
- run-api-mock-proxy.mjs
- README.md
- cases/error.tsx
- cases/[id]/error.tsx
- customers/error.tsx
- customers/[id]/error.tsx
- app/error.tsx
- AGENTS.md
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `next` - 28 edges
2. `react` - 26 edges
3. `apiFetch()` - 24 edges
4. `compilerOptions` - 16 edges
5. `casesPageHref()` - 14 edges
6. `caseStatusLabel()` - 12 edges
7. `customersPageHref()` - 12 edges
8. `test` - 11 edges
9. `CasesPage()` - 11 edges
10. `globalSetup()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `AssistantPanel()` --calls--> `caseStatusLabel()`  [EXTRACTED]
  src/app/assistant-panel.tsx → src/lib/cases-shared.ts
- `CaseDetails()` --calls--> `customerDetailsHref()`  [EXTRACTED]
  src/app/cases/[id]/case-details.tsx → src/lib/customers-shared.ts
- `CaseDetailsPage()` --calls--> `getCustomer()`  [EXTRACTED]
  src/app/cases/[id]/page.tsx → src/lib/customers.ts
- `CaseForm()` --indirect_call--> `createCaseAction()`  [INFERRED]
  src/app/cases/case-form.tsx → src/app/cases/actions.ts
- `deleteCaseAction()` --calls--> `withNotice()`  [EXTRACTED]
  src/app/cases/actions.ts → src/lib/flash-notice.ts

## Import Cycles
- None detected.

## Communities (24 total, 12 thin omitted)

### Community 0 - "app/page.tsx"
Cohesion: 0.06
Nodes (53): CaseTasksPanel(), CaseTasksLoader(), CaseTasksSection(), loadTasks(), CreateTaskForm(), DeleteTaskDialog(), EditTaskForm(), statuses (+45 more)

### Community 1 - "cases.ts"
Cohesion: 0.07
Nodes (59): react, caseFromForm(), createCaseAction(), deleteCaseAction(), parseListPage(), readStatus(), text(), updateCaseAction() (+51 more)

### Community 2 - "customers.ts"
Cohesion: 0.07
Nodes (52): createCustomerAction(), customerFromForm(), deleteCustomerAction(), optional(), parseListPage(), text(), updateCustomerAction(), CustomerForm() (+44 more)

### Community 3 - "global-setup.ts"
Cohesion: 0.08
Nodes (42): ApiMockRule, clearApiMock(), setApiMock(), apiProject, assertNotDevelopmentDatabase(), authStatePath, backendRoot, E2E_API_PORT (+34 more)

### Community 4 - "auth.ts"
Cohesion: 0.07
Nodes (27): lucide-react, server-only, AppShell(), links, NavKey, SiteNav(), src_app_globals, geistMono (+19 more)

### Community 5 - "package.json"
Cohesion: 0.06
Nodes (35): eslintConfig, dependencies, lucide-react, next, react, react-dom, server-only, devDependencies (+27 more)

### Community 6 - "cases/page.tsx"
Cohesion: 0.11
Nodes (22): nextConfig, next, CasesPage(), CasesPageProps, dynamic, metadata, searchValue(), selectedCustomerIdValue() (+14 more)

### Community 7 - "helpers.ts"
Cohesion: 0.29
Nodes (14): bearerHeaders(), confirmDeleteDialog(), createCaseViaApi(), createCustomerViaApi(), createTaskViaApi(), deleteCaseViaApi(), deleteCustomerViaApi(), deleteTaskViaApi() (+6 more)

### Community 8 - "assistant-panel.tsx"
Cohesion: 0.20
Nodes (16): draftCaseResponseAction(), generateCaseSummaryAction(), AssistantPanel(), run(), OutputKind, PanelOutput, CopyBrief(), AssistantResult (+8 more)

### Community 9 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 10 - "run-api-mock-proxy.mjs"
Cohesion: 0.22
Nodes (11): delay(), __dirname, forward(), listenPort, mockRulesPath, readRules(), server, takeMatchingRule() (+3 more)

### Community 11 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **111 isolated node(s):** `ApiMockRule`, `FORBIDDEN_DATABASE`, `repoRoot`, `DOTNET`, `__dirname` (+106 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 161 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@playwright/test` connect `helpers.ts` to `global-setup.ts`, `package.json`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `next` connect `cases/page.tsx` to `app/page.tsx`, `cases.ts`, `customers.ts`, `auth.ts`, `package.json`, `assistant-panel.tsx`?**
  _High betweenness centrality (0.235) - this node is a cross-community bridge._
- **Why does `react` connect `cases.ts` to `app/page.tsx`, `customers.ts`, `auth.ts`, `package.json`, `cases/page.tsx`, `assistant-panel.tsx`?**
  _High betweenness centrality (0.162) - this node is a cross-community bridge._
- **What connects `ApiMockRule`, `FORBIDDEN_DATABASE`, `repoRoot` to the rest of the system?**
  _111 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06219918548685672 - nodes in this community are weakly interconnected._
- **Should `cases.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0730593607305936 - nodes in this community are weakly interconnected._
- **Should `customers.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07226107226107226 - nodes in this community are weakly interconnected._