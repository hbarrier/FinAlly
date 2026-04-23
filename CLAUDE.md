# OVERVIEW

this is a project to manage personal finances.
It is started locally on the pc, therefore there is no need for authentication.

## technical stack
the frontend of the project is built using nextjs, with tailwind and shadcn.
All forms are built using react hook form and zod for validation.
The frontend code is stored in the frontend/ folder.

the backend of the project is built using FastAPI. it is stored in the backend/ folder.
Data is stored in a SQLite database. SQLModel is used as the orm.

## Look and feel
the UI / UX principles to apply in this project are provided in the file ui.md at the root of the project.

## Frontend structure

The frontend uses Next.js 16 App Router with TypeScript.

Routes (all under `frontend/src/app/`):
- `/` — Dashboard
- `/movements` — Movements
- `/recurring` — Recurring payments
- `/reimbursements` — Reimbursements
- `/merchants` — Merchants
- `/categories` — Categories
- `/budgets` — Budgets

Shared components (`frontend/src/components/`):
- `Sidebar.tsx` — 220px fixed sidebar with logo, nav (Lucide icons), user footer, light/dark theme toggle. Client component; uses `usePathname` for active state.
- `PageHeader.tsx` — Page header with kicker (mono uppercase), title (supports serif `<em>`), and optional actions slot.

Design system:
- Fern design tokens are defined as CSS custom properties in `globals.css` (colors, shadows, typography).
- Dark mode is toggled via `data-theme="dark"` on `<html>`, persisted to `localStorage` as `fern-theme`.
- Fonts: Inter (`--font-inter`) for body/nav, Instrument Serif (`--serif`) for display/logo, JetBrains Mono (`--mono-fern`) for amounts and kickers.
- Font variables are loaded via `next/font/google` and wired through `@theme inline` in `globals.css`. Do not redefine `--font-inter` in `:root` — it creates a cyclic self-reference that breaks the cascade.



