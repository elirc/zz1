# Auth And Tenant Isolation

This document follows a request from cookie to repository and names the exact lines where each security decision is made. Read it with `src/lib/auth/session.ts`, `src/lib/middleware/withAuth.ts`, `src/lib/middleware/withTenantGuard.ts`, `src/lib/db/tenantContext.ts` and `src/lib/permissions/policy.ts` open side by side.

## 1. Session creation (demo login)

- `POST /api/auth/demo-login` (`src/app/api/auth/demo-login/route.ts:12-17`) parses `{ email, organizationId? }` with `demoLoginSchema` (`src/lib/validation/authSchemas.ts:9-13`) and calls `authService.demoLogin()`.
- `demoLogin()` (`src/services/authService.ts:14-73`) loads the user by lower-cased email, including only memberships that are `ACTIVE` in an org that is `ACTIVE` or `TRIALING` (`:20-33`). An inactive or missing user gets 401 `login_failed` (`:37-39`).
- If the body names an `organizationId`, the matching membership is chosen; otherwise the oldest qualifying membership wins (`orderBy createdAt asc`, `:30-32`, picked at `:41-43`). Naming an org the user does not belong to gives 404 `membership_not_found` (`:45-47`).
- `setSessionCookie()` (`src/lib/auth/session.ts:34-45`) signs a JWT with `sub = userId` and claims `activeMembershipId` and `activeOrganizationId` (`:22-32`), HS256, 7-day expiry (`:30`). The cookie is `atlas_session` (`:16`), `httpOnly`, `sameSite: "lax"`, `secure` only in production, `maxAge` 7 days (`:38-44`).
- The secret comes from `CRM_SESSION_SECRET` via `getRequiredEnv()` (`src/lib/env.ts:7-15`), which throws if it is unset. `.env.example:2` ships a placeholder value.

**There is no password or second factor anywhere in this flow.** Whoever knows a seeded email becomes that user, including the platform admin `platform@atlascrm.dev` (`prisma/seed.ts:105-110`). The route is called "demo" but is not gated by any environment check.

## 2. Session hydration on every request

`getOptionalSession(request)` (`src/lib/auth/session.ts:52-118`):

1. No cookie → returns `null` (`:53-57`). The caller decides what that means.
2. Signature or expiry failure → throws 401 `invalid_session` (`:61-69`). Note the asymmetry: a *missing* cookie is "no session", a *bad* cookie is an error.
3. Missing `sub` → 401 (`:71-73`).
4. Reloads the `User` from Postgres (`:75-92`). If the token carries `activeMembershipId`, it loads that one membership by id **without** a status filter (`:78-82`); otherwise it falls back to the first `ACTIVE` membership in an `ACTIVE`/`TRIALING` org (`:83-90`).
5. A missing or non-`ACTIVE` user → 401 `user_inactive` (`:95-97`).
6. Returns an `AuthenticatedSession` whose `membership` carries live `role`, `status` and `organizationStatus` from the database (`:101-117`).

Because the membership is reloaded on every request, demoting or disabling someone takes effect on their next request even though their JWT is still valid for up to seven days. The status filter is deliberately not applied at step 4: the membership is loaded as-is and the *tenant guard* rejects it if it is not active (section 4). If you ever add a route that uses `ctx.session.membership` without calling `requireOrgRequest`, you lose that check.

`activeOrganizationId` is written into the token (`session.ts:25`) but never read back; `getOptionalSession` only extracts `sub` and `activeMembershipId` (`:63-66`). The tenant is always derived from the reloaded membership.

## 3. Base request context

`requireAuthenticatedRequest()` (`src/lib/middleware/withAuth.ts:17-34`):

- `null` session → 401 `auth_required` (`:21-23`).
- `userStatus !== ACTIVE` → 401 `user_disabled` (`:25-27`). This duplicates the check in `session.ts:95-97`; harmless, but only one of them can ever fire.
- Returns `{ requestId, session, tenantId }` where `tenantId = session.membership?.organizationId ?? null` (`:29-33`). `requestId` is taken from the client's `x-request-id` header if present (`:13-15`), so it is a correlation id, not a trusted value.

`requirePlatformAdminRequest()` (`:36-44`) adds `platformRole === PLATFORM_ADMIN` and throws 403 `platform_admin_required` otherwise. It is used by exactly three handlers: `GET`/`POST /api/platform/organizations` (`src/app/api/platform/organizations/route.ts:15`, `:22`) and `POST /api/jobs/process-due` (`src/app/api/jobs/process-due/route.ts:14`).

## 4. Tenant guard

`requireOrgRequest(ctx, permission?)` (`src/lib/middleware/withTenantGuard.ts:13-30`) runs four checks in this order:

| Order | Check | Line | Failure |
|---|---|---|---|
| 1 | `tenantId` and `session.membership` both present | `tenantContext.ts:13-15` | 403 `tenant_scope_required` |
| 2 | membership `status === ACTIVE` | `withTenantGuard.ts:17-19` | 403 `inactive_membership` |
| 3 | organization status is `ACTIVE` or `TRIALING` | `:21-23` | 403 `organization_unavailable` |
| 4 | role holds `permission` (if one was passed) | `:25-27` → `policy.ts:95-103` | 403 `permission_denied` |

It returns an `OrgRequestContext` whose `tenantId` is a non-null string and whose `membership` is non-null (`src/types/context.ts:9-12`). Every service in `src/services` takes this type, so TypeScript prevents calling a tenant service with an unauthenticated context. It does not prevent calling one with the *wrong* permission: that is a route-level choice.

## 5. RBAC

- Permission strings: `ORG_PERMISSIONS` (`src/lib/permissions/policy.ts:11-33`, 21 entries).
- Role map: `rolePermissions` (`:39-85`). `ORGANIZATION_ADMIN` gets everything (`:40`). `SALES_MANAGER` (`:41-59`) gets everything except `org.settings.manage`, `org.users.write`, `org.roles.manage` and `pipelines.manage`. `SALES_REP` (`:60-75`) additionally lacks `org.users.read`, `leads.assign` and `audit_log.read`. `READ_ONLY` (`:76-84`) gets the six `*.read` permissions for leads, contacts, deals, activities, exports and reports, plus `audit_log.read`.
- `assertOrgPermission()` (`:95-103`) throws 403 with a message that includes the role, permission and tenant id. That message reaches the client through `responses.ts:37-48`, so callers learn their own role and org id; acceptable here, worth knowing.

### Assignment rule

`resolveAssignableMembership(ctx, db, requestedId?)` (`src/lib/permissions/assignment.ts:13-35`):

- Defaults the owner to the caller (`:18`).
- Assigning to anyone else requires `leads.assign` (`:20-26`), even when the entity being assigned is a contact, deal or activity. There is no `deals.assign` or `activities.assign`, so a `SALES_REP` cannot assign any record type to a colleague, and a `SALES_MANAGER` can assign all of them.
- Looks the target up with `membershipRepository.findById(db, ctx.tenantId, id)` (`:28`), which filters by `organizationId` (`src/repositories/membershipRepository.ts:41-53`). An owner from another org therefore gives 404 `membership_not_found` (`assignment.ts:30-32`).
- It does **not** check the target membership's status. An admin can assign a lead to a `DISABLED` or `INVITED` member.

## 6. Repository scoping

`withTenantScope(ctx, where)` (`src/lib/db/tenantContext.ts:24-29`) spreads the caller's `where` and then sets `organizationId: ctx.tenantId`. Because the tenant key is written *last*, a caller-supplied `organizationId` inside `where` is overwritten, not merged. Call sites:

- `leadRepository.ts:15`, `:30`, `:56`, `:77`
- `contactRepository.ts:15`, `:29`, `:54`
- `dealRepository.ts:15`, `:31`, `:58`, `:78`
- `activityRepository.ts:15`, `:51`
- `savedViewRepository.ts:15`, `:41`
- `exportJobRepository.ts:15`, `:39`
- `importJobRepository.ts:29`

Creates inject the tenant explicitly instead (`organizationId: ctx.tenantId` after the spread, e.g. `leadRepository.ts:39-43`). Updates use `updateMany` with a scoped `where` followed by a scoped re-read (`leadRepository.ts:74-82`, `dealRepository.ts:76-83`); a cross-tenant id updates zero rows and the re-read returns `null`.

Three repositories take a raw `organizationId` instead of a context: `membershipRepository`, `pipelineRepository`, `invitationRepository`. They are safe only because their callers pass `ctx.tenantId` (for example `src/app/api/pipelines/route.ts:19`). `exportJobRepository.update()` (`exportJobRepository.ts:47-53`) and `asyncJobRepository.update()` (`asyncJobRepository.ts:25-31`) update by bare id; they are only called from the platform-admin job runner.

## 7. Platform vs org separation

- Platform scope: `requirePlatformAdminRequest` plus the two platform routes.
- Org scope: `requireOrgRequest` plus every CRM route.
- There is no automatic platform-admin bypass in org services: a platform admin still needs an active membership to read org data. The seed gives the platform admin an `ORGANIZATION_ADMIN` membership in Northwind (`prisma/seed.ts:156`), which is why logging in as `platform@atlascrm.dev` shows the Northwind workspace.

## Senior-review findings

1. **Unauthenticated identity selection** (`authService.ts:14-73`). See section 1. A production build needs real credentials or an explicit `if (process.env.NODE_ENV === "production") throw` on this route.
2. **Cross-tenant foreign keys.** Tenant scoping covers the primary row, not the ids that point to related rows. `POST /api/activities` with a `leadId` copied from another organization creates an activity in your org attached to their lead (`activityService.ts:64-67`; the schema only requires that the lead exists, `schema.prisma:461`). The same gap exists for `companyId`, `sourceLeadId` and `primaryContactId` on leads, contacts and deals (see `docs/architecture/README.md` finding A2). The unused `assertSameTenant()` (`tenantContext.ts:31-36`) is the intended fix.
3. **Invitation tokens are readable by managers.** `GET /api/org/invitations` requires only `org.users.read` (`src/app/api/org/invitations/route.ts:20`), which `SALES_MANAGER` holds (`policy.ts:42`). It returns full `Invitation` rows (`invitationRepository.ts:16-21`) including `token` (`schema.prisma:258`). No accept-invitation route exists yet, so the token is not currently exploitable, but the first person to add one inherits the leak.
4. **Audit log over-exposure** through `/api/org/me` (`organizationService.ts:123-127`, route `src/app/api/org/me/route.ts:16`): see README finding A4.
5. **The UI treats every bootstrap error as "please log in".** `WorkspaceShell` renders `DemoLoginCard` whenever `useWorkspace()` errors (`src/components/layout/workspace-shell.tsx:32-38`). A 403 `organization_unavailable` or a 500 looks identical to a logged-out state, which makes support tickets hard to triage.

## Where a junior engineer would often get this wrong

- Trusting session payload claims instead of reloading membership (`session.ts:75-92` does it right).
- Checking roles in client components instead of `policy.ts`.
- Filtering the parent entity by tenant but forgetting child writes like `LeadStatusHistory` (`leadRepository.ts:84-95` injects the tenant) or the foreign keys in finding 2.
- Treating assignment fields as metadata instead of an authorization boundary (`assignment.ts:20-26`).

## Exercises

1. **Goal:** prove membership revocation is live. **Check:** sign in as `rep@northwindcrm.dev`, then (in `psql` or Prisma Studio) set that membership's `status` to `DISABLED`. The next `GET /api/leads` should return 403 with `error.code` = `inactive_membership`, without signing out.
2. **Goal:** see the missing-vs-bad cookie asymmetry. **Check:** call `GET /api/org/me` with no cookie (expect 401 `auth_required`), then with `Cookie: atlas_session=garbage` (expect 401 `invalid_session`). Explain which line produces each.
3. **Goal:** confirm `withTenantScope` overwrites rather than merges. **Check:** in a scratch unit test, call `withTenantScope({ tenantId: "A" } as any, { organizationId: "B", status: "NEW" })` and assert the result's `organizationId` is `"A"`.
4. **Goal:** write the fix for finding 2 on one path. **Check:** in `activityService.createActivity`, load each provided parent id through its tenant-scoped repository (`leadRepository.findById`, etc.) and throw `notFoundError` when it returns `null`. A request using another org's `leadId` must now return 404 and create no `Activity` row.
5. **Goal:** map a role to its reachable routes. **Check:** using the route table in `docs/architecture/README.md` and `policy.ts:60-75`, list every route a `SALES_REP` gets a non-403 response from. Expected: everything except the two platform routes, `GET /api/org/users`, `PATCH /api/org/users/[membershipId]`, and both methods of `/api/org/invitations`.

