# V1 Scope

## Included in V1

V1 is the production foundation for a subscription business operating system:

- Supabase-backed authentication and account recovery UI.
- Company/workspace onboarding and selection.
- Multi-tenant memberships, roles, permissions, branch assignments, branches, and warehouses.
- Products, customers, suppliers, inventory movement ledger.
- POS cashier shifts, walk-in or selected customer, customer creation, line discounts, payment methods, held cart, sale completion, receipt, partial/final refund, counted-cash close and variance.
- Sales invoices, purchases, supplier payments, expenses.
- Double-entry accounting, chart of accounts, fiscal periods, trial balance, ledger, P&L, balance sheet and operational reports.
- Subscription plans/states, read-only enforcement, platform subscription administration and audit trail.
- Tenant RLS, audit immutability, accounting integrity constraints, idempotency on POS sale/refund paths.
- PostgreSQL integration/security tests and final CI definition.

## Required V1 acceptance flows

A. Company/POS: register → company → branch → employees → warehouse → products → customer → shift → sale → inventory/accounting verification → partial refund → final refund → verification → close shift.

B. Purchasing: supplier → purchase → receive inventory → AP → partial payment → accounting verification.

C. Subscription: trial → active → past due → grace → read only → renewal → active.

## Stability definition

Implementation alone is insufficient. V1 is stable only after a genuine npm lockfile exists and these run successfully on the same code: `npm ci`, Prisma generation, migration from zero on clean PostgreSQL, lint, typecheck, unit tests, PostgreSQL integration/security tests, build, and all three acceptance flows.

## Explicitly out of scope

No V2 feature should be added during stabilization. Items not necessary to satisfy the V1 implementation and acceptance gates belong in the roadmap only.
