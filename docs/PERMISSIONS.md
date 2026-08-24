# Permissions

## Model

Permissions are stable string keys in `@mohammedsaas/permissions`. Roles are tenant-owned and map to permissions through `RolePermission`; users receive roles through their membership. API endpoints declare required permissions with `@RequirePermissions`, enforced by `PermissionsGuard` after tenant context resolution.

## Default roles

V1 seeds/creates default role profiles for `OWNER`, `ADMIN`, `ACCOUNTANT`, `CASHIER`, `SALES`, `INVENTORY`, `PURCHASING`, and `BRANCH_MANAGER`. Owner receives the full catalog. Other roles receive focused subsets; for example cashiers receive POS shift/sell/refund/discount plus basic sales/customer/product access, while accountants receive accounting, journal, period, financial reporting, banking, expense, and read permissions.

## POS controls

The POS UI and API both enforce authorization. UI controls are shown only when relevant permissions exist, but the server remains authoritative:

- `pos.sell` — complete POS sales.
- `pos.open_shift` — query/open cashier shift.
- `pos.close_shift` — shift summary and close.
- `pos.discount` — submit non-zero line discounts.
- `pos.refund` — lookup and execute refunds.
- `products.view` — product catalog access.
- `customers.view` / `customers.create` — customer selection/creation.

Removing a control in the browser is not considered a security boundary; API guards and tenant checks are required.
