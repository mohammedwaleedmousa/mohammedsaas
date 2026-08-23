# Roadmap

This file records future directions only. **None of these items are part of the current stabilization mandate, and no V2 work should begin until every V1 execution gate passes and V1 is explicitly declared stable.**

## First priority: finish V1 stabilization

1. Obtain a genuine npm-generated `package-lock.json` when a functional runner or registry is available.
2. Remove the temporary bootstrap-lockfile workflow only after committing that genuine lockfile.
3. Run the final PostgreSQL CI sequence from a clean database.
4. Fix every real lint/type/test/migration/build failure.
5. Execute and verify the Company/POS, Purchasing, and Subscription acceptance flows.
6. Merge only after the Draft PR is deliberately promoted and all required gates pass.

## Post-V1 candidates

After V1 stability, future planning may evaluate deeper billing-provider integrations, richer analytics, additional inventory workflows, broader financial reporting, mobile/offline POS strategies, external integrations, and operational automation. These are candidates for later product design, not commitments or partially implemented V1 features.
