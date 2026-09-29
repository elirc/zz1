# Testing Rationale

## Tenant isolation
- Test file: `tests/tenantIsolation.test.ts`
- What it tests: `leadRepository.list()` must always apply `organizationId` from `OrgRequestContext`.
- Why this matters in a multi-tenant SaaS system: The most dangerous isolation failures are silent leaks, not crashes. This test protects the repository seam where tenant filters become real Prisma queries.
- What a more thorough production test suite would add here: Integration tests against a real Postgres database, plus coverage across every repository method instead of one representative query path.

## Permission enforcement
- Test file: `tests/permissionEnforcement.test.ts`
- What it tests: A `SALES_REP` calling `POST /api/org/invitations` receives `403`.
- Why this matters in a multi-tenant SaaS system: Admin-only endpoints are attractive targets for privilege escalation because they change org membership and therefore future access.
- What a more thorough production test suite would add here: A matrix of route-level tests across every permission family, plus negative tests for platform routes and assignment-only actions.

## Invalid state transition
- Test file: `tests/leadStateMachine.test.ts`
- What it tests: `assertAllowedLeadTransition()` rejects `NEW -> CONVERTED`.
- Why this matters in a multi-tenant SaaS system: Operational dashboards, automation, and rep workflows depend on state meaning something. Invalid jumps are data corruption, not just UX bugs.
- What a more thorough production test suite would add here: Full state table coverage, route-level transition tests, and tests that verify history rows are written whenever valid transitions succeed.

## Validation boundary
- Test file: `tests/validationBoundary.test.ts`
- What it tests: `createLeadSchema` rejects a blank name and invalid email.
- Why this matters in a multi-tenant SaaS system: Boundary validation stops malformed tenant data before it reaches shared services and shared infrastructure.
- What a more thorough production test suite would add here: Coverage for every route schema, query-string parsing cases, and contract tests that snapshot the exact API error shape returned by `src/lib/http/responses.ts`.
