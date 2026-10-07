# Testing Rationale

The suite has five files in `tests/`. Four are Vitest files (`npm test` runs `vitest run`, `package.json:12`); one is a Node built-in test runner file. None of them touches a real database. This document explains what each protects, how it isolates the code under test, and what it cannot catch. Test results quoted here are what the assertions *expect*; they were not re-run for this document.

## How the tests are wired

- `vitest.config.ts:4-12` sets `environment: "node"` and aliases `@` to `src`, so test files import production modules exactly as the app does.
- There is no `include` override, so Vitest uses its default test-file glob. That glob also matches `.mjs` files, which means `tests/deal-stage-update-result.test.mjs` is in scope for Vitest as well as for `node --test`. That file imports `node:test`, not Vitest, so whether `npm test` reports it cleanly depends on how your Vitest version treats a file with no Vitest suites. Run it directly with `node --test tests/deal-stage-update-result.test.mjs` to be sure.
- `tests/helpers/load-typescript.mjs:5` loads a `.ts` file through `node:vm` after `stripTypeScriptTypes` (from `node:module`) removes the types, and replaces imports with the `stubs` you pass. Imports that are neither stubbed, relative, `@/`-aliased nor in its small builtin list throw `Unstubbed <spec>`. `stripTypeScriptTypes` only exists in recent Node releases (22.13+ / 23.2+), so this test needs a modern Node.

## Tenant isolation

- Test file: `tests/tenantIsolation.test.ts:5-46`.
- What it tests: `leadRepository.list(ctx, fakeDb, { status: "NEW" }, 1, 20)` calls `findMany` with a `where` containing both `organizationId: "org_A"` and `status: "NEW"` (`:35-44`).
- Isolation technique: a fake `db` object with only `lead.findMany` (`:30-33`), so no Prisma client or database is needed.
- Why it matters: the most dangerous isolation failures are silent leaks, not crashes. This test pins the seam where `withTenantScope` becomes a real query.
- Blind spots: it covers one method of one repository. It would not catch a new repository method that forgets `withTenantScope`, nor the cross-tenant foreign-key gap (an activity pointing at another org's lead), because that bug is in what the service *writes*, not in how the repository *filters*. It also does not assert that a caller-supplied `organizationId` in `where` is overwritten.

## Permission enforcement

- Test file: `tests/permissionEnforcement.test.ts:11-48`.
- What it tests: a `SALES_REP` calling `POST /api/org/invitations` receives 403 with `error.code === "permission_denied"` (`:45-46`).
- Isolation technique: `vi.mock("@/lib/auth/session", ...)` (`:4-6`) replaces `getOptionalSession` with a stub that returns a hand-built session (`:15-29`). Everything after the session (the `withAuth` checks, the tenant guard, the policy table, the response envelope) is the real code.
- Why it matters: admin-only endpoints change who can access the org in future. A missed permission here is privilege escalation.
- Blind spots: only one route and one role. Because the guard throws before `request.json()` runs, the test would still pass if the body were invalid, which is correct behavior but means the test says nothing about validation. A route that forgot to pass a permission to `requireOrgRequest` at all (like `/api/org/me`, `src/app/api/org/me/route.ts:16`) is invisible to it.

## Invalid state transition

- Test file: `tests/leadStateMachine.test.ts:6-15`.
- What it tests: `assertAllowedLeadTransition(NEW, CONVERTED)` throws an `AppError` whose message matches `/Lead status cannot move/`.
- Why it matters: dashboards count leads by status (`src/services/reportingService.ts:27-31`); invalid jumps corrupt them.
- Blind spots: one forbidden pair out of 36 possible pairs (6 statuses × 6), and zero allowed pairs. It does not notice that `QUALIFIED → CONVERTED` is allowed through the plain status route (`src/services/leadService.ts:22`) even though conversion is supposed to create a contact, nor that `convertLead` accepts `WORKING` (`:226`) while the table does not. A table-driven test over `allowedLeadTransitions` would.

## Validation boundary

- Test file: `tests/validationBoundary.test.ts:4-22`.
- What it tests: `createLeadSchema` rejects `name: ""` and `email: "not-an-email"` and reports both fields in `fieldErrors` (`:16-20`).
- Why it matters: Zod is the last clean boundary before input reaches services.
- Blind spots: it does not cover coercion surprises. `activityListQuerySchema.overdueOnly` uses `z.coerce.boolean()` (`src/lib/validation/activitySchemas.ts:32`), and `Boolean("false")` is `true`, so `GET /api/activities?overdueOnly=false` filters to overdue items. A query-string test would catch that.

## Deal stage update result

- Test file: `tests/deal-stage-update-result.test.mjs:1-31`.
- What it tests (four `node:test` cases):
  1. If `dealRepository.update()` returns `null`, `moveDealStage` rejects with 404 `deal_not_found` and never writes history or audit (`:13`; the stubs at `:7-8` throw if called).
  2. A normal update writes exactly one history row and one audit row (`:14`).
  3. A stage from another pipeline is refused with 409 before any update (`:17-21`).
  4. Moving into a closed, won stage derives `status: "WON"`, sets a real `closedAt`, passes the same context and transaction client to every collaborator, and records the expected history payload (`:22-31`).
- Isolation technique: `loadTypeScript('src/services/dealService.ts', { stubs })` (`:11`) replaces Prisma, repositories, pipeline service and audit service with plain objects. `prisma.$transaction` is stubbed to call the callback with the same object (`:10`), which is how case 4 can assert `client === prisma`.
- Why it matters: it locks down the `!updated` guard at `src/services/dealService.ts:98-100` and the status derivation at `:86-90`.
- Blind spots: the stubs share mutable state across cases (`repo.update` and `pipeline.requireStage` are reassigned inside tests at `:14`, `:18-19`, `:23`), so the cases are order-dependent: case 1 relies on the module-level `update` stub that returns `null`, and once case 2 has replaced `repo.update` that scenario no longer exists. Reordering the file so case 1 runs after case 2 would make case 1 fail. None of the four cases restores the stubs it changed.

## What a production suite would add

- Integration tests against a real Postgres (the `.env.example:1` URL shape) that seed two orgs and attempt every cross-tenant read and write by id.
- A route matrix: every route × every role, asserting 2xx or 403 against the table in `docs/architecture/README.md`.
- Concurrency tests for `organizationService.updateMembership` (two simultaneous demotions of the last two admins) and `jobService.processDueJobs` (two concurrent runners).
- Contract tests on the error envelope from `src/lib/http/responses.ts`, including the 500 path for Prisma `P2002`.

## Exercises

1. **Goal:** make the state-machine test exhaustive. **Check:** add a table-driven test that loops over every `(from, to)` pair, expects success exactly when `to` is in `allowedLeadTransitions[from]`, and therefore has 36 cases. It should pass on the current code (it encodes the current table), and it should fail if you delete `CONVERTED` from the `QUALIFIED` list.
2. **Goal:** catch the coercion bug. **Check:** a test asserting `activityListQuerySchema.parse({ overdueOnly: "false" }).overdueOnly === false` fails today. Fix with `z.enum(["true","false"]).transform(v => v === "true")` and watch it pass.
3. **Goal:** extend the permission test to a second role. **Check:** copy the test, change `role` to `SALES_MANAGER`, and assert 403 again (`SALES_MANAGER` lacks `org.users.write`, `policy.ts:41-59`). Then change it to `ORGANIZATION_ADMIN` and observe that the request now reaches `inviteUser`, which needs a database; decide whether to mock `organizationService` or stop at the guard.
4. **Goal:** remove the order dependence. **Check:** rewrite `tests/deal-stage-update-result.test.mjs` so every case starts from known stub behavior (for example a `beforeEach` that reassigns the *properties* of `repo`, `audit` and `pipeline`; replacing the objects themselves would not reach the already-loaded module, which holds references to the originals). Moving the first `test(...)` call to the end of the file must still leave all four cases passing.
</content>
