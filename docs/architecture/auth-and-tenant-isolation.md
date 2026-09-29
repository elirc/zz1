# Auth And Tenant Isolation

Auth flow:

- Session signing lives in `src/lib/auth/session.ts` in `signSessionToken()` and `setSessionCookie()`. The cookie name is `atlas_session`.
- Session hydration also lives in `src/lib/auth/session.ts` in `getOptionalSession()`. That function verifies the signed token, reloads the `User`, and reloads the active `Membership` with `organization`.
- Route handlers start auth resolution with `src/lib/middleware/withAuth.ts` in `requireAuthenticatedRequest()`. That function turns the hydrated session into a `RequestContext` with `tenantId`.
- Platform-only routes call `requirePlatformAdminRequest()` in `src/lib/middleware/withAuth.ts`. Example: `src/app/api/platform/organizations/route.ts`.

Tenant scoping enforcement:

- Org-only routes call `requireOrgRequest()` in `src/lib/middleware/withTenantGuard.ts`. This is where membership status, org availability, and org-scoped permission checks are enforced before service code runs.
- `requireOrgRequest()` delegates to `requireTenantContext()` in `src/lib/db/tenantContext.ts`. If a request has no active org membership, it fails before any repository query can run.
- Repository query scoping happens in `withTenantScope()` in `src/lib/db/tenantContext.ts`. Example call sites:
  `src/repositories/leadRepository.ts`
  `src/repositories/contactRepository.ts`
  `src/repositories/dealRepository.ts`
  `src/repositories/activityRepository.ts`
  `src/repositories/savedViewRepository.ts`
- The important review point is that the repository layer, not the React UI, injects `organizationId`.

RBAC enforcement:

- Org permission definitions live in `src/lib/permissions/policy.ts` as `ORG_PERMISSIONS`.
- Role-to-permission mapping also lives in `src/lib/permissions/policy.ts` in `rolePermissions`.
- Permission rejection happens in `assertOrgPermission()` in the same file. `requireOrgRequest()` calls it before service logic.
- Assignment-specific authorization lives in `src/lib/permissions/assignment.ts` in `resolveAssignableMembership()`. That is where “can this caller assign work to another member?” is checked server-side.

Where platform and org permissions are separated:

- Platform scope: `src/lib/middleware/withAuth.ts` and `src/app/api/platform/organizations/route.ts`
- Org scope: `src/lib/middleware/withTenantGuard.ts` and all org CRM routes such as `src/app/api/leads/route.ts`
- There is no automatic platform-admin bypass in org CRM services. A user still needs an active org membership for org data routes because `requireOrgRequest()` depends on `ctx.session.membership`.

Where a junior engineer would often get this wrong:

- Trusting session payload claims directly instead of reloading the active membership from the database in `src/lib/auth/session.ts`
- Checking roles in client components instead of `src/lib/permissions/policy.ts`
- Filtering the parent entity by tenant but forgetting child writes like `LeadStatusHistory` or `DealStageHistory`
- Treating assignment fields as harmless metadata instead of authorization boundaries in `src/lib/permissions/assignment.ts`

Senior review hotspots:

- `src/lib/db/tenantContext.ts` because every missing `organizationId` there becomes a silent cross-tenant leak
- `src/lib/auth/session.ts` because stale or forged membership state would undermine every downstream guard
- `src/lib/permissions/policy.ts` because a single extra permission in a role map changes the security model for whole endpoint families
