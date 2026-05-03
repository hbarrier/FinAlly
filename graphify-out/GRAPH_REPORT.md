# Graph Report - /Users/hbarriere/Documents/projects/finances  (2026-04-29)

## Corpus Check
- Corpus is ~49,993 words - fits in a single context window. You may not need a graph.

## Summary
- 418 nodes · 464 edges · 27 communities detected
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 82 edges (avg confidence: 0.81)
- Token cost: 9,800 input · 3,200 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Budget & Category Actions|Budget & Category Actions]]
- [[_COMMUNITY_App Features Documentation|App Features Documentation]]
- [[_COMMUNITY_Core Utility Helpers|Core Utility Helpers]]
- [[_COMMUNITY_Transactions UI|Transactions UI]]
- [[_COMMUNITY_Reimbursement Mapping Design|Reimbursement Mapping Design]]
- [[_COMMUNITY_CSV Import Wizard|CSV Import Wizard]]
- [[_COMMUNITY_Reimbursement Calc Logic|Reimbursement Calc Logic]]
- [[_COMMUNITY_Fern Design System|Fern Design System]]
- [[_COMMUNITY_Next.js & Search Issues|Next.js & Search Issues]]
- [[_COMMUNITY_Recurring Sheet & Seed|Recurring Sheet & Seed]]
- [[_COMMUNITY_Goals Feature|Goals Feature]]
- [[_COMMUNITY_Merchants UI|Merchants UI]]
- [[_COMMUNITY_Reimbursement Rate Sheet|Reimbursement Rate Sheet]]
- [[_COMMUNITY_Goal Sheet Form|Goal Sheet Form]]
- [[_COMMUNITY_Transaction Sheet Form|Transaction Sheet Form]]
- [[_COMMUNITY_Reimbursements Page|Reimbursements Page]]
- [[_COMMUNITY_Dashboard Page|Dashboard Page]]
- [[_COMMUNITY_Categories Client|Categories Client]]
- [[_COMMUNITY_Reimbursement Mapping Sheet|Reimbursement Mapping Sheet]]
- [[_COMMUNITY_Monthly Opening Balances|Monthly Opening Balances]]
- [[_COMMUNITY_Next.js Logo SVG|Next.js Logo SVG]]
- [[_COMMUNITY_TypeScript 5 (strict mode)|TypeScript 5 (strict mode)]]
- [[_COMMUNITY_React 19|React 19]]
- [[_COMMUNITY_React Hook Form + Zod (forms a|React Hook Form + Zod (forms a]]
- [[_COMMUNITY_CatSwatch (Category Icon Tile)|CatSwatch (Category Icon Tile)]]
- [[_COMMUNITY_Globe Icon SVG|Globe Icon SVG]]
- [[_COMMUNITY_WindowBrowser Icon SVG|Window/Browser Icon SVG]]

## God Nodes (most connected - your core abstractions)
1. `revalidateApp()` - 37 edges
2. `nanoid()` - 12 edges
3. `Fern Design System` - 11 edges
4. `Features Index` - 9 edges
5. `Transactions Feature (/transactions - full ledger)` - 9 edges
6. `Issue 01: Map One Reimbursement Income to One Expense` - 9 edges
7. `Recurring Feature (/recurring)` - 8 edges
8. `Reimbursements Feature (/reimbursements)` - 8 edges
9. `Issue 04: Support Partial and Top-Up Reimbursements` - 8 edges
10. `defaultPaymentMethodForKind()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `File Icon SVG` --conceptually_related_to--> `Issue 01: Map One Reimbursement Income to One Expense`  [AMBIGUOUS]
  public/file.svg → docs/issues/reimbursement-mapping/01-map-one-income-to-one-expense.md
- `getDefaultValues()` --calls--> `defaultPaymentMethodForKind()`  [INFERRED]
  components/fern/sheets/recurring-sheet.tsx → lib/payment-method.ts
- `getDefaultValues()` --calls--> `defaultPaymentMethodForKind()`  [INFERRED]
  components/fern/sheets/transaction-sheet.tsx → lib/payment-method.ts
- `FTS5 full-text search (transactions_fts virtual table)` --semantically_similar_to--> `Movements Search View (FTS year-scoped)`  [INFERRED] [semantically similar]
  docs/features/transactions.md → MOVEMENTS_UI_REVIEW.md
- `ReimbursementsPage()` --calls--> `indexReimbursementAllocations()`  [INFERRED]
  app/(app)/reimbursements/page.tsx → lib/queries/reimbursement-allocations.ts

## Hyperedges (group relationships)
- **Fern Core Technology Stack** — techstack_nextjs, techstack_typescript, techstack_react19, techstack_sqlite_libsql, techstack_drizzle_orm, techstack_shadcn_radix, techstack_tailwind_v4, techstack_react_hook_form_zod [EXTRACTED 1.00]
- **Fern Architecture Patterns** — techstack_server_client_split, techstack_server_actions, techstack_derive_layer, techstack_schema_driven, techstack_sheets_crud [EXTRACTED 1.00]
- **Fern Application Features** — features_dashboard_page, features_transactions_page, features_import_wizard, features_recurring_page, features_budgets_page, features_reimbursements_page, features_categories_page, features_merchants_page [EXTRACTED 1.00]
- **Reimbursement Subsystem** — features_reimbursements_income_driven_model, features_reimbursements_allocation_rows, features_reimbursements_rates, features_reimbursements_manual_settlement, reimbursement_mapping_prd [EXTRACTED 1.00]
- **Movements UI Three Views** — movements_ui_timeline_view, movements_ui_summary_view, movements_ui_search_view [EXTRACTED 1.00]
- **Reimbursement Mapping Issues — Sequential Dependency Chain** — issue_01_map_one_income_one_expense, issue_02_migrate_legacy_links, issue_03_map_one_income_multiple_expenses, issue_04_partial_topup_reimbursements, issue_05_preserve_zero_allocation, issue_06_edit_saved_mapping, issue_07_manually_settle_expense, issue_08_filter_reimbursement_transactions, issue_09_reimbursements_review_dashboard, issue_10_clear_mappings_eligibility [EXTRACTED 1.00]
- **Goals Feature — Component Cluster** — goals_page, goals_client, goals_actions, goals_sheet, goals_ring, goals_progress_calculation [EXTRACTED 1.00]
- **Reimbursement Status Concepts** — reimbursement_status_module, expense_reimbursement_status, income_allocation_status, allocation_model, reimbursement_rate [INFERRED 0.85]
- **Next.js / Vercel Brand SVG Assets** — svg_next_icon, svg_vercel_icon, svg_globe_icon, svg_window_icon, svg_file_icon [INFERRED 0.75]

## Communities

### Community 0 - "Budget & Category Actions"
Cohesion: 0.06
Nodes (39): deleteBudget(), upsertBudget(), addCategory(), deleteCategory(), updateCategory(), addGoal(), deleteGoal(), updateGoal() (+31 more)

### Community 1 - "App Features Documentation"
Cohesion: 0.09
Nodes (38): Budgets Feature (/budgets), Budget Progress States (ok, warn, over), Categories Feature (/categories), isPensionAlimentaire flag (category, French childcare support), Dashboard Opening Balance Logic, Dashboard Feature (/dashboard), Import Merchant Mapping (map-existing, create-same, create-custom), CSV Import Wizard Feature (+30 more)

### Community 2 - "Core Utility Helpers"
Cohesion: 0.09
Nodes (6): syncEffectiveAmount(), Money(), effectiveAmount(), splitCents(), loadRecurringAmountEntriesTx(), syncRecurringEffectiveAmountTx()

### Community 3 - "Transactions UI"
Cohesion: 0.1
Nodes (5): closeSheet(), handleDelete(), handleSave(), jumpToMonth(), setVisibleMonths()

### Community 4 - "Reimbursement Mapping Design"
Cohesion: 0.21
Nodes (21): Reimbursement Allocation Model (Many-to-Many), Expense Reimbursement Status (not reimbursed / partially reimbursed / reimbursed / manually settled), Reimbursement Income Allocation Status (unmapped / partially allocated / fully allocated), Issue 01: Map One Reimbursement Income to One Expense, Issue 02: Migrate Existing Legacy Reimbursement Links, Issue 03: Map One Reimbursement Income to Multiple Expenses, Issue 04: Support Partial and Top-Up Reimbursements, Issue 05: Preserve Zero-Allocation Selections (+13 more)

### Community 5 - "CSV Import Wizard"
Cohesion: 0.19
Nodes (7): buildMerchantStates(), goToStep2(), handleClose(), parseCSV(), parseCSVLine(), parseDate(), reset()

### Community 6 - "Reimbursement Calc Logic"
Cohesion: 0.34
Nodes (10): getApplicableReimbursementRate(), getExpectedReimbursementAmount(), getExpenseReimbursementStatus(), getExpenseReimbursementSummary(), getIncomeReimbursementStatus(), getIncomeReimbursementSummary(), getRemainingExpectedReimbursement(), hasPositiveAmount() (+2 more)

### Community 7 - "Fern Design System"
Cohesion: 0.17
Nodes (12): shadcn/ui + Radix UI (UI components), Sheet slide-over CRUD pattern (components/fern/sheets/), Tailwind CSS v4, Fern Semantic Colour Palette (terracotta, sage, rose, teal, butter, lilac), Fern Dark Mode (data-theme attribute), Fern Button Component (.fern-btn), Fern Card Component (.fern-card), Fern Design System (+4 more)

### Community 8 - "Next.js & Search Issues"
Cohesion: 0.22
Nodes (11): Next.js Agent Rules (breaking changes warning), FTS5 full-text search (transactions_fts virtual table), P0 Issue: Client-side filters scoped to loaded months only, R1 Recommendation: Make merchant/category filters server-side for full-year results, Movements UI State Assessment and Recommendations, Movements Search View (FTS year-scoped), Movements Summary View, Movements Timeline View (+3 more)

### Community 9 - "Recurring Sheet & Seed"
Cohesion: 0.22
Nodes (5): doSeed(), seed(), getDefaultValues(), onSubmit(), parseDecimal()

### Community 11 - "Goals Feature"
Cohesion: 0.48
Nodes (7): Goals Server Actions (addGoal, updateGoal, deleteGoal), Goals Client Component, Goals Feature, Goals Page (Server Component), Goal Progress Calculation, GoalRing Component, Goal Sheet Component

### Community 12 - "Merchants UI"
Cohesion: 0.4
Nodes (2): handleDelete(), usage()

### Community 15 - "Reimbursement Rate Sheet"
Cohesion: 0.5
Nodes (2): onSubmit(), parseDecimal()

### Community 16 - "Goal Sheet Form"
Cohesion: 0.5
Nodes (2): onSubmit(), parseDecimal()

### Community 19 - "Transaction Sheet Form"
Cohesion: 0.5
Nodes (3): getDefaultValues(), onSubmit(), parseDecimal()

### Community 21 - "Reimbursements Page"
Cohesion: 0.5
Nodes (2): indexReimbursementAllocations(), ReimbursementsPage()

### Community 23 - "Dashboard Page"
Cohesion: 0.5
Nodes (2): DashboardPage(), getMonthOpeningBalance()

### Community 24 - "Categories Client"
Cohesion: 0.67
Nodes (2): handleDelete(), usage()

### Community 26 - "Reimbursement Mapping Sheet"
Cohesion: 0.67
Nodes (2): fmt(), formatDate()

### Community 34 - "Monthly Opening Balances"
Cohesion: 1.0
Nodes (2): assertMonthKey(), upsertMonthlyOpeningBalance()

### Community 64 - "Next.js Logo SVG"
Cohesion: 1.0
Nodes (2): Next.js Logo SVG, Vercel Logo SVG

### Community 86 - "TypeScript 5 (strict mode)"
Cohesion: 1.0
Nodes (1): TypeScript 5 (strict mode)

### Community 87 - "React 19"
Cohesion: 1.0
Nodes (1): React 19

### Community 88 - "React Hook Form + Zod (forms a"
Cohesion: 1.0
Nodes (1): React Hook Form + Zod (forms and validation)

### Community 89 - "CatSwatch (Category Icon Tile)"
Cohesion: 1.0
Nodes (1): CatSwatch (Category Icon Tile) Component

### Community 90 - "Globe Icon SVG"
Cohesion: 1.0
Nodes (1): Globe Icon SVG

### Community 91 - "Window/Browser Icon SVG"
Cohesion: 1.0
Nodes (1): Window/Browser Icon SVG

## Ambiguous Edges - Review These
- `Issue 01: Map One Reimbursement Income to One Expense` → `File Icon SVG`  [AMBIGUOUS]
  public/file.svg · relation: conceptually_related_to

## Knowledge Gaps
- **29 isolated node(s):** `Next.js Agent Rules (breaking changes warning)`, `TypeScript 5 (strict mode)`, `React 19`, `SQLite via LibSQL (@libsql/client)`, `shadcn/ui + Radix UI (UI components)` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Merchants UI`** (6 nodes): `merchants-client.tsx`, `handleDelete()`, `handleMerge()`, `handleSave()`, `toggleSelect()`, `usage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reimbursement Rate Sheet`** (5 nodes): `reimbursement-sheet.tsx`, `addOneMonth()`, `onSubmit()`, `parseDecimal()`, `showErr()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Goal Sheet Form`** (5 nodes): `goal-sheet.tsx`, `getDefaultValues()`, `onSubmit()`, `parseDecimal()`, `showErr()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reimbursements Page`** (4 nodes): `page.tsx`, `reimbursement-allocations.ts`, `indexReimbursementAllocations()`, `ReimbursementsPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Dashboard Page`** (4 nodes): `page.tsx`, `DashboardPage()`, `opening-balance.ts`, `getMonthOpeningBalance()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Categories Client`** (4 nodes): `categories-client.tsx`, `handleDelete()`, `handleSave()`, `usage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Reimbursement Mapping Sheet`** (4 nodes): `reimbursement-mapping-sheet.tsx`, `fmt()`, `formatDate()`, `toggleExpense()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Monthly Opening Balances`** (3 nodes): `assertMonthKey()`, `upsertMonthlyOpeningBalance()`, `monthly-opening-balances.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Logo SVG`** (2 nodes): `Next.js Logo SVG`, `Vercel Logo SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `TypeScript 5 (strict mode)`** (1 nodes): `TypeScript 5 (strict mode)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React 19`** (1 nodes): `React 19`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Hook Form + Zod (forms a`** (1 nodes): `React Hook Form + Zod (forms and validation)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `CatSwatch (Category Icon Tile)`** (1 nodes): `CatSwatch (Category Icon Tile) Component`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Globe Icon SVG`** (1 nodes): `Globe Icon SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Window/Browser Icon SVG`** (1 nodes): `Window/Browser Icon SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Issue 01: Map One Reimbursement Income to One Expense` and `File Icon SVG`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `revalidateApp()` connect `Budget & Category Actions` to `Monthly Opening Balances`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `syncEffectiveAmount()` connect `Core Utility Helpers` to `Budget & Category Actions`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `revalidateApp()` (e.g. with `addMerchant()` and `updateMerchant()`) actually correct?**
  _`revalidateApp()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 11 inferred relationships involving `nanoid()` (e.g. with `doSeed()` and `addMerchant()`) actually correct?**
  _`nanoid()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Next.js Agent Rules (breaking changes warning)`, `TypeScript 5 (strict mode)`, `React 19` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Budget & Category Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._