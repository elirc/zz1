# Concepts Demonstrated

## Tenant scoping
Where to look: `src/lib/db/tenantContext.ts` — `withTenantScope()` injects `organizationId` into repository queries. Also see `src/repositories/leadRepository.ts` and `src/repositories/dealRepository.ts`.
Risk if wrong: A missing tenant filter leaks customer data without throwing an error.

## RBAC
Where to look: `src/lib/permissions/policy.ts` — `ORG_PERMISSIONS`, `rolePermissions`, and `assertOrgPermission()`. See the call site in `src/lib/middleware/withTenantGuard.ts`.
Risk if wrong: Routes will look protected in the UI while remaining callable through direct API requests.

## Service layer
Where to look: `src/services/leadService.ts` — `createLead()`, `transitionStatus()`, and `convertLead()`.
Risk if wrong: Route handlers grow fat, transaction boundaries blur, and multi-entity workflows become inconsistent.

## Repository pattern
Where to look: `src/repositories/leadRepository.ts` and `src/repositories/dealRepository.ts`.
Risk if wrong: Query logic gets duplicated across services and tenant scope becomes impossible to audit.

## Zod validation boundary
Where to look: `src/lib/validation/leadSchemas.ts` and `src/app/api/leads/route.ts`.
Risk if wrong: Invalid input reaches services and database code, where errors become less predictable and less user-safe.

## Session/auth flow
Where to look: `src/lib/auth/session.ts` — `getOptionalSession()`, plus `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()`.
Risk if wrong: Stale membership or disabled users could keep acting through old cookies.

## Status machine / state transition
Where to look: `src/services/leadService.ts` — `allowedLeadTransitions` and `assertAllowedLeadTransition()`.
Risk if wrong: Reporting and workflow automation will assume impossible lead states are legitimate.

## Audit logging
Where to look: `src/services/auditService.ts` — `logOrgEvent()` and `logPlatformEvent()`. Review call sites in `src/services/organizationService.ts` and `src/services/leadService.ts`.
Risk if wrong: Support and security teams lose the action trail needed to investigate tenant changes.

## Background job design
Where to look: `src/services/exportService.ts` — `requestExport()` and `src/services/jobService.ts` — `processDueJobs()`.
Risk if wrong: Large exports and imports will block request threads or disappear without retryable state.

## Assignment authorization
Where to look: `src/lib/permissions/assignment.ts` — `resolveAssignableMembership()`.
Risk if wrong: Sales reps could assign work to peers or managers through direct API calls.

## Membership-based multi-tenancy
Where to look: `prisma/schema.prisma` — `model User` plus `model Membership`, and `src/lib/auth/session.ts` where both are hydrated.
Risk if wrong: Role and tenant identity get collapsed into one row and future multi-org support becomes painful.

## Concurrency risk
Where to look: `src/services/organizationService.ts` — `updateMembership()`.
Risk if wrong: The “last active admin” guard is correct for most cases, but without row-level locking two simultaneous demotions could still race. A senior engineer would consider a stronger transaction or database constraint if this were revenue-critical.
