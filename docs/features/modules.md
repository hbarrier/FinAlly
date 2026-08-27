# Modules

FinAlly ships a **base** feature set and a set of **optional modules**. The user
picks modules during onboarding and can change them any time from
[Settings](settings.md). Choices are stored in the database (the single
`user_settings` row), not in `localStorage`, so they apply on every device.

## Base (cannot be disabled)

Dashboard, Movements (`/transactions`), Categories, Merchants, Settings, and the
core balance / opening-balance logic.

## Optional modules

| Key | Label | Default | Scopes |
|---|---|---|---|
| `recurring` | Recurring | **on** | `/recurring` page + nav; dashboard "Recurring" card; scheduled/ghost instances, "Show N/A", recurring-link and "make recurring" actions, recurring chips and bulk "Set as recurring" on the ledger; layout instance materialization (`ensureInstancesUpTo`); the "start from recurring" / "from recurring" options and the "vs. current recurring" delta in Simulations |
| `divorce` | Divorce | off | `/reimbursements` and `/tax-status` pages + nav; the "Remboursable" checkbox on the movement form; the reimbursement filter, status badges, "map reimbursement" and manual-settlement actions on the ledger |
| `budgets` | Budgets | off | `/budgets` page + nav |
| `simulations` | Simulations | off | `/simulations` and `/simulations/[id]` pages + nav |
| `objectives` | Objectives | off | `/goals` page + nav |

## Reference files

| File | Role |
|---|---|
| [lib/schema.ts](../../lib/schema.ts) | `user_settings` columns `onboarded`, `module_recurring`, `module_divorce`, `module_budgets`, `module_simulations`, `module_objectives` |
| [lib/queries/user-settings.ts](../../lib/queries/user-settings.ts) | `getModules()` — resolves the flags into a `Modules` object (cached per request) |
| [lib/modules.ts](../../lib/modules.ts) | `requireModule(key)` — server-component guard that calls `notFound()` |
| [lib/settings-options.ts](../../lib/settings-options.ts) | `CURRENCIES`, `MODULE_META` — shared by onboarding and settings |
| [lib/actions/settings.ts](../../lib/actions/settings.ts) | `completeOnboarding`, `updateSettings` |
| [components/fern/module-picker.tsx](../../components/fern/module-picker.tsx) | The module checklist (core row locked on) |
| [app/onboarding/](../../app/onboarding/) | First-run screen; the `(app)` layout redirects here until `onboarded = 1` |
| [app/(app)/sidebar-nav.tsx](../../app/(app)/sidebar-nav.tsx) | Filters `NAV` by the enabled modules |

## Business rules

- **Base is locked.** The onboarding and settings checklist shows a "Core" row
  that is always checked and disabled.
- **Recurring defaults on; everything else defaults off.**
- **Disabling a module hides UI only.** No data is deleted — recurring items,
  reimbursement allocations, budgets, simulations and goals stay in the database
  and reappear intact when the module is re-enabled.
- **Direct URLs are guarded.** Each optional page calls `requireModule(...)` and
  renders the not-found page when its module is off. (Because the `(app)`
  segment streams via `loading.tsx`, the HTTP status of that response is 200
  even though the not-found page is shown.)
- **Cross-module scoping.** When `recurring` is off, creating a simulation starts
  from an empty state (no "start from current recurring"), and the simulation
  line form has no "from recurring" option. When `divorce` is off, the movement
  form has no reimbursable checkbox, so no new transaction can be flagged
  reimbursable.
- **Balance is not a module.** The initial balance is asked at onboarding and
  edited from the dashboard, never from Settings.
