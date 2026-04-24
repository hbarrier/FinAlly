# FinAlly

Personal finance manager — runs locally, no authentication required.

## Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind, Fern design system
- **Backend**: FastAPI, SQLModel, SQLite
- **Forms**: react-hook-form + zod
- **Dialogs**: @base-ui-components/react

## Running locally

```bash
./dev.sh start   # start backend (port 8000) and frontend (port 3000)
./dev.sh stop    # stop both
```

Logs are written to `backend.log` and `frontend.log` in the project root.

## Features

| Area | Status |
|---|---|
| Categories | done |
| Merchants | done |
| Movements | planned |
| Recurring payments | planned |
| Reimbursements | planned |
| Budgets | planned |