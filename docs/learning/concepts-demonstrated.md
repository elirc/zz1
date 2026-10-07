# Concepts Demonstrated

Each concept lists where it lives in this codebase, what the code actually does, the risk if it were wrong, and (where the code shows one) a gap you can study. Line numbers refer to this clone.

## Tenant scoping

Where to look: `src/lib/db/tenantContext.ts:24-29`, `withTenantScope()` spreads the caller's filter and then sets `organizationId: ctx.tenantId`, so the tenant always wins. Representative call sites: `src/repositories/leadRepository.ts:15`, `src/repositories/dealRepository.ts:78`.
Risk if wrong: a missing tenant filter leaks customer data without throwing an error.
Gap to study: scoping protects the row being queried, not the ids it points to. `activityService.createActivity` writes `leadId`, `contactId`, `dealId`, `companyId` straight from the body (`src/services/activityService.ts:64-67`). `assertSameTenant()` (`tenantContext.ts:31-36`) was written for this and has no callers.

## RBAC

Where to look: `src/lib/permissions/policy.ts:11-33` (21 permission strings), `:39-85` (role map), `:95-103` (`assertOrgPermission`). Call site: `src/lib/middleware/withTenantGuard.ts:25-27`.
Risk if wrong: routes look protected in the UI while remaining callable through direct API requests.
Gap to study: four permissions (`org.settings.manage`, `org.roles.manage`, `pipelines.manage`, `audit_log.read`) are granted to roles but never required by a route, and `/api/org/me` requires no permission while returning audit rows (`src/services/organizationService.ts:123-127`).

## Service layer

Where to look: `src/services/leadService.ts:95-160` (`createLead`), `:162-199` (`transitionStatus`), `:201-291` (`convertLead`).
Risk if wrong: route handlers grow fat, transaction boundaries blur, and multi-entity workflows become inconsistent.
What the code shows: each service method opens exactly one `prisma.$transaction` and passes `tx` to every repository call, so a failure at any step rolls back the lead, its history rows and its audit row together.

## Repository pattern

Where to look: `src/repositories/leadRepository.ts:12-96`, `src/repositories/dealRepository.ts:12-98`.
Risk if wrong: query logic gets duplicated across services and tenant scope becomes impossible to audit.
Detail worth copying: updates use `updateMany` with a tenant-scoped `where`, then a scoped re-read (`leadRepository.ts:74-82`). Prisma's `update` requires a unique `where`, which would force `{ id }` alone; `updateMany` allows the composite tenant filter, and the re-read returns `null` for a cross-tenant id instead of leaking a row.

## Zod validation boundary

Where to look: `src/lib/validation/leadSchemas.ts:11-53` and the parse call in `src/app/api/leads/route.ts:28`.
Risk if wrong: invalid input reaches services and the database, where errors are less predictable and less user-safe.
Gap to study: query strings arrive as strings, so list schemas use `z.coerce`. That works for numbers (`commonSchemas.ts:12-13`) but not for booleans: `z.coerce.boolean()` on `"false"` yields `true` (`activitySchemas.ts:32`).

## Session/auth flow

Where to look: `src/lib/auth/session.ts:52-118` (`getOptionalSession`), `src/lib/middleware/withAuth.ts:17-34` (`requireAuthenticatedRequest`).
Risk if wrong: stale memberships or disabled users could keep acting through old cookies.
What the code shows: the JWT carries only ids; role and status are reloaded from Postgres on every request (`session.ts:75-92`), so revocation is immediate. The price is a user-plus-membership query (with nested includes) on every API call before any business logic runs.

## Status machine / state transition

Where to look: `src/services/leadService.ts:19-26` (`allowedLeadTransitions`), `:54-62` (`assertAllowedLeadTransition`).
Risk if wrong: reporting and automation assume impossible lead states are legitimate.
Gap to study: the machine has two entry points that disagree. The table allows `QUALIFIED → CONVERTED` through the generic status route (no contact created), while `convertLead` allows `WORKING → CONVERTED` (`:226`) which the table forbids.

## Audit logging

Where to look: `src/services/auditService.ts:21-30` (`logPlatformEvent`), `:32-44` (`logOrgEvent`). Call sites in `organizationService.ts`, `leadService.ts`, `dealService.ts`, `activityService.ts`, `contactService.ts`, `exportService.ts`, `importService.ts`, `savedViewService.ts`.
Risk if wrong: support and security teams lose the action trail.
What the code shows: audit rows are written with the same `tx` as the business write, so a rolled-back action leaves no audit row. Exceptions: `updateMembership` writes its audit row with `prisma` after a non-transactional update (`organizationService.ts:213-233`), and `transitionStatus`/`moveDealStage` write no `AssignmentHistory` because they never change owners. No code path writes audit rows for login or for job processing.

## Background job design

Where to look: `src/services/exportService.ts:26-60` (enqueue), `src/services/importService.ts:19-51` (enqueue), `src/services/jobService.ts:17-129` (process).
Risk if wrong: large exports and imports block request threads or disappear without retryable state.
What the code shows: enqueue is transactional with the domain row (`ExportJob`/`ImportJob`) and the audit row. Processing is a manual, platform-admin-triggered loop (`src/app/api/jobs/process-due/route.ts:12-17`), not a worker. Export processing is a stub (`jobService.ts:33-44`, `totalRows: 0`); four job types are no-ops (`:105-109`).

## Assignment authorization

Where to look: `src/lib/permissions/assignment.ts:13-35`.
Risk if wrong: sales reps could assign work to peers or managers through direct API calls.
What the code shows: one permission, `leads.assign`, governs assignment of leads, contacts, deals and activities alike (`:22`). The target must be in the same org (`:28-32`) but may be disabled or merely invited.

## Membership-based multi-tenancy

Where to look: `prisma/schema.prisma:200-213` (`User`), `:215-249` (`Membership`), and `src/lib/auth/session.ts:75-92` where both are hydrated.
Risk if wrong: role and tenant identity collapse into one row and multi-org support becomes painful.
Gap to study: a user with two memberships has no way to switch orgs after login. `demoLogin` accepts an `organizationId` (`src/services/authService.ts:41-43`), but the UI never sends one (`src/components/crm/demo-login-card.tsx:43`), and there is no switch endpoint.

## Concurrency risk

Where to look: `src/services/organizationService.ts:191-236` (`updateMembership`) and `:149-189` (`inviteUser`); `src/services/jobService.ts:17-28`.
Risk if wrong:
- Last-admin guard: two simultaneous requests demoting the org's last two admins can both read `adminCount = 2` (`:202`) and both proceed, leaving zero admins. The guard also only fires for a role change or `status === DISABLED` (`:200`); setting the last admin's status to `INVITED` skips it entirely.
- Invitations: the duplicate-member check (`:150-154`) runs before the transaction opens (`:156`).
- Jobs: `listDue` + per-job `update` by id has no claim step, so two runners can process the same job.

## Pagination contracts

Where to look: `src/services/leadService.ts:80-92` (rows + `count`), versus `src/services/activityService.ts:38-47`.
Risk if wrong: clients paginate forever or stop early.
Gap to study: leads, contacts and deals return a true `total` from a parallel `count()` query; activities return `total: rows.length` (`activityService.ts:45`), which is at most `pageSize` and therefore wrong whenever there is more than one page.

## Exercises

1. **Goal:** connect concept to code. **Check:** for each heading above, open the cited lines and write one sentence in your own words describing what would happen if that block were deleted. Compare your answers with the "Risk if wrong" lines.
2. **Goal:** fix the pagination gap. **Check:** add `activityRepository.count()` mirroring `contactRepository.count()` (`src/repositories/contactRepository.ts:27-31`) and use it in `listActivities`. `GET /api/activities?pageSize=1` should then report `total` equal to the number of activities in the org (2 for freshly seeded Northwind, from `prisma/seed.ts:261-282`).
3. **Goal:** close the `INVITED` loophole. **Check:** change `organizationService.ts:200` so any status other than `ACTIVE` triggers the admin count. `PATCH` the last admin to `{"status":"INVITED"}` must return 409 `last_admin_guard`.
</content>
