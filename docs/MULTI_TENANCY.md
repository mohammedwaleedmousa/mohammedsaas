# Multi-Tenancy

## Tenant boundary

Each company is a `Tenant` addressed externally by workspace slug. Users may belong to multiple tenants through `Membership`. A membership receives roles and branch assignments; workspace requests are rejected when no active membership exists.

`TenantContext` contains tenant ID/slug, membership/user IDs, allowed branch IDs, effective permissions, and subscription state.

## Application scoping

Business services use tenant predicates and `PrismaService.forTenant(tenantId, work)`. `forTenant()` runs a Serializable transaction and sets PostgreSQL `app.tenant_id` transaction-locally before executing the callback.

Branch-aware operations additionally verify that the requested branch/warehouse belongs to an allowed branch in the context.

## PostgreSQL RLS

RLS is enabled and forced on tenant-owned tables. Policies compare `tenant_id` with `current_setting('app.tenant_id', true)`. Child tables use parent existence policies. No tenant context means no tenant business rows are visible.

## Security test design

`tenant-isolation.integration.test.ts` creates a dedicated PostgreSQL login with `NOSUPERUSER` and `NOBYPASSRLS`, proves it is neither database nor table owner, and proves RLS is enabled/forced. With Tenant A context it verifies Tenant B cannot be read or modified across customers, products, sales invoices, POS transactions, warehouses, inventory movements, and journal entries. Sensitive cross-tenant inserts/updates are denied.

This test is implemented but still requires execution against the final clean migrated PostgreSQL database before V1 can be marked stable.
