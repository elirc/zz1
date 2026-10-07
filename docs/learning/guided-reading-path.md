# Guided Reading Path

Twelve stops, in order. Each has a reason to read it, what to look for (with line numbers), what to trace, what a junior would likely miss, and a small Goal/**Check** you can do before moving on. Budget about 15 minutes per stop; stops 7, 9 and 12 take longer.

## Step 1 — src/app/api/leads/route.ts
**Why read this:** It is the cleanest small example of the route-handler shape used by all 20 handlers.
**What to look for:** The fixed order in `POST` (`:24-31`): `requireAuthenticatedRequest` (`:26`), `requireOrgRequest` with a permission (`:27`), `createLeadSchema.parse` (`:28`), service call wrapped in `created()` (`:29`). `GET` (`:15-22`) does the same with `Object.fromEntries(request.nextUrl.searchParams.entries())` as the parse input (`:19`).
**What to trace:** Called by `src/hooks/useLeads.ts:7-31`; calls `withAuth.ts`, `withTenantGuard.ts`, `leadSchemas.ts`, `leadService.ts`.
**What a junior would likely miss:** The route does almost no business logic on purpose, and the `route()` wrapper from `src/lib/http/responses.ts:61-68` is what turns thrown errors into JSON.
**Goal/Check:** Goal: spot the odd one out. **Check:** open `src/app/api/org/me/route.ts` and `src/app/api/imports/contacts/route.ts`; name what each does differently from this file (no permission at `org/me:16`; `contacts.write` used for a *read* at `imports/contacts:18`).

## Step 2 — src/lib/middleware/withAuth.ts
**Why read this:** Every authenticated request becomes a `RequestContext` here.
**What to look for:** `requireAuthenticatedRequest()` (`:17-34`) and `requirePlatformAdminRequest()` (`:36-44`) are separate because platform access is not tenant access. `tenantId` is `null` when the user has no membership (`:32`).
**What to trace:** Called by every protected handler; calls `src/lib/auth/session.ts:52-118`.
**What a junior would likely miss:** `requestId` trusts the client's `x-request-id` header (`:13-15`); never use it as a security identifier.
**Goal/Check:** Goal: list the platform routes. **Check:** grep `src/app/api` for `requirePlatformAdminRequest`. You should find three call sites in two files.

## Step 3 — src/lib/auth/session.ts
**Why read this:** It turns a signed cookie into live user and membership data.
**What to look for:** Token creation (`:22-32`), cookie flags (`:38-44`), and `getOptionalSession()` reloading user and membership (`:75-92`) instead of trusting JWT claims.
**What to trace:** Called by `withAuth.ts:18` and (for writing) by `authService.ts:49-53`; calls `src/lib/db/prisma.ts`, `src/lib/env.ts:7-15` and `jose`.
**What a junior would likely miss:** When the token names a membership, it is loaded with no status filter (`:78-82`). That is intentional: the tenant guard rejects inactive memberships with a clear 403 instead of the user silently falling back to another org.
**Goal/Check:** Goal: decode a real token. **Check:** sign in, copy `atlas_session` from devtools, paste the middle segment into a base64 decoder; you should see `sub`, `activeMembershipId`, `activeOrganizationId`, `iat`, `exp` and nothing about roles.

## Step 4 — src/lib/middleware/withTenantGuard.ts
**Why read this:** The narrow gate between "authenticated" and "allowed to touch this tenant".
**What to look for:** `requireOrgRequest()` (`:13-30`): tenant context (`:14`), membership status (`:17-19`), org status (`:21-23`), permission (`:25-27`).
**What to trace:** Called by 16 of the 20 route files (all except demo-login, logout, and the two platform-admin routes); calls `src/lib/db/tenantContext.ts:12-22` and `src/lib/permissions/policy.ts:95-103`.
**What a junior would likely miss:** The `permission` argument is optional. Forgetting it compiles fine and silently grants every active member access.
**Goal/Check:** Goal: find every caller that omits the permission. **Check:** grep for `requireOrgRequest(baseCtx)` with a closing parenthesis right after `baseCtx`. Exactly one hit: `src/app/api/org/me/route.ts:16`.

## Step 5 — src/lib/permissions/policy.ts
**Why read this:** It makes the role model reviewable in one screen.
**What to look for:** `ORG_PERMISSIONS` (`:11-33`), `rolePermissions` (`:39-85`), `hasOrgPermission` (`:91-93`), `assertOrgPermission` (`:95-103`).
**What to trace:** Called by `withTenantGuard.ts:26` and `assignment.ts:22`.
**What a junior would likely miss:** UI hiding is not authorization; this file is the server truth. Also, a permission in the map that no route asks for is dead weight that gives a false sense of control.
**Goal/Check:** Goal: build the role matrix. **Check:** produce a 21-row × 4-column yes/no table from `:39-85`. `READ_ONLY` should have exactly 7 "yes" cells.

## Step 6 — src/lib/db/tenantContext.ts
**Why read this:** The simplest place to study tenant scoping without business noise.
**What to look for:** `requireTenantContext` (`:12-22`), `withTenantScope` (`:24-29`), and the unused `assertSameTenant` (`:31-36`).
**What to trace:** `withTenantScope` is called from seven repositories (see `docs/architecture/auth-and-tenant-isolation.md` section 6).
**What a junior would likely miss:** Repetition of `organizationId` is protective. Also notice which repositories do *not* use this helper (`membershipRepository`, `pipelineRepository`, `invitationRepository`) and rely on the caller passing `ctx.tenantId`.
**Goal/Check:** Goal: confirm `assertSameTenant` is dead. **Check:** grep the repo for `assertSameTenant`; the only hit is its definition.

## Step 7 — src/services/leadService.ts
**Why read this:** The best example of service-layer orchestration here.
**What to look for:** The transition table (`:19-26`), `createLead()` (`:95-160`), `transitionStatus()` (`:162-199`), `convertLead()` (`:201-291`).
**What to trace:** Called by the three lead routes; calls `assignment.ts`, `pipelineService.ts`, `leadRepository.ts`, `contactRepository.ts`, `assignmentHistoryRepository.ts`, `auditService.ts`, and `createDealInTransaction` from `dealService.ts:126-189`.
**What a junior would likely miss:** Conversion is a transactional state workflow, and it has a side door: `QUALIFIED → CONVERTED` is allowed by the plain status route (`:22`) without creating a contact.
**Goal/Check:** Goal: draw the state machine. **Check:** draw six boxes and the arrows from `:19-26`, then add the extra `WORKING → CONVERTED` arrow that only `convertLead` allows (`:226`). You should end with 10 arrows from the table plus 1 extra.

## Step 8 — src/repositories/leadRepository.ts
**Why read this:** Tenant-scoped persistence once the service hands off.
**What to look for:** `withTenantScope` on every read (`:15`, `:30`, `:56`) and update (`:77`); explicit tenant injection on creates (`:42`, `:92`).
**What to trace:** Called only by `leadService.ts`; uses the injected `db` (either `prisma` or a transaction client, typed as `DbClient` in `src/types/db.ts:3`).
**What a junior would likely miss:** `update()` (`:74-82`) uses `updateMany` + re-read so the tenant filter can live in the `where`. History rows are load-bearing operational data.
**Goal/Check:** Goal: test the cross-tenant update path in your head. **Check:** explain what `leadRepository.update(ctxOfOrgA, db, idOfOrgBLead, {...})` returns and why no row changes (answer: `updateMany` matches zero rows, `findById` returns `null`).

## Step 9 — src/services/organizationService.ts
**Why read this:** Cross-entity workflows outside the CRM core: org bootstrap and membership admin.
**What to look for:** `createOrganization()` (`:56-108`), `getCurrentOrganizationWorkspace()` (`:110-147`), `inviteUser()` (`:149-189`), and the last-admin guard in `updateMembership()` (`:198-211`).
**What to trace:** Called by the platform, `org/me`, `org/invitations` and `org/users/[membershipId]` routes; calls five repositories, `pipelineService.provisionDefaultPipeline` (`:89`) and `auditService`.
**What a junior would likely miss:** Membership changes are a security workflow. This file mixes transactional methods (`createOrganization`, the write half of `inviteUser`) with a non-transactional one (`updateMembership`).
**Goal/Check:** Goal: find the guard's blind spot. **Check:** read `:198-201` and list which `PATCH` bodies against an admin skip the admin count. (Answer: `{"status":"INVITED"}`, `{"status":"ACTIVE"}`, and `{"role":"ORGANIZATION_ADMIN"}`; only the first is dangerous.)

## Step 10 — src/services/dealService.ts
**Why read this:** Pipeline-stage transitions as durable operational state.
**What to look for:** `createDealInTransaction()` (`:126-189`) and `moveDealStage()` (`:71-123`), especially the null-update guard (`:98-100`).
**What to trace:** Called by `deals/route.ts`, `deals/[id]/stage/route.ts`, and `leadService.convertLead()`; calls `pipelineService`, `dealRepository`, `assignmentHistoryRepository`, `auditService`.
**What a junior would likely miss:** Stage change is not a column update: `status` and `closedAt` are derived (`:86-96`) and a history row is written. Moving to the same stage is not rejected.
**Goal/Check:** Goal: compare with the snapshot. **Check:** diff `astraupskill/snapshots/src/services/dealService.ts` against the current file; the difference is the `!updated` guard and its 404.

## Step 11 — src/services/exportService.ts
**Why read this:** The clearest request → async-job handoff.
**What to look for:** `requestExport()` (`:26-60`) writes an `ExportJob`, an `AsyncJob` and an audit row in one transaction; the snapshot fallback chain on `:35`.
**What to trace:** Called by `src/app/api/exports/route.ts:28`; calls `savedViewRepository`, `exportJobRepository`, `asyncJobRepository`, `auditService`.
**What a junior would likely miss:** Returning a file immediately is tempting but fragile. Also, an invalid `savedViewId` does not fail; it just yields `null` (`:28`).
**Goal/Check:** Goal: predict the stored snapshot. **Check:** request an export with `savedViewId` of the seeded "Qualified this week" view (`prisma/seed.ts:284-295`) and no `filtersSnapshot`; the new `ExportJob.filtersSnapshot` should be `{"status":"QUALIFIED"}`.

## Step 12 — src/services/jobService.ts
**Why read this:** It turns the async design into code you can step through.
**What to look for:** The lifecycle writes (`:24-28`, `:112-115`, `:119-123`), the export stub (`:33-44`), the CSV branch (`:45-104`) and the fabricated context (`:57-76`).
**What to trace:** Called by `src/app/api/jobs/process-due/route.ts:15`; calls `asyncJobRepository`, `exportJobRepository`, `contactRepository`, `papaparse`, and `prisma.importJob` directly (`:52-54`, `:93-101`).
**What a junior would likely miss:** Background work needs claim semantics, idempotency and per-row failure handling, and this implementation has none of them yet (see `docs/learning/flow-traces.md`, "Processing queued jobs").
**Goal/Check:** Goal: list the `ImportJobStatus` values this code can produce. **Check:** grep for `ImportJobStatus.` in `src/`; only `APPLIED` is ever written, so `PARSING` and `FAILED` (`prisma/schema.prisma:139-144`) are unreachable.
</content>
