# Mission

Fern is a personal finance app for tracking where your money goes and planning where it should go next.

It is built for a single user who wants full ownership of their financial data — no cloud sync, no subscriptions, no third-party access. The database lives on your machine.

At install the user gives their name, currency and starting balance, and chooses
which optional modules to enable. The base app is always present; recurring,
divorce (reimbursements + tax), budgets, simulations and objectives are modules
that can be turned on or off any time. See [features/modules.md](features/modules.md).

## What Fern does

- Records every income and expense transaction
- Tracks recurring bills and income (rent, salary, subscriptions) — *module*
- Compares actual monthly spending against per-category budgets — *module*
- Handles reimbursable expenses and tracks when they get paid back — *module*
- Imports transactions from a CSV bank export
- Lets you model future what-if changes to income and expenses via simulations — *module*
- Tracks savings goals — *module*

## What Fern does not do

- Connect to banks or financial institutions
- Support multiple users or accounts
- Provide investment tracking or net-worth calculations
- Sync to any external service

## Design intent

Fern should feel like a well-designed notebook: opinionated layout, fast to use, no clutter. The data model is explicit and auditable — every number on screen can be traced back to a transaction row.

The French/European context is first-class: amounts display in EUR with German locale formatting (`€1.234,56`), dates in French format (`21/04/2026`), and the reimbursement system is built around the French childcare support (`pension alimentaire`) model.
