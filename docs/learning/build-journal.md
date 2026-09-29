# Build Journal

## Stage 1 - Foundation and decision log

### Decision: shared-schema multi-tenancy with explicit application-layer tenant scoping

Why this matters:
The first irreversible choice in a SaaS CRM is how tenant isolation is enforced. It changes the shape of the Prisma schema, repository interfaces, authorization design, test strategy, and operational complexity.

Options considered:

1. Shared database, shared schema, `organizationId` on every tenant-owned table, enforced in repositories and services
   Pros: fastest to build, easiest local development, one Prisma client, straightforward reporting across tenants for platform admins.
   Cons: every query must remember the tenant filter; a missed filter becomes a silent data leak.
2. Shared database with PostgreSQL Row Level Security
   Pros: defense-in-depth at the database layer, safer against forgotten application filters.
   Cons: harder local debugging, more Prisma friction, permissions become split across SQL policy files and app code.
3. Schema per tenant
   Pros: stronger isolation boundary and easier per-tenant backup/restore stories.
   Cons: migration fan-out, harder analytics across tenants, more operational overhead than this teaching project needs.
4. Database per tenant
   Pros: strongest isolation and cleanest enterprise data-separation story.
   Cons: highest provisioning, connection-pool, migration, and reporting complexity.

Chosen option:
Use a shared schema with explicit `organizationId` filters in repository functions and request context, while designing the seams so PostgreSQL RLS could be added later.

Why this wins here:
The user asked for tenant-aware authorization to be explicit and reviewable. Shared-schema plus code-level tenant context makes the review surface visible in `src/lib/...`, `src/services/...`, and `src/repositories/...` instead of hiding critical logic inside database policy files. It also keeps the repo tractable while still teaching the real failure mode: forgotten tenant filters.

What engineers at different levels notice:

- Junior engineers often see `organizationId` as repetitive boilerplate and try to abstract it away too aggressively.
- Mid-level engineers notice the repetition is protective and start looking for centralized query helpers and tests.
- Senior engineers worry about defense-in-depth, admin bypass paths, cross-tenant reporting queries, and how to prove no repository forgot the tenant filter.

## Stage 2 - Identity model

### Decision: `User` + `Membership` instead of `User.organizationId`

Why this matters:
The role and tenant model decides whether future multi-org access, invited users, and platform administration become awkward retrofits or first-class concepts.

Options considered:

1. Put `organizationId` and `role` directly on `User`
   Pros: simplest queries and easiest beginner mental model.
   Cons: blocks multi-org membership, makes invitations awkward, and mixes identity with tenant access.
2. Separate `User` and `Membership`
   Pros: identity is global, access is org-scoped, and role changes become tenant-local.
   Cons: session hydration is more complex and every org route must reason about both user and membership.
3. Only `Membership`, no top-level `User`
   Pros: simpler tenant-local model.
   Cons: duplicates email identity across orgs and makes platform-level admin much harder.

Chosen option:
Use `User` for global identity and `Membership` for org membership plus org role.

Why this wins here:
It matches real SaaS evolution paths and keeps platform concerns separate from tenant concerns. The pattern is visible in `prisma/schema.prisma`, hydrated in `src/lib/auth/session.ts`, and enforced in `src/lib/middleware/withTenantGuard.ts`.

What engineers notice differently:

- Junior: sees an extra join and may think it is needless complexity.
- Mid-level: notices it makes org invitations and future org switching possible.
- Senior: sees cleaner separation between identity, tenant membership, and platform control planes.

## Stage 3 - Request boundary design

### Decision: thin REST route handlers with explicit service and repository layers

Why this matters:
The app has many workflows that touch more than one table. We need request entrypoints that stay readable while business logic remains reusable and testable.

Options considered:

1. Put business logic directly in Next route handlers
   Pros: fewer files.
   Cons: route files become large, hard to test, and easy to copy-paste incorrectly.
2. Use service and repository layers
   Pros: clearer ownership, easier testing, explicit transaction boundaries, reusable workflows.
   Cons: more files and more indirection for simple CRUD.
3. Build a custom generic abstraction framework
   Pros: less repetition in theory.
   Cons: hides logic behind abstractions before the domain is understood.

Chosen option:
Use thin route handlers in `src/app/api/...`, services in `src/services/...`, and repositories in `src/repositories/...`.

Why this wins here:
It keeps the request lifecycle inspectable. `src/app/api/leads/route.ts` is small; `src/services/leadService.ts` owns workflow logic; `src/repositories/leadRepository.ts` owns Prisma calls and tenant filters.

What engineers notice differently:

- Junior: sees "a lot of files."
- Mid-level: notices file boundaries match responsibilities.
- Senior: evaluates whether transactions, auth, and query ownership sit in the right layer.

## Build stages shipped

1. Foundation
   Wrote package/config files, Next app shell, and initial architecture docs.
2. Auth and tenant core
   Added `prisma/schema.prisma`, session hydration in `src/lib/auth/session.ts`, request guards, and permission policy.
3. Org administration
   Added platform org creation, workspace bootstrap, invitations, membership management, audit logging, and default pipeline provisioning.
4. CRM workflows
   Added leads, contacts, deals, activities, saved views, exports, imports, dashboard aggregates, and async job processing.
5. Frontend shell
   Added React Query hooks, demo login UI, workspace dashboard, lead intake form, tables, and pipeline board.
6. Quality gates
   Added targeted tests, seed script, and build verification.

## PR-like slices

### Slice 1 - Auth, tenant context, and platform bootstrap
Purpose: Establish the request context, session model, permission map, and multi-tenant schema.
Novel-logic files:
- `prisma/schema.prisma`
- `src/lib/auth/session.ts`
- `src/lib/middleware/withAuth.ts`
- `src/lib/middleware/withTenantGuard.ts`
- `src/lib/permissions/policy.ts`
- `src/lib/db/tenantContext.ts`
Reviewer focus:
- `prisma/schema.prisma`: verify every tenant-owned model carries `organizationId` and usable indexes.
- `src/lib/auth/session.ts`: verify session claims are reloaded from the database instead of trusted directly.
- `src/lib/db/tenantContext.ts`: verify tenant scoping helpers fail closed.
What a junior reviewer might miss: A route can look authenticated while still lacking a real tenant authorization check.

### Slice 2 - Org admin, invitations, and audit trail
Purpose: Ship platform org creation and org-scoped membership management with audit history.
Novel-logic files:
- `src/services/organizationService.ts`
- `src/repositories/membershipRepository.ts`
- `src/repositories/invitationRepository.ts`
- `src/services/auditService.ts`
- `src/app/api/platform/organizations/route.ts`
- `src/app/api/org/invitations/route.ts`
- `src/app/api/org/users/[membershipId]/route.ts`
Reviewer focus:
- `src/services/organizationService.ts`: verify transaction boundaries and the "last admin" guard.
- `src/app/api/org/invitations/route.ts`: verify permission enforcement happens before validation and service calls.
- `src/services/auditService.ts`: verify actor user and actor membership are both preserved.
What a junior reviewer might miss: Invitation side effects need durable job records, not just an email send call.

### Slice 3 - Lead and contact workflows
Purpose: Add lead CRUD, state transitions, conversion, and contact creation.
Novel-logic files:
- `src/services/leadService.ts`
- `src/repositories/leadRepository.ts`
- `src/repositories/contactRepository.ts`
- `src/lib/validation/leadSchemas.ts`
- `src/app/api/leads/route.ts`
- `src/app/api/leads/[id]/convert/route.ts`
- `src/app/api/leads/[id]/status/route.ts`
Reviewer focus:
- `src/services/leadService.ts`: verify allowed status transitions and transactional conversion flow.
- `src/repositories/leadRepository.ts`: verify every read/write path is tenant-scoped.
- `src/lib/validation/leadSchemas.ts`: verify conversion payload rules line up with service expectations.
What a junior reviewer might miss: Conversion must guard against re-converting a lead that already has `convertedContact`.

### Slice 4 - Deals, activities, saved views, exports, and imports
Purpose: Add the state-heavy operational CRM module and async workflow surfaces.
Novel-logic files:
- `src/services/dealService.ts`
- `src/services/activityService.ts`
- `src/services/exportService.ts`
- `src/services/importService.ts`
- `src/services/jobService.ts`
- `src/app/api/deals/[id]/stage/route.ts`
- `src/app/api/exports/route.ts`
- `src/app/api/imports/contacts/route.ts`
Reviewer focus:
- `src/services/dealService.ts`: verify stage-to-status derivation and pipeline/stage compatibility checks.
- `src/services/exportService.ts`: verify request path queues work instead of doing synchronous file generation.
- `src/services/jobService.ts`: verify job status transitions and error handling.
What a junior reviewer might miss: Background job processing needs its own lifecycle state and failure surface, not just a `try/catch`.

### Slice 5 - Workspace UI and learning surface
Purpose: Add a thin operational frontend that exercises the backend seams without burying logic in React.
Novel-logic files:
- `src/components/layout/workspace-shell.tsx`
- `src/components/crm/lead-intake-form.tsx`
- `src/hooks/useWorkspace.ts`
- `src/hooks/useLeads.ts`
- `src/lib/http/client.ts`
- `src/app/workspace/page.tsx`
Reviewer focus:
- `src/components/layout/workspace-shell.tsx`: verify the UI stays thin and data orchestration lives in hooks.
- `src/hooks/useLeads.ts`: verify mutations invalidate the right cache keys after server writes.
- `src/lib/http/client.ts`: verify client parsing matches the server's `{ data }` / `{ error }` contract.
What a junior reviewer might miss: React Query hooks are part of the request architecture, not just frontend convenience code.
