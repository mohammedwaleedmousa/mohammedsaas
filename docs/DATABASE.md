# Database

## Technology

V1 uses PostgreSQL through Prisma 7 and `@prisma/adapter-pg`. `prisma/schema.prisma` is the application schema; ordered SQL migrations under `prisma/migrations` are the deployable history.

## Migration history

The current ordered history is intentionally preserved:

1. `20260822000100_init_core` — enums, users, tenants, memberships, roles, subscriptions.
2. `20260822000110_init_business` — billing payments, customers, suppliers, products, warehouses, inventory, sales and purchases.
3. `20260822000120_init_finance` — expenses, chart of accounts, journals, fiscal periods, cashier shifts, POS, notifications, audit and feature flags.
4. `20260822000130_init_relations` — foreign keys.
5. `20260822000140_init_indexes` — operational indexes.
6. `20260822000200_integrity` — financial checks, posted-journal protection, and initial tenant RLS.
7. `20260822000300_security_fixes` — corrected deferred balance triggers, narrow invitation resolver, and immutable/RLS-protected audit logs.
8. `20260822000400_pos_refunds` — line-level partial returns, refund idempotency, and cashier variance.
9. `20260822000500_prisma_enum_names` — reconciles preserved snake-case PostgreSQL enum names with the current Prisma enum names and recompiles affected PL/pgSQL functions.

Preserved migrations are not rewritten merely to simplify history. Corrections are applied as later migrations. Migration `004` explicitly drops the original `sales_returns_invoice_id_key` constraint before allowing multiple partial returns.

## Tenant data

Most business tables carry `tenant_id`. Child tables without it, such as journal lines and invoice/return items, inherit isolation through a tenant-owned parent in RLS policies.

## Integrity model

Database constraints enforce positive inventory/sale/purchase quantities and valid journal line shape. Deferred balance triggers reject unbalanced posted journals. Posted/reversed journal lines are immutable, and posted journal entries can only follow the allowed reversal transition. Audit logs are immutable.

## Clean deployment gate

The required real database gate is:

```bash
npm run db:generate
npm run db:deploy
```

against a clean PostgreSQL database from migration zero, followed by `npm run test:db`. This has not yet been declared passing in the current stabilization environment.
