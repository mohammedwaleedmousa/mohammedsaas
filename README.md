# MohammedSaaS

Production-oriented multi-tenant Business Operating System for small and medium businesses. V1 combines company/workspace management, branches and warehouses, users and permissions, customers and suppliers, products and inventory, POS and sales, purchasing, expenses, double-entry accounting, reporting, and subscription enforcement.

> **Status: V1 stabilization in progress.** Draft PR #1 must remain unmerged until the real dependency install, Prisma generation, clean-database migration, lint, typecheck, unit/integration/security tests, build, and acceptance flows all execute successfully.

## Repository layout

- `apps/api` — NestJS API, Prisma/PostgreSQL persistence, Supabase JWT verification.
- `apps/web` — React/Vite Arabic-first web application and POS UI.
- `packages/accounting-engine` — fixed-scale decimal arithmetic and journal templates.
- `packages/permissions` — permission catalog and default role policies.
- `packages/types` — shared API/frontend contracts.
- `prisma` — Prisma schema and ordered SQL migrations.
- `apps/api/test` — PostgreSQL vertical-flow, RLS, and subscription lifecycle tests.
- `docs` — implementation documentation and V1 boundaries.

## Runtime baseline

- Node.js `>=22.12.0`
- npm `>=10.9.0`
- PostgreSQL
- Supabase Auth for production authentication tokens

A genuine npm-generated `package-lock.json` is still pending because the current GitHub-hosted job fails before its first step and the package registry has also been unavailable from the execution environment. The lockfile must not be hand-written. Once it exists, reproducible installation is `npm ci`.

## Intended verification commands

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run lint
npm run typecheck
npm run test
npm run test:db
npm run build
```

`npm run test:db` requires a PostgreSQL database referenced by `DATABASE_URL`. It executes transaction-flow, tenant RLS, and subscription lifecycle coverage.

## Configuration

Copy `.env.example` and provide the required database and Supabase values. The API expects `DATABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_JWT_ISSUER`, and `WEB_ORIGIN`; the web application expects `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.

## Documentation

See `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/ACCOUNTING_ENGINE.md`, `docs/MULTI_TENANCY.md`, `docs/PERMISSIONS.md`, `docs/SUBSCRIPTIONS.md`, `docs/SECURITY.md`, `docs/V1_SCOPE.md`, and `docs/ROADMAP.md`.
