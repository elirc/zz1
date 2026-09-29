# Architecture README

This repository is a backend-heavy Next.js SaaS application organized around explicit request boundaries, tenant-aware authorization, and service-layer workflow code.

Top-level folder map:

- `src/app/api/...` holds REST route handlers. Example: `src/app/api/leads/route.ts` receives list/create lead requests, runs auth and tenant guards, parses `createLeadSchema`, and hands off to `leadService.createLead()`.
- `src/lib/...` holds cross-cutting infrastructure. Example: `src/lib/auth/session.ts` hydrates the signed session cookie, `src/lib/middleware/withAuth.ts` creates the base request context, `src/lib/middleware/withTenantGuard.ts` enforces org access, and `src/lib/db/tenantContext.ts` injects `organizationId` into repository queries.
- `src/services/...` owns business logic and multi-entity workflows. Example: `src/services/leadService.ts` coordinates lead creation, state transitions, conversion, history writes, and audit logging.
- `src/repositories/...` owns tenant-scoped Prisma access. Example: `src/repositories/leadRepository.ts` and `src/repositories/dealRepository.ts` call `withTenantScope()` so queries remain reviewable.
- `src/hooks/...` holds React Query hooks that map UI actions to REST endpoints. Example: `src/hooks/useLeads.ts` hits `/api/leads`, and `src/hooks/useLeadConvert()` calls `/api/leads/:id/convert`.
- `src/components/...` holds thin client UI layers. Example: `src/components/layout/workspace-shell.tsx` composes hooks and panels but does not own CRM business rules.
- `prisma/schema.prisma` defines the shared-schema multi-tenant model: organizations, memberships, leads, contacts, deals, activities, exports, audit logs, and async jobs.
- `prisma/seed.ts` creates demo organizations, memberships, pipelines, and CRM records that match the workspace login UI.
- `tests/...` contains focused tests around isolation, permission denial, status transitions, and validation boundaries.

Folder relationship summary:

- Request entry starts in `src/app/api/...`.
- Auth and tenant context are resolved in `src/lib/...`.
- Business rules run in `src/services/...`.
- Prisma reads and writes happen in `src/repositories/...`.
- Client reads and mutations go through `src/hooks/...` into those same routes.

If you want one concrete path to study first, start with:

`src/components/crm/lead-intake-form.tsx` → `src/hooks/useLeads.ts` → `src/app/api/leads/route.ts` → `src/lib/middleware/withAuth.ts` → `src/lib/middleware/withTenantGuard.ts` → `src/lib/validation/leadSchemas.ts` → `src/services/leadService.ts` → `src/repositories/leadRepository.ts`
