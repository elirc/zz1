# Architecture README

This repository ("Atlas CRM", package name `multi-tenant-crm-platform` in `package.json:2`) is a backend-heavy Next.js 15 SaaS application organized around explicit request boundaries, tenant-aware authorization, and service-layer workflow code. Data lives in PostgreSQL through Prisma 6 (`prisma/schema.prisma:10-13`); sessions are HS256 JWTs signed with `jose` (`src/lib/auth/session.ts:22-32`); the client uses React Query (`src/app/providers.tsx:12-26`).

Line numbers in this folder refer to the files as committed in this clone. If you edit code, re-check them.

## Top-level folder map

| Folder | Role | Concrete example |
|---|---|---|
| `src/app/api/...` | REST route handlers (20 `route.ts` files) | `src/app/api/leads/route.ts:24-31` runs auth, tenant guard, `createLeadSchema.parse`, then `leadService.createLead()` |
| `src/lib/auth`, `src/lib/middleware` | Session + request guards | `session.ts:52-118` hydrates the cookie; `withAuth.ts:17-34` builds `RequestContext`; `withTenantGuard.ts:13-30` enforces org access |
| `src/lib/db` | Prisma singleton + tenant helpers | `tenantContext.ts:24-29` (`withTenantScope`) injects `organizationId` |
| `src/lib/permissions` | Role map + assignment rule | `policy.ts:39-85` (`rolePermissions`), `assignment.ts:13-35` |
| `src/lib/validation` | Zod request schemas | `leadSchemas.ts:11-25` (`createLeadSchema`) |
| `src/lib/http` | Error type, response envelope, browser fetch helper | `responses.ts:61-68` (`route()`), `client.ts:7-24` (`apiFetch`) |
| `src/services` | Business workflows, transactions, audit | `leadService.ts:95-160` (`createLead`) |
| `src/repositories` | Prisma access; most tenant-owned repos call `withTenantScope` | `leadRepository.ts:13-26`, `dealRepository.ts:76-83` |
| `src/hooks` | React Query hooks that call the REST routes | `useLeads.ts:15-31` (`useCreateLead`) |
| `src/components` | Thin client UI | `layout/workspace-shell.tsx:23-175` composes hooks and panels |
| `prisma/` | Schema (20 models, 22 enums) and seed | `seed.ts:69-320` seeds two orgs, six users, one pipeline per org |
| `tests/` | Five focused test files | `tests/tenantIsolation.test.ts`, `tests/deal-stage-update-result.test.mjs` |

There is no `middleware.ts` at the project root: authentication is not done by Next.js edge middleware. Every protected route calls the guard functions itself, which is why "does this route call `requireOrgRequest` with the right permission?" is the main review question for any new handler.

## Layer relationships

- Request entry starts in `src/app/api/...`. Each handler wraps its body in `route()` (`src/lib/http/responses.ts:61-68`), which turns returned values into `{ data }` and thrown errors into `{ error }`.
- Auth and tenant context are resolved in `src/lib/...` before any input parsing: notice that in every org route the guard calls come before `schema.parse(...)` (for example `src/app/api/org/invitations/route.ts:27-29`). An unauthorized caller therefore gets 401/403, never a 422 that would leak schema details.
- Business rules run in `src/services/...`, almost always inside `prisma.$transaction(async (tx) => ...)` (for example `leadService.ts:96`, `dealService.ts:72`, `exportService.ts:27`).
- Prisma reads and writes happen in `src/repositories/...`. Tenant-owned repositories take an `OrgRequestContext` and derive `organizationId` from it; org-admin repositories (`membershipRepository`, `pipelineRepository`, `invitationRepository`) take an explicit `organizationId` argument instead.
- Client reads and mutations go through `src/hooks/...` into those same routes via `apiFetch()` (`src/lib/http/client.ts:7-24`), which unwraps `payload.data` and throws `payload.error.message`.

## Route inventory with guard and permission

| Route | Methods | Guard | Permission (`policy.ts`) |
|---|---|---|---|
| `/api/auth/demo-login` | POST | none | none (see finding A1) |
| `/api/auth/logout` | POST | none | none |
| `/api/platform/organizations` | GET, POST | `requirePlatformAdminRequest` | platform role |
| `/api/jobs/process-due` | POST | `requirePlatformAdminRequest` | platform role |
| `/api/org/me` | GET | `requireOrgRequest(ctx)` | none (see finding A4) |
| `/api/org/users` | GET | org | `org.users.read` |
| `/api/org/users/[membershipId]` | PATCH | org | `org.users.write` |
| `/api/org/invitations` | GET / POST | org | `org.users.read` / `org.users.write` |
| `/api/pipelines` | GET | org | `leads.read` |
| `/api/leads` | GET / POST | org | `leads.read` / `leads.write` |
| `/api/leads/[id]/status` | POST | org | `leads.write` |
| `/api/leads/[id]/convert` | POST | org | `leads.convert` |
| `/api/contacts` | GET / POST | org | `contacts.read` / `contacts.write` |
| `/api/deals` | GET / POST | org | `deals.read` / `deals.write` |
| `/api/deals/[id]/stage` | POST | org | `deals.stage.move` |
| `/api/activities` | GET / POST | org | `activities.read` / `activities.write` |
| `/api/saved-views` | GET / POST | org | `saved_views.manage` |
| `/api/exports` | GET / POST | org | `exports.read` / `exports.write` |
| `/api/imports/contacts` | GET / POST | org | `contacts.write` (both) |
| `/api/reports/dashboard` | GET | org | `reports.read` |

Four permission strings are declared but never checked by any route: `org.settings.manage`, `org.roles.manage`, `pipelines.manage` and `audit_log.read` (`policy.ts:12`, `:15`, `:16`, `:32`). A grep for `ORG_PERMISSIONS.AUDIT_LOG_READ` finds it only inside the role map.

## One concrete path to study first

`src/components/crm/lead-intake-form.tsx:23-48` → `src/hooks/useLeads.ts:15-31` → `src/app/api/leads/route.ts:24-31` → `src/lib/middleware/withAuth.ts:17-34` → `src/lib/middleware/withTenantGuard.ts:13-30` → `src/lib/validation/leadSchemas.ts:11-25` → `src/services/leadService.ts:95-160` → `src/repositories/leadRepository.ts:34-51`

`docs/architecture/request-lifecycle.md` walks this path line by line.

## Senior-review findings (architecture level)

These are confirmed by reading the code in this clone. None were verified by running the app.

- **A1. Demo login has no credential check.** `authService.demoLogin()` (`src/services/authService.ts:14-73`) looks a user up by email and signs a cookie. Posting `{"email":"platform@atlascrm.dev"}` (seeded as `PLATFORM_ADMIN` at `prisma/seed.ts:105-110`) to `/api/auth/demo-login` gives platform-admin access. That is fine for a local demo, but nothing (no env flag, no `NODE_ENV` check) stops this route from shipping.
- **A2. Foreign keys supplied by the client are not tenant-checked.** `withTenantScope` protects the row being read or written, but ids that point to other rows are passed through unchecked: `companyId` in `leadService.ts:115`, `companyId`/`sourceLeadId` in `contactService.ts:78-79`, `companyId`/`primaryContactId`/`sourceLeadId` in `dealService.ts:149-151`, and `leadId`/`contactId`/`dealId`/`companyId` in `activityService.ts:64-67`. Postgres foreign keys only prove that the row exists, not that it belongs to the caller's organization. `assertSameTenant()` exists for this purpose (`src/lib/db/tenantContext.ts:31-36`) but has no call sites.
- **A3. Some check-then-act sequences sit outside a transaction.** The duplicate-member check in `inviteUser` (`organizationService.ts:150-154`) and the last-admin guard in `updateMembership` (`organizationService.ts:192-216`) both read and then write without a transaction or lock.
- **A4. `/api/org/me` returns the audit log to every member.** `getCurrentOrganizationWorkspace()` returns the 10 newest `AuditLog` rows (`organizationService.ts:123-127`, returned at `:145`), and the route asks for no permission (`src/app/api/org/me/route.ts:16`). `SALES_REP` does not hold `audit_log.read` (`policy.ts:60-75`), yet receives audit rows.
- **A5. Prisma constraint violations become 500s.** `errorResponse()` only maps `ZodError` and `AppError` (`responses.ts:23-48`). A duplicate slug (`schema.prisma:172`), duplicate pending invitation (`schema.prisma:265`) or reused `sourceLeadId` (`schema.prisma:381`) throws a Prisma `P2002` error and falls to the generic `internal_server_error` branch (`responses.ts:50-58`).

## Exercises

1. **Goal:** confirm the guard-before-parse ordering is universal. **Check:** open all 20 `route.ts` files; for every org route, the `requireOrgRequest(...)` line number is smaller than the `.parse(` line number. List any exception you find.
2. **Goal:** find the declared-but-unenforced permissions. **Check:** for each of the 21 keys in `ORG_PERMISSIONS` (`policy.ts:11-33`), grep `src/app/api` for it. You should end with exactly four keys that have no route call site.
3. **Goal:** classify every repository by scoping style. **Check:** produce a two-column list, "takes `OrgRequestContext` and uses `withTenantScope`" versus "takes a raw `organizationId` or none". `auditRepository`, `asyncJobRepository` and `userRepository` belong in the second column.
4. **Goal:** trace one write all the way to the database. **Check:** for `POST /api/deals`, name every table that receives an insert (expected: `Deal`, `DealStageHistory`, `AssignmentHistory`, `AuditLog`, from `dealService.ts:141-186`).
