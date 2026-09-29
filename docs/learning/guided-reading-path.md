# Guided Reading Path

## Step 1 — src/app/api/leads/route.ts
**Why read this:** It is the cleanest small example of the route-handler shape used throughout the backend.
**What to look for:** The order of operations: auth, tenant guard, Zod parse, service call.
**What to trace:** Called by `src/hooks/useLeads.ts` and `src/components/crm/lead-intake-form.tsx`; calls `src/lib/middleware/withAuth.ts`, `src/lib/middleware/withTenantGuard.ts`, `src/lib/validation/leadSchemas.ts`, and `src/services/leadService.ts`.
**What a junior would likely miss:** The route does almost no business logic on purpose. That is a feature, not missing code.

## Step 2 — src/lib/middleware/withAuth.ts
**Why read this:** This is where every authenticated request becomes a `RequestContext`.
**What to look for:** `requireAuthenticatedRequest()` and `requirePlatformAdminRequest()` are separate because platform access is not the same thing as tenant access.
**What to trace:** Called by nearly every file in `src/app/api/...`; calls `src/lib/auth/session.ts`.
**What a junior would likely miss:** A valid signed cookie is not enough until the user is reloaded and checked for active status.

## Step 3 — src/lib/auth/session.ts
**Why read this:** It shows how the code turns a signed cookie into live user and membership data.
**What to look for:** `getOptionalSession()` reloads the active membership and organization from Prisma instead of trusting JWT claims.
**What to trace:** Called by `src/lib/middleware/withAuth.ts`; calls `src/lib/db/prisma.ts` and `jose`.
**What a junior would likely miss:** Membership is part of session state here because org role is not stored on the `User` row.

## Step 4 — src/lib/middleware/withTenantGuard.ts
**Why read this:** This is the narrow gate between “authenticated” and “allowed to touch this tenant.”
**What to look for:** `requireOrgRequest()` checks membership status, org status, and permission in one place.
**What to trace:** Called by org-scoped route handlers such as `src/app/api/leads/route.ts`; calls `src/lib/db/tenantContext.ts` and `src/lib/permissions/policy.ts`.
**What a junior would likely miss:** If this guard is skipped in one route, the repo still might scope data, but the caller could gain capabilities they should not have.

## Step 5 — src/lib/permissions/policy.ts
**Why read this:** This file makes the role model reviewable.
**What to look for:** `ORG_PERMISSIONS`, `rolePermissions`, and `assertOrgPermission()`.
**What to trace:** Called by `src/lib/middleware/withTenantGuard.ts` and `src/lib/permissions/assignment.ts`; calls `src/lib/http/errors.ts`.
**What a junior would likely miss:** UI hiding is not authorization; this file is the server truth.

## Step 6 — src/lib/db/tenantContext.ts
**Why read this:** It is the simplest possible place to study tenant scoping without a lot of business noise.
**What to look for:** `withTenantScope()` and the `organizationId` injection pattern.
**What to trace:** Called by repository files like `src/repositories/leadRepository.ts` and `src/repositories/dealRepository.ts`; calls `src/lib/http/errors.ts`.
**What a junior would likely miss:** Repetition of `organizationId` is protective; removing it for “cleaner code” is dangerous.

## Step 7 — src/services/leadService.ts
**Why read this:** It is the best example of service-layer orchestration in the project.
**What to look for:** `createLead()`, `transitionStatus()`, `convertLead()`, and `assertAllowedLeadTransition()`.
**What to trace:** Called by `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/status/route.ts`, and `src/app/api/leads/[id]/convert/route.ts`; calls `src/lib/permissions/assignment.ts`, `src/services/pipelineService.ts`, `src/repositories/leadRepository.ts`, `src/repositories/contactRepository.ts`, and `src/services/auditService.ts`.
**What a junior would likely miss:** Conversion is not “update lead, then maybe create contact”; it is a transactional state workflow.

## Step 8 — src/repositories/leadRepository.ts
**Why read this:** It shows what tenant-scoped persistence looks like once the service layer hands off the work.
**What to look for:** `withTenantScope()` on reads and the separate history write methods.
**What to trace:** Called by `src/services/leadService.ts`; calls Prisma via `src/lib/db/prisma.ts` through the injected db client.
**What a junior would likely miss:** History rows are load-bearing operational data, not optional nice-to-haves.

## Step 9 — src/services/organizationService.ts
**Why read this:** It demonstrates cross-entity workflows outside the CRM record core, especially org bootstrap and membership admin.
**What to look for:** `createOrganization()`, `inviteUser()`, and the “last active admin” guard in `updateMembership()`.
**What to trace:** Called by `src/app/api/platform/organizations/route.ts`, `src/app/api/org/me/route.ts`, and `src/app/api/org/invitations/route.ts`; calls multiple repositories, `src/services/pipelineService.ts`, `src/repositories/asyncJobRepository.ts`, and `src/services/auditService.ts`.
**What a junior would likely miss:** Membership changes are a security workflow, not just CRUD.

## Step 10 — src/services/dealService.ts
**Why read this:** It shows how pipeline-stage transitions become durable operational state.
**What to look for:** `createDealInTransaction()` and `moveDealStage()`.
**What to trace:** Called by `src/app/api/deals/route.ts`, `src/app/api/deals/[id]/stage/route.ts`, and indirectly by `src/services/leadService.ts`; calls `src/services/pipelineService.ts`, `src/repositories/dealRepository.ts`, `src/repositories/assignmentHistoryRepository.ts`, and `src/services/auditService.ts`.
**What a junior would likely miss:** Stage change is not just a column update because status and history must move with it.

## Step 11 — src/services/exportService.ts
**Why read this:** It is the cleanest example of synchronous request -> async job handoff in the app.
**What to look for:** `requestExport()` writing both an `ExportJob` row and an `AsyncJob` row.
**What to trace:** Called by `src/app/api/exports/route.ts`; calls `src/repositories/exportJobRepository.ts`, `src/repositories/asyncJobRepository.ts`, and `src/services/auditService.ts`.
**What a junior would likely miss:** Returning a file immediately is tempting but fragile once datasets grow.

## Step 12 — src/services/jobService.ts
**Why read this:** It turns the async job design from “future architecture” into real code you can step through.
**What to look for:** `processDueJobs()` switching on `AsyncJobType` and updating job state transitions.
**What to trace:** Called by `src/app/api/jobs/process-due/route.ts`; calls `src/repositories/asyncJobRepository.ts`, `src/repositories/exportJobRepository.ts`, `src/repositories/contactRepository.ts`, and `papaparse`.
**What a junior would likely miss:** Background work still needs state transitions, retries, and job records; it is not just a deferred function call.
