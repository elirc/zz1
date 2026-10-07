# Request Lifecycle

Three requests, traced to the line. Each step names the file, the function and the lines that execute. "Returns" describes what the code would send; none of these traces were captured from a running server.

## Shared envelope

Every handler body runs inside `route()` (`src/lib/http/responses.ts:61-68`):

- A returned plain value becomes `200 { data }` via `ok()` (`:11-13`).
- A returned `Response` (for example from `created()`, `:15-17`, which sets 201) passes through untouched (`:64`).
- A thrown `ZodError` becomes `422 { error: { code: "validation_error", details: error.flatten() } }` (`:24-35`).
- A thrown `AppError` becomes `{ error: { code, message, details } }` with the error's own status (`:37-48`).
- Anything else becomes `500 { error: { code: "internal_server_error" } }` (`:50-58`). The original error is not logged anywhere in this function, so a 500 leaves no server-side trace beyond what Next.js prints.

On the client, `apiFetch()` (`src/lib/http/client.ts:7-24`) throws `new Error(payload.error.message)` for any non-2xx and returns `payload.data` otherwise. Error codes are discarded on the client; only the message survives.

## Request 1: Sales rep creates a lead

1. `src/components/crm/lead-intake-form.tsx:23-48`: `onSubmit` calls `createLead.mutate({...})` with `stageId: defaultStageId`, the first stage of the first pipeline returned by `/api/pipelines` (`:21`). The submit button is disabled until that id exists (`:73`).
2. `src/hooks/useLeads.ts:18-23`: `apiFetch("/api/leads", { method: "POST", body })`.
3. `src/app/api/leads/route.ts:24-31`: `POST()` enters `route()`.
4. `src/lib/middleware/withAuth.ts:17-34`: `requireAuthenticatedRequest()` calls `getOptionalSession()` (`src/lib/auth/session.ts:52-118`), which verifies the JWT and reloads user and membership.
5. `src/lib/middleware/withTenantGuard.ts:13-30`: `requireOrgRequest(baseCtx, "leads.write")` checks tenant presence, membership status, org status and permission (`route.ts:27`).
6. `src/lib/validation/leadSchemas.ts:11-25`: `createLeadSchema.parse(await request.json())` (`route.ts:28`). Defaults fill `source: OTHER`, `priority: MEDIUM`, `tags: []` if omitted (`:20-21`, `commonSchemas.ts:18`).
7. `src/services/leadService.ts:95-160`: `createLead()` opens `prisma.$transaction` (`:96`). Every step below shares that transaction client `tx`.
8. `src/lib/permissions/assignment.ts:13-35`: `resolveAssignableMembership(ctx, tx, input.ownerMembershipId)` (`leadService.ts:97`). With no owner in the body, the caller becomes the owner.
9. `src/services/pipelineService.ts:60-68` or `:70-78`: default pipeline, or the requested `pipelineId` scoped to the tenant (`leadService.ts:98-100`).
10. `src/services/pipelineService.ts:50-58`: `requireStage()` if a `stageId` was sent; otherwise the pipeline's first active stage (`leadService.ts:102-104`). A stage from a different pipeline throws 409 `stage_pipeline_mismatch` (`:106-108`).
11. `src/repositories/leadRepository.ts:34-51`: `create()` inserts the lead with `organizationId: ctx.tenantId` (`:42`) and includes owner, stage, pipeline, company.
12. `src/repositories/leadRepository.ts:84-95`: `createStatusHistory()` writes `null → NEW` with reason "Lead created" (`leadService.ts:128-134`).
13. `src/repositories/assignmentHistoryRepository.ts:11-14`: records `null → owner` (`leadService.ts:136-144`).
14. `src/services/auditService.ts:32-44`: `logOrgEvent()` writes `lead.created` with both actor ids (`leadService.ts:146-156`).
15. The transaction commits; `route.ts:29` wraps the lead in `created()` → **201** `{ data: lead }`.
16. `src/hooks/useLeads.ts:24-29`: `onSuccess` invalidates `["leads"]` and `["dashboard"]`, so the lead table and KPI grid refetch.

Failure exits, in the order they can happen: 401 (step 4), 403 (step 5), 422 (step 6), 403 `permission_denied` for assigning to someone else without `leads.assign` or 404 `membership_not_found` (step 8), 404 `pipeline_not_found` / 409 `default_pipeline_missing` (step 9), 404 `pipeline_stage_not_found` / 409 `stage_pipeline_mismatch` (step 10). Any of these after step 7 rolls back the whole transaction.

## Request 2: Sales rep converts a lead to a contact

1. `src/hooks/useLeads.ts:33-51`: `useLeadConvert()` posts to `/api/leads/:id/convert`. No component in `src/components` calls this hook today; use `curl` or a REST client to exercise the route.
2. `src/app/api/leads/[id]/convert/route.ts:15-23`: auth, then `requireOrgRequest(baseCtx, "leads.convert")` (`:18`), then `convertLeadSchema.parse` (`:19`), then `await params` for the id (`:20`).
3. `src/lib/validation/leadSchemas.ts:40-53`: requires `firstName`/`lastName`; the `.refine` (`:51-53`) demands `dealTitle` and `dealValue` when `createDeal` is true.
4. `src/services/leadService.ts:201-291`: `convertLead()` inside one transaction (`:214`).
5. `src/repositories/leadRepository.ts:53-72`: `findById()` loads the lead with `convertedContact`, the 20 newest activities and full status history. Missing or other-tenant id → 404 `lead_not_found` (`leadService.ts:217-219`).
6. Already-converted check: `lead.convertedContact` → 409 `lead_already_converted` (`:221-223`).
7. Status check: only `WORKING` or `QUALIFIED` may convert, else 409 `lead_not_convertible` (`:226-231`).
8. `src/repositories/contactRepository.ts:33-50`: creates the contact, copying email, phone, company and tags from the lead, with `sourceLeadId: lead.id` (`leadService.ts:233-244`). The owner is the lead's owner, falling back to the caller (`:239`); `resolveAssignableMembership` is not called here.
9. `src/repositories/leadRepository.ts:74-82`: `update()` sets `CONVERTED` (`leadService.ts:246-249`).
10. `createStatusHistory()` records `<old> → CONVERTED` (`:251-257`).
11. Optional deal: `createDealInTransaction()` (`src/services/dealService.ts:126-189`) with `currency: "USD"`, the lead's pipeline, and `input.stageId ?? lead.stageId` (`leadService.ts:259-272`). The deal path writes its own stage history, assignment history and `deal.created` audit row.
12. `logOrgEvent()` writes `lead.converted` with `contactId` and `dealId` (`:274-283`).
13. **200** `{ data: { lead, contact, deal } }` (`:285-289`). The route returns a plain object, not `created()`, so the status is 200 even though rows were created.

## Request 3: Sales rep attempts an admin-only invitation and is rejected

1. `src/app/api/org/invitations/route.ts:25-32`: `POST()`.
2. `src/lib/middleware/withAuth.ts:17-34`: session loads; the rep is active.
3. `src/lib/middleware/withTenantGuard.ts:13-30`: tenant and status checks pass, then `assertOrgPermission(orgCtx, "org.users.write")` (`:25-27`).
4. `src/lib/permissions/policy.ts:95-103`: `SALES_REP` does not hold `org.users.write` (`:60-75`) → throws `forbiddenError("permission_denied", ...)`.
5. `src/lib/http/responses.ts:37-48`: **403** `{ error: { code: "permission_denied", message: "Role SALES_REP cannot perform org.users.write in organization <id>." } }`.
6. `createInvitationSchema` (`src/lib/validation/orgSchemas.ts:25-28`) and `organizationService.inviteUser()` never run, because the guard sits on `route.ts:28` and the parse on `:29`. This exact path is asserted by `tests/permissionEnforcement.test.ts:12-47`.

## Request 4 (bonus): moving a deal stage

`POST /api/deals/:id/stage` (`src/app/api/deals/[id]/stage/route.ts:15-23`) → `dealService.moveDealStage()` (`src/services/dealService.ts:71-123`):

- Loads the deal scoped to the tenant (`:73`), 404 if absent (`:75-77`).
- Loads the target stage scoped to the tenant (`:79`) and rejects a stage from another pipeline with 409 (`:82-84`).
- Derives `status` (`OPEN`/`WON`/`LOST`) and `closedAt` from the stage flags (`:86-96`).
- `dealRepository.update()` (`src/repositories/dealRepository.ts:76-83`) is an `updateMany` plus re-read. If the re-read returns `null` (the row vanished between read and write), the service throws 404 `deal_not_found` **before** writing stage history or audit (`dealService.ts:98-100`). That guard is what `tests/deal-stage-update-result.test.mjs:13` checks.
- Otherwise writes `DealStageHistory` (`:102-108`) and the `deal.stage.moved` audit row (`:110-119`), and returns **200** with the updated deal.

Moving a deal to the stage it is already in is not rejected: it rewrites `closedAt` (a closed deal gets a fresh timestamp) and records a `from == to` history row.

## Senior-review notes on the lifecycle

- **Status-code drift between create routes.** `POST /api/leads` returns 201 via `created()`, but `POST /api/leads/:id/convert`, `POST /api/leads/:id/status` and `POST /api/deals/:id/stage` return 200 (plain object through `route()`). Clients that branch on 201 need to know which is which.
- **No request logging.** `requestId` is computed (`withAuth.ts:13-15`) and stored in the context but never written to a log or to `AuditLog`. Correlating an audit row with a request is impossible.
- **Transaction scope is per-service, not per-request.** `organizationService.updateMembership()` (`src/services/organizationService.ts:191-236`) runs without `$transaction`: the membership update and its audit row (`:222-233`) can be split by a crash.

## Exercises

1. **Goal:** observe the rollback. **Check:** temporarily make `auditService.logOrgEvent` throw, `POST /api/leads`, and confirm with `SELECT count(*) FROM "Lead"` that the count did not change and the response was 500.
2. **Goal:** confirm guard-before-parse. **Check:** as `rep@northwindcrm.dev`, `POST /api/org/invitations` with body `{}`. Predict 403 (not 422) from `route.ts:28-29`, then confirm.
3. **Goal:** exercise the conversion state checks. **Check:** convert a seeded `NEW` lead (Jordan Diaz, `prisma/seed.ts:178-194`) and expect 409 `lead_not_convertible`; move it to `WORKING` via `/status`, convert again, expect 200 with a non-null `contact`.
4. **Goal:** find the same-stage no-op. **Check:** move the seeded "MarketCore annual expansion" deal (`seed.ts:245-259`) to its current stage id; `DealStageHistory` gains a row whose `fromStageId` equals `toStageId`.
</content>
