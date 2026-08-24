# Architecture

## Shape of V1

MohammedSaaS is an npm-workspaces monorepo with a React web application, a NestJS API, PostgreSQL/Prisma persistence, and three shared packages.

### Web

`apps/web` uses React 19, Vite, TanStack Query, React Router, Supabase JS, and Tailwind. It consumes HTTP contracts from `@mohammedsaas/types`; it does not import Prisma persistence models. Workspace pages are permission-filtered, while the POS screen has explicit controls for sell, shift, discount, refund, product, and customer permissions.

### API

`apps/api` uses NestJS. The global request pipeline applies throttling, Supabase JWT authentication, tenant resolution, permission enforcement, and subscription write enforcement. Business modules use `PrismaService.forTenant()` for tenant-scoped transactions.

### Shared packages

- `@mohammedsaas/types`: shared DTOs and context types.
- `@mohammedsaas/permissions`: permission keys and default role permission sets.
- `@mohammedsaas/accounting-engine`: four-decimal fixed-scale arithmetic and journal builders.

## Request flow

1. Supabase bearer token is verified against configured JWKS/issuer.
2. The authenticated Supabase subject is resolved to the platform `User`.
3. For workspace routes, active membership by workspace slug is resolved.
4. Membership roles, permissions, allowed branches, and subscription state form `TenantContext`.
5. Permission and subscription guards authorize the operation.
6. Tenant-scoped services execute inside a PostgreSQL transaction that sets transaction-local `app.tenant_id`.
7. PostgreSQL RLS is defense in depth underneath application scoping.

## Financial/operational flow

POS sale, purchase receipt/payment, expenses, and refunds update their operational records and accounting journals within tenant transactions. Inventory is represented as an immutable movement ledger. Accounting is represented as journal entries and journal lines; posted history is protected by database triggers.

## V1 status

The architecture is implemented but remains under stabilization. The final CI workflow describes the intended real gate sequence; it is not considered passing until the environment can run it with a genuine npm lockfile.
