# Settings

**Route:** `/settings`

## Overview

Settings lets the user change the choices made at onboarding: their **name**
(shown in the sidebar footer), their **currency** code (shown under the name),
and which optional [modules](modules.md) are enabled. The **balance** is not here
— it is set at onboarding and adjusted from the dashboard.

The sidebar footer (avatar + name + currency) is a link to this page.

## Reference files

| File | Role |
|---|---|
| [app/(app)/settings/page.tsx](../../app/(app)/settings/page.tsx) | Server Component; loads `getUserSettings()` + `getModules()` |
| [app/(app)/settings/settings-client.tsx](../../app/(app)/settings/settings-client.tsx) | Client Component; the form, "Save changes" enabled only when dirty |
| [lib/actions/settings.ts](../../lib/actions/settings.ts) | `updateSettings({ name, currency, modules })` — never touches `starting_balance` or `onboarded` |
| [components/fern/module-picker.tsx](../../components/fern/module-picker.tsx) | Shared module checklist |

## Onboarding

First run is [app/onboarding/](../../app/onboarding/). The `(app)` layout
redirects there whenever `user_settings.onboarded` is `0`. The form asks for
name, currency (defaults to `EUR`), initial balance (written to
`starting_balance`), and the module selection, then calls `completeOnboarding`
which sets `onboarded = 1`.
