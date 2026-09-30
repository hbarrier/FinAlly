# Settings

**Route:** `/settings`

## Overview

Settings lets the user change the choices made at onboarding: their **name**
(shown in the sidebar footer), their **currency** code (shown under the name),
and which optional [modules](modules.md) are enabled. It also lets them
configure the Budgets page's color coding (see "Budget colors" below). The
**balance** is not here — it is set at onboarding and adjusted from the
dashboard.

The sidebar footer (avatar + name + currency) is a link to this page.

## Reference files

| File | Role |
|---|---|
| [app/(app)/settings/page.tsx](../../app/(app)/settings/page.tsx) | Server Component; loads `getUserSettings()` + `getModules()` + `getBudgetColorSettings()` |
| [app/(app)/settings/settings-client.tsx](../../app/(app)/settings/settings-client.tsx) | Client Component; the form, "Save changes" enabled only when dirty |
| [lib/actions/settings.ts](../../lib/actions/settings.ts) | `updateSettings({ name, currency, locale, modules, budgetColors })` — never touches `starting_balance` or `onboarded` |
| [components/fern/module-picker.tsx](../../components/fern/module-picker.tsx) | Shared module checklist |
| [components/fern/budget-color-fields.tsx](../../components/fern/budget-color-fields.tsx) | Threshold input + color swatch pickers for one budget kind (expense or income) |

## Budget colors

`user_settings.budget_colors` stores a JSON `BudgetColorSettings` object (see
`lib/db-types.ts`), null-safe via `getBudgetColorSettings()` /
`DEFAULT_BUDGET_COLORS` (`lib/settings-options.ts`) — the same nullable-JSON
convention as `recurring.month_rules`. Shape:

```ts
{
  expense: { threshold: number /* 0-1 */, colors: { under, near, atOrOver: string } },
  income:  { threshold: number,            colors: { under, near, atOrOver: string } },
}
```

Each color is one of the app's six named tokens (`CATEGORY_COLORS`). The
Settings UI shows this as a "% near threshold" number input plus three swatch
pickers per kind (`BudgetColorFields`), with a live preview bar. This drives the
Budgets page's total cards and per-category progress bars — see
[docs/features/budgets.md](./budgets.md#color-coding).

## Onboarding

First run is [app/onboarding/](../../app/onboarding/). The `(app)` layout
redirects there whenever `user_settings.onboarded` is `0`. The form asks for
name, currency (defaults to `EUR`), initial balance (written to
`starting_balance`), and the module selection, then calls `completeOnboarding`
which sets `onboarded = 1`.
