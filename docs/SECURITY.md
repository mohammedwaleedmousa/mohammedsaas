# Security

## Authentication

The API validates Supabase bearer JWTs with `jose` against configured remote JWKS and issuer, requiring the authenticated audience. The token subject is mapped to an internal user record. Public endpoints are explicitly decorated.

## Authorization layers

Workspace authorization is layered:

1. active tenant membership by workspace slug;
2. assigned branch scope;
3. effective permission keys;
4. subscription write policy;
5. tenant predicates in services;
6. PostgreSQL forced RLS.

## HTTP hardening

NestJS uses Helmet, configured CORS origin(s), request throttling, structured exception handling, and a global API prefix. Production secrets belong in environment configuration and are not committed.

## RLS and database integrity

Tenant policies use transaction-local `app.tenant_id`. The RLS integration test uses a deliberately non-superuser, non-bypass, non-owner PostgreSQL role so owner/bypass behavior cannot make a false-positive test.

Audit logs are RLS-protected and immutable. Posted journal history is protected by database triggers. Partial refunds append compensating financial history rather than editing the original sale journal.

## Invitation exception

Accepting an invitation occurs before normal tenant context exists. A narrow `SECURITY DEFINER` function resolves only a valid high-entropy invitation hash plus matching email and expiration state. General tenant-table bypass is not exposed.

## Current stabilization caveat

Security tests and CI definitions exist, but they are not represented as executed/passed until a functional dependency/runner environment can install packages, migrate PostgreSQL, and run the gates.
