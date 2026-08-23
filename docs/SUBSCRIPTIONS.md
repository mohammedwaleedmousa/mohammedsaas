# Subscriptions

## V1 states

V1 models `TRIAL`, `ACTIVE`, `PAST_DUE`, `GRACE_PERIOD`, `READ_ONLY`, `SUSPENDED`, and `CANCELLED`.

The current write policy allows business writes during `TRIAL`, `ACTIVE`, `PAST_DUE`, and `GRACE_PERIOD`. `READ_ONLY`, `SUSPENDED`, and `CANCELLED` reject non-read HTTP methods through `SubscriptionWriteGuard`. Read requests remain available so historical business/financial information can still be viewed according to ordinary permissions.

## Platform administration

Platform administrators can start trials, activate/change plans, extend/renew periods, record manual payment, suspend, or explicitly move a subscription into operational status states through the platform subscription endpoint. Platform admin access is separated from tenant roles and uses configured Supabase auth subject IDs.

Every platform subscription change writes both a `SubscriptionEvent` and an immutable tenant audit entry.

## Lifecycle acceptance coverage

The PostgreSQL acceptance test implements:

`TRIAL → ACTIVE → PAST_DUE → GRACE_PERIOD → READ_ONLY → renewal → ACTIVE`.

It verifies write blocking in read-only mode, continued financial report reads, unchanged historical journal data, restored writes after renewal, and audit/event coverage for every state change. The test is implemented but must execute successfully before V1 is considered stable.
