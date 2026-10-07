# Flow Traces

Each flow lists the files in execution order with the lines that run, then a short "what to notice" and "what could go wrong" note grounded in the code. Use these as a checklist while stepping through with a debugger or `console.log`.

## Flow: Demo login to create a session

1. `src/components/crm/demo-login-card.tsx:41-44`: form submit calls `mutation.mutate({ email })`. The email defaults to `admin@northwindcrm.dev` (`:22`), and four quick-pick buttons are rendered from `demoEmails` (`:14-19`).
2. `src/lib/http/client.ts:7-24`: `apiFetch()` sends `POST /api/auth/demo-login`.
3. `src/app/api/auth/demo-login/route.ts:12-17`: `POST()` parses the body.
4. `src/lib/validation/authSchemas.ts:9-13`: `demoLoginSchema` (valid email, optional cuid `organizationId`).
5. `src/services/authService.ts:14-47`: loads the user plus qualifying memberships and picks one.
6. `src/lib/auth/session.ts:34-45`: `setSessionCookie()` signs and stores `atlas_session`.
7. `src/repositories/userRepository.ts:22-27`: `updateLastLogin()` (called at `authService.ts:55`).
8. Returns 200 with `{ user, membership }` (`authService.ts:57-72`); `demo-login-card.tsx:32-35` then invalidates **all** queries, so the workspace refetches under the new cookie.

What to notice: the cookie is set *before* `updateLastLogin` runs. If that update failed, the client would get a 500 but would already hold a valid cookie.
What could go wrong: no password (see `docs/architecture/auth-and-tenant-isolation.md` section 1).

## Flow: Sales rep creates a lead from the workspace form

1. `src/components/crm/lead-intake-form.tsx:23-48`: submit handler calls `useCreateLead().mutate`.
2. `src/hooks/useLeads.ts:15-31`: mutation sends `POST /api/leads`.
3. `src/lib/http/client.ts:7-24`: `apiFetch()`.
4. `src/app/api/leads/route.ts:24-31`: `POST()`.
5. `src/lib/middleware/withAuth.ts:17-34`: `requireAuthenticatedRequest()`.
6. `src/lib/auth/session.ts:52-118`: `getOptionalSession()`.
7. `src/lib/middleware/withTenantGuard.ts:13-30`: `requireOrgRequest(..., "leads.write")`.
8. `src/lib/permissions/policy.ts:95-103`: `assertOrgPermission()`.
9. `src/lib/validation/leadSchemas.ts:11-25`: `createLeadSchema.parse()`.
10. `src/services/leadService.ts:95-160`: `createLead()` in one transaction.
11. `src/lib/permissions/assignment.ts:13-35`: `resolveAssignableMembership()`.
12. `src/repositories/membershipRepository.ts:41-53`: `findById()` scoped by `organizationId`.
13. `src/services/pipelineService.ts:60-68` / `:50-58`: `requireDefaultPipeline()` and, because the form always sends a `stageId`, `requireStage()`.
14. `src/repositories/pipelineRepository.ts:32-42` / `:60-72`: `findDefault()` / `findStage()`.
15. `src/repositories/leadRepository.ts:34-51`: `create()`.
16. `src/repositories/leadRepository.ts:84-95`: `createStatusHistory()`.
17. `src/repositories/assignmentHistoryRepository.ts:11-14`: `create()`.
18. `src/services/auditService.ts:32-44`: `logOrgEvent()`.
19. `src/repositories/auditRepository.ts:11-14`: `create()`.
20. Returns 201; `useLeads.ts:24-29` invalidates `["leads"]` and `["dashboard"]`.

What to notice: the form sends `source: "WEBSITE"` and `priority: "MEDIUM"` as literals (`lead-intake-form.tsx:32-33`), so the UI cannot create any other source.
What could go wrong: `companyId` in the body is written without a tenant check (`leadService.ts:115`); the form does not send one, but a direct API call can.

## Flow: Converting a lead to a contact

1. `src/hooks/useLeads.ts:33-51`: `useLeadConvert()` fires `POST /api/leads/:id/convert` (no UI caller yet).
2. `src/lib/http/client.ts:7-24`: `apiFetch()`.
3. `src/app/api/leads/[id]/convert/route.ts:15-23`: `POST()`.
4. `src/lib/middleware/withAuth.ts:17-34`.
5. `src/lib/middleware/withTenantGuard.ts:13-30` with `leads.convert`.
6. `src/lib/validation/leadSchemas.ts:40-53`: `convertLeadSchema.parse()`.
7. `src/services/leadService.ts:201-291`: `convertLead()`.
8. `src/repositories/leadRepository.ts:53-72`: `findById()`.
9. `src/repositories/contactRepository.ts:33-50`: `create()`.
10. `src/repositories/leadRepository.ts:74-82`: `update()` to `CONVERTED`.
11. `src/repositories/leadRepository.ts:84-95`: `createStatusHistory()`.
12. `src/services/dealService.ts:126-189`: `createDealInTransaction()` when `createDeal` is true (`leadService.ts:259-272`).
13. `src/repositories/dealRepository.ts:35-53`: `create()`.
14. `src/services/auditService.ts:32-44`: `logOrgEvent()` for `lead.converted`.
15. Returns 200 with `{ lead, contact, deal }`.

What to notice: `convertLead` accepts `WORKING` leads (`leadService.ts:226`), but the transition table says `WORKING` can only go to `QUALIFIED`, `UNQUALIFIED` or `ARCHIVED` (`:21`). Conversion bypasses the state machine.
What could go wrong: the opposite door is open too. `QUALIFIED → CONVERTED` *is* in the transition table (`:22`), so `POST /api/leads/:id/status` with `{"status":"CONVERTED"}` marks a lead converted without creating a contact. After that, `/convert` refuses it (`:226-231`), leaving a "converted" lead with no contact forever.

## Flow: Sales rep attempts admin-only invitation and is rejected

1. `src/app/api/org/invitations/route.ts:25-32`: `POST()`.
2. `src/lib/middleware/withAuth.ts:17-34`.
3. `src/lib/auth/session.ts:52-118`.
4. `src/lib/middleware/withTenantGuard.ts:25-27`: permission branch.
5. `src/lib/permissions/policy.ts:95-103`: `assertOrgPermission()`.
6. `src/lib/http/errors.ts:23-25`: `forbiddenError()`.
7. `src/lib/http/responses.ts:37-48`: converted to 403.
8. `src/lib/validation/orgSchemas.ts` and `src/services/organizationService.ts` are never reached.

What to notice: `tests/permissionEnforcement.test.ts:4-6` mocks `getOptionalSession`, so the test exercises steps 1, 2, 4-7 for real and skips the JWT and database.

## Flow: Deal stage transition

1. `src/app/api/deals/[id]/stage/route.ts:15-23`: `POST()`.
2. `src/lib/middleware/withAuth.ts:17-34`.
3. `src/lib/middleware/withTenantGuard.ts:13-30` with `deals.stage.move`.
4. `src/lib/validation/dealSchemas.ts:32-36`: `moveDealStageSchema.parse()`.
5. `src/services/dealService.ts:71-123`: `moveDealStage()`.
6. `src/repositories/dealRepository.ts:55-74`: `findById()` (includes full stage history).
7. `src/services/pipelineService.ts:50-58`: `requireStage()`.
8. `src/repositories/pipelineRepository.ts:60-72`: `findStage()`.
9. `src/repositories/dealRepository.ts:76-83`: `update()`.
10. `src/services/dealService.ts:98-100`: if the re-read is `null`, throw 404 and stop.
11. `src/repositories/dealRepository.ts:85-97`: `createStageHistory()`.
12. `src/services/auditService.ts:32-44`: `logOrgEvent()`.
13. Returns 200 with the updated deal.

What to notice: `SALES_REP` holds `deals.stage.move` (`policy.ts:68`) and there is no ownership check, so any rep can move any deal in the org, including closing someone else's deal as `WON`.

## Flow: Export request becomes async work

1. `src/app/api/exports/route.ts:23-30`: `POST()`.
2. `src/lib/middleware/withAuth.ts:17-34`.
3. `src/lib/middleware/withTenantGuard.ts:13-30` with `exports.write`.
4. `src/lib/validation/exportSchemas.ts:11-15`: `requestExportSchema.parse()`.
5. `src/services/exportService.ts:26-60`: `requestExport()` in one transaction.
6. `src/repositories/savedViewRepository.ts:39-43`: `findById()` if a `savedViewId` was sent.
7. `src/repositories/exportJobRepository.ts:24-35`: `create()` with `filtersSnapshot` = body snapshot, else the view's filters, else `JsonNull` (`exportService.ts:35`).
8. `src/repositories/asyncJobRepository.ts:11-13`: enqueue `EXPORT_GENERATION` (`exportService.ts:38-46`).
9. `src/services/auditService.ts:32-44`: `export.requested`.
10. Returns 201 with the `QUEUED` export job.

What could go wrong: `savedViewRepository.findById` only scopes by tenant (`:41`), not by owner or visibility. A rep can reference a colleague's `PERSONAL` view by id. An unknown `savedViewId` silently yields `savedView = null` instead of a 404 (`exportService.ts:28`).

## Flow: Processing queued jobs

1. `src/app/api/jobs/process-due/route.ts:12-17`: `POST()`.
2. `src/lib/middleware/withAuth.ts:36-44`: `requirePlatformAdminRequest()`.
3. `src/services/jobService.ts:17-129`: `processDueJobs(limit = 20)`.
4. `src/repositories/asyncJobRepository.ts:15-23`: `listDue()` loads **every** due `QUEUED` job across all tenants; the limit is applied afterwards in memory (`jobService.ts:19`).
5. `asyncJobRepository.update()` marks each job `RUNNING` and increments `attempts` (`jobService.ts:24-28`).
6. Export jobs: `exportJobRepository.update()` marks the export `COMPLETED` with a synthetic `fileName`/`fileUrl` and `totalRows: 0` (`:33-44`). No file is generated.
7. CSV import jobs: `Papa.parse` with headers (`:47-50`), then `contactRepository.create()` per row with `firstName` and `lastName` (`:78-91`), then the `ImportJob` becomes `APPLIED` (`:93-101`).
8. `asyncJobRepository.update()` marks the job `SUCCEEDED` (`:112-115`) or `FAILED` with the error message (`:118-125`).
9. Returns `[{ jobId, status }]`.

What could go wrong (all confirmed by reading `jobService.ts`):
- Two concurrent calls can both read the same `QUEUED` job at step 4 and both run it, because step 5 updates by id without a `status: QUEUED` predicate. For imports that means duplicate contacts.
- Imported rows skip `createContactSchema` entirely: no email format check, no length limits.
- Contacts are written with `prisma`, not a transaction (`:83`). A failure on row 50 leaves rows 1-49 committed, marks the `AsyncJob` `FAILED`, and leaves the `ImportJob` stuck in `RECEIVED`, because nothing sets `ImportJobStatus.FAILED`.
- The handler fabricates an `OrgRequestContext` with `role: "ORGANIZATION_ADMIN"` (`:57-76`). It only feeds `contactRepository.create`, which reads `tenantId`, but any future code that checks permissions on this context will see an admin.

## Flow: Contact CSV import request

1. `src/app/api/imports/contacts/route.ts:23-30`: `POST()`.
2. `src/lib/middleware/withAuth.ts:17-34`.
3. `src/lib/middleware/withTenantGuard.ts:13-30` with `contacts.write`.
4. `src/lib/validation/exportSchemas.ts:17-22`: `createContactImportSchema.parse()`. `csvText` only needs `min(1)`; there is no maximum.
5. `src/services/importService.ts:19-51`: `requestContactImport()`.
6. `src/repositories/importJobRepository.ts:13-24`: `create()` with `summary.queuedBytes` (`importService.ts:26-28`). Note `csvText.length` counts UTF-16 code units, not bytes.
7. `src/repositories/asyncJobRepository.ts:11-13`: enqueue `CSV_IMPORT` with the **entire CSV** in the JSON payload (`importService.ts:34-38`).
8. `src/services/auditService.ts:32-44`: `import.requested`.
9. Returns 201 with the `RECEIVED` import job.

## Exercises

1. **Goal:** reproduce the converted-without-contact state. **Check:** take the seeded `QUALIFIED` lead Morgan Patel (`prisma/seed.ts:214-230`), `POST /api/leads/<id>/status` with `{"status":"CONVERTED"}` (expect 200), then `POST /api/leads/<id>/convert` (expect 409 `lead_not_convertible`). Query `Contact` for `sourceLeadId = <id>`: zero rows.
2. **Goal:** see the in-memory job limit. **Check:** enqueue 25 imports, call `/api/jobs/process-due` once as the platform admin, and count results (expected 20). Then explain why `listDue` still loaded all 25.
3. **Goal:** observe a partial import. **Check:** temporarily add `if (row.firstName === "boom") throw new Error("boom");` inside the row loop (`jobService.ts:78`), submit a CSV whose second data row has `firstName` = `boom`, and process jobs. Afterwards: row 1's contact exists, `AsyncJob.status = FAILED`, `ImportJob.status = RECEIVED`.
4. **Goal:** write the claim-safe job update. **Check:** change step 5 to `updateMany({ where: { id, status: "QUEUED" }, data: {...} })` and skip the job when `count === 0`. Two concurrent `process-due` calls must now produce each job id in only one response.
</content>
