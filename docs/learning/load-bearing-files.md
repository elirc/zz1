# Load-Bearing Files

## src/lib/auth/session.ts
- What it does: Signs cookies and reloads the authenticated user plus active membership.
- What calls it: `src/lib/middleware/withAuth.ts`, `src/app/api/auth/demo-login/route.ts`, `src/app/api/auth/logout/route.ts`
- What it calls: `src/lib/db/prisma.ts`, `src/lib/env.ts`, `jose`
- What would break or become insecure if this file were wrong: Forged or stale membership state could bypass downstream auth assumptions.
- What a junior engineer would likely miswrite here: Trusting the token payload without reloading membership and organization status.

## src/lib/middleware/withTenantGuard.ts
- What it does: Enforces active org membership and org-scoped permission checks.
- What calls it: Org route handlers such as `src/app/api/leads/route.ts`, `src/app/api/org/invitations/route.ts`, `src/app/api/deals/route.ts`
- What it calls: `src/lib/db/tenantContext.ts`, `src/lib/permissions/policy.ts`
- What would break or become insecure if this file were wrong: Users could hit org data routes without the right tenant or role.
- What a junior engineer would likely miswrite here: Treating “logged in” as equivalent to “authorized for this org.”

## src/lib/db/tenantContext.ts
- What it does: Makes `organizationId` injection explicit and reusable.
- What calls it: Repository files such as `src/repositories/leadRepository.ts`, `src/repositories/contactRepository.ts`, `src/repositories/dealRepository.ts`
- What it calls: `src/lib/http/errors.ts`
- What would break or become insecure if this file were wrong: Cross-tenant data leakage would become silent and hard to spot.
- What a junior engineer would likely miswrite here: Making tenant scoping optional for “special cases.”

## src/lib/permissions/policy.ts
- What it does: Maps org roles to explicit permission strings and throws on denied access.
- What calls it: `src/lib/middleware/withTenantGuard.ts`, `src/lib/permissions/assignment.ts`
- What it calls: `src/lib/http/errors.ts`
- What would break or become insecure if this file were wrong: Whole endpoint families would shift from least privilege to overbroad access.
- What a junior engineer would likely miswrite here: Collapsing roles directly into `if role === admin` checks all over the app.

## src/services/organizationService.ts
- What it does: Owns org bootstrap, invitation creation, membership updates, and workspace bootstrap reads.
- What calls it: `src/app/api/platform/organizations/route.ts`, `src/app/api/org/me/route.ts`, `src/app/api/org/invitations/route.ts`, `src/app/api/org/users/[membershipId]/route.ts`
- What it calls: `src/repositories/organizationRepository.ts`, `src/repositories/membershipRepository.ts`, `src/repositories/invitationRepository.ts`, `src/repositories/asyncJobRepository.ts`, `src/services/pipelineService.ts`, `src/services/auditService.ts`
- What would break or become insecure if this file were wrong: Tenant admin workflows would become partial, unaudited, or unrecoverable.
- What a junior engineer would likely miswrite here: Removing the “last admin” guard because it feels like an edge case.

## src/services/leadService.ts
- What it does: Owns lead creation, status transitions, conversion, assignment history, and audit events.
- What calls it: `src/app/api/leads/route.ts`, `src/app/api/leads/[id]/status/route.ts`, `src/app/api/leads/[id]/convert/route.ts`
- What it calls: `src/lib/permissions/assignment.ts`, `src/services/pipelineService.ts`, `src/repositories/leadRepository.ts`, `src/repositories/contactRepository.ts`, `src/services/dealService.ts`, `src/services/auditService.ts`
- What would break or become insecure if this file were wrong: Lead state, conversion, and ownership would drift from reporting and timeline history.
- What a junior engineer would likely miswrite here: Doing conversion outside a transaction or allowing illegal status jumps.

## src/services/dealService.ts
- What it does: Owns deal creation and stage transitions with status derivation and history.
- What calls it: `src/app/api/deals/route.ts`, `src/app/api/deals/[id]/stage/route.ts`, `src/services/leadService.ts`
- What it calls: `src/services/pipelineService.ts`, `src/repositories/dealRepository.ts`, `src/repositories/assignmentHistoryRepository.ts`, `src/services/auditService.ts`
- What would break or become insecure if this file were wrong: Pipeline views and won/lost reporting would silently diverge from deal state.
- What a junior engineer would likely miswrite here: Accepting a stage id from another pipeline or forgetting to update `closedAt`.

## src/repositories/leadRepository.ts
- What it does: Owns lead persistence with tenant filters and related includes.
- What calls it: `src/services/leadService.ts`
- What it calls: Prisma via the injected db client and `src/lib/db/tenantContext.ts`
- What would break or become insecure if this file were wrong: Tenant leaks and broken lead timelines.
- What a junior engineer would likely miswrite here: Filtering `findById()` by `id` only.

## src/services/exportService.ts
- What it does: Converts export requests into durable jobs plus async work.
- What calls it: `src/app/api/exports/route.ts`
- What it calls: `src/repositories/exportJobRepository.ts`, `src/repositories/savedViewRepository.ts`, `src/repositories/asyncJobRepository.ts`, `src/services/auditService.ts`
- What would break or become insecure if this file were wrong: Large exports would turn into synchronous timeouts or unaudited background work.
- What a junior engineer would likely miswrite here: Generating CSV inline during the API request instead of persisting a job.

## src/services/jobService.ts
- What it does: Processes queued async jobs for exports and contact CSV imports.
- What calls it: `src/app/api/jobs/process-due/route.ts`
- What it calls: `src/repositories/asyncJobRepository.ts`, `src/repositories/exportJobRepository.ts`, `src/repositories/contactRepository.ts`, `papaparse`
- What would break or become insecure if this file were wrong: Jobs would get stuck, repeat forever, or apply incorrect imports without state visibility.
- What a junior engineer would likely miswrite here: Treating job completion as a boolean instead of a lifecycle with `QUEUED` → `RUNNING` → `SUCCEEDED`/`FAILED`.
