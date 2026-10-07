# Load-Bearing Files

These are the files where a small mistake has the largest blast radius. For each: what it does, who calls it, what it calls, what breaks if it is wrong, what a junior would likely miswrite, and one concrete weakness already present in this clone.

## src/lib/auth/session.ts
- What it does: signs the `atlas_session` JWT (`:22-32`), sets and clears the cookie (`:34-50`), and reloads the user plus active membership on every request (`:52-118`).
- What calls it: `src/lib/middleware/withAuth.ts:18` (reads), `src/services/authService.ts:49-53` (writes), `src/app/api/auth/logout/route.ts:12` (clears).
- What it calls: `src/lib/db/prisma.ts`, `src/lib/env.ts:7-15`, `jose`.
- What breaks if it is wrong: forged or stale membership state bypasses every downstream guard.
- What a junior would likely miswrite: trusting the token's claims (role, org) without reloading them.
- Weakness present today: none in the verification itself; the risk is upstream in `authService.demoLogin`, which issues tokens for any known email without a credential (`src/services/authService.ts:14-73`).

## src/lib/middleware/withTenantGuard.ts
- What it does: enforces tenant presence, active membership, active org, and the route's permission (`:13-30`).
- What calls it: 16 org route files, for example `src/app/api/leads/route.ts:18`, `:27`.
- What it calls: `src/lib/db/tenantContext.ts:12-22`, `src/lib/permissions/policy.ts:95-103`.
- What breaks if it is wrong: users reach org data without the right tenant or role.
- What a junior would likely miswrite: treating "logged in" as "authorized for this org", or omitting the optional `permission` argument.
- Weakness present today: the optional argument *is* omitted once, at `src/app/api/org/me/route.ts:16`, and that route returns audit rows.

## src/lib/db/tenantContext.ts
- What it does: `requireTenantContext` narrows the type (`:12-22`); `withTenantScope` forces `organizationId` into filters (`:24-29`); `assertSameTenant` compares ids (`:31-36`).
- What calls it: seven repositories (`leadRepository`, `contactRepository`, `dealRepository`, `activityRepository`, `savedViewRepository`, `exportJobRepository`, `importJobRepository`) and `withTenantGuard.ts:14`.
- What it calls: `src/lib/http/errors.ts:23-25`.
- What breaks if it is wrong: cross-tenant leakage that is silent and hard to spot.
- What a junior would likely miswrite: making tenant scoping optional for "special cases", or spreading `where` *after* setting `organizationId` (which would let a caller override it).
- Weakness present today: `assertSameTenant` has no callers, so related-row ids from request bodies are never checked.

## src/lib/permissions/policy.ts
- What it does: maps four roles to 21 permission strings and throws on denial (`:11-103`).
- What calls it: `withTenantGuard.ts:26`, `assignment.ts:22`.
- What it calls: `src/lib/http/errors.ts`.
- What breaks if it is wrong: whole endpoint families move from least privilege to overbroad access.
- What a junior would likely miswrite: scattering `if (role === "ORGANIZATION_ADMIN")` checks across services.
- Weakness present today: `rolePermissions` is typed `Record<MembershipRole, OrgPermission[]>` (`:39`), so adding a new role to the Prisma enum forces a compile error here, which is good. Adding a new *permission* does not force any role to be reconsidered, except `ORGANIZATION_ADMIN`, which receives it automatically via `allPermissions` (`:37`, `:40`).

## src/services/organizationService.ts
- What it does: org bootstrap (`:56-108`), workspace bootstrap (`:110-147`), invitations (`:149-189`), membership updates with the last-admin guard (`:191-236`).
- What calls it: `src/app/api/platform/organizations/route.ts`, `src/app/api/org/me/route.ts`, `src/app/api/org/invitations/route.ts`, `src/app/api/org/users/[membershipId]/route.ts`.
- What it calls: `organizationRepository`, `membershipRepository`, `invitationRepository`, `userRepository`, `asyncJobRepository`, `pipelineService`, `auditService`.
- What breaks if it is wrong: tenant admin workflows become partial, unaudited, or unrecoverable (an org with no admin).
- What a junior would likely miswrite: removing the last-admin guard as an edge case.
- Weakness present today: `updateMembership` is not transactional and its guard ignores `INVITED` (`:198-201`); `createOrganization` reuses an existing user by email (`:58`, `:72-79`) but the new org's owner details from the request (`firstName`, `lastName`) are then ignored for that user, which can surprise a platform admin.

## src/services/leadService.ts
- What it does: lead list, create, status transitions, conversion (`:65-291`).
- What calls it: `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/status/route.ts`, `src/app/api/leads/[id]/convert/route.ts`.
- What it calls: `assignment.ts`, `pipelineService`, `leadRepository`, `contactRepository`, `assignmentHistoryRepository`, `createDealInTransaction`, `auditService`.
- What breaks if it is wrong: lead state, conversion and ownership drift from reporting and timeline history.
- What a junior would likely miswrite: conversion outside a transaction, or illegal status jumps.
- Weakness present today: the transition table and `convertLead` disagree about which statuses may reach `CONVERTED` (`:22` vs `:226`).

## src/services/dealService.ts
- What it does: deal list, create, stage moves with derived status and history (`:42-189`).
- What calls it: `src/app/api/deals/route.ts`, `src/app/api/deals/[id]/stage/route.ts`, `src/services/leadService.ts:261`.
- What it calls: `pipelineService`, `dealRepository`, `assignmentHistoryRepository`, `auditService`.
- What breaks if it is wrong: pipeline boards and won/lost reporting diverge from deal state.
- What a junior would likely miswrite: accepting a stage from another pipeline, or forgetting `closedAt`.
- Weakness present today: `companyId`, `primaryContactId` and `sourceLeadId` are written unchecked (`:149-151`); moving to the current stage is not a no-op (`:92-96` rewrites `closedAt`).

## src/repositories/leadRepository.ts
- What it does: tenant-scoped lead persistence with relation includes (`:12-96`).
- What calls it: only `src/services/leadService.ts`.
- What it calls: the injected `DbClient` and `withTenantScope`.
- What breaks if it is wrong: tenant leaks and broken lead timelines.
- What a junior would likely miswrite: `findById` filtering by `id` only, or `update` using Prisma's `update({ where: { id } })`.
- Weakness present today: `findById` includes the full, unbounded `statusHistory` (`:67-69`) while capping activities at 20 (`:63-66`); a long-lived lead's detail read grows without limit.

## src/services/exportService.ts
- What it does: turns an export request into an `ExportJob` + `AsyncJob` + audit row (`:26-60`).
- What calls it: `src/app/api/exports/route.ts:19`, `:28`.
- What it calls: `exportJobRepository`, `savedViewRepository`, `asyncJobRepository`, `auditService`.
- What breaks if it is wrong: synchronous timeouts or unaudited background work.
- What a junior would likely miswrite: generating CSV inline in the request.
- Weakness present today: a missing or foreign `savedViewId` is silently ignored (`:28`), and personal views of other members are usable (`savedViewRepository.ts:39-43`).

## src/services/jobService.ts
- What it does: processes due async jobs (`:17-129`).
- What calls it: `src/app/api/jobs/process-due/route.ts:15`.
- What it calls: `asyncJobRepository`, `exportJobRepository`, `contactRepository`, `papaparse`, `prisma.importJob`.
- What breaks if it is wrong: jobs stick, repeat, or apply bad imports invisibly.
- What a junior would likely miswrite: treating completion as a boolean instead of `QUEUED → RUNNING → SUCCEEDED | FAILED`.
- Weakness present today: no claim step (double processing), no per-row validation, non-transactional row inserts, `ImportJob` never marked `FAILED`, and export generation is a stub with `totalRows: 0` (`:33-44`).

## Exercises

1. **Goal:** rank by blast radius. **Check:** order the ten files above by "number of routes affected if this file had a bug". `withTenantGuard.ts` (16 route files) and `session.ts` (every protected route) should top the list; `exportService.ts` (one route) should be near the bottom.
2. **Goal:** bound the history include. **Check:** add `take: 50` to `statusHistory` in `leadRepository.findById` and confirm `convertLead` still works, since it only reads `lead.convertedContact`, `lead.status` and scalar fields (`src/services/leadService.ts:215-272`).
3. **Goal:** make export reject unknown views. **Check:** after your change, `POST /api/exports` with a random cuid as `savedViewId` returns 404, and no `ExportJob` row is created.
</content>
