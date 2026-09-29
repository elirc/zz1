# Flow Traces

## Flow: Demo login to create a session
1. `src/components/crm/demo-login-card.tsx` — form submit calls the mutation created in the component
2. `src/lib/http/client.ts` — `apiFetch()` sends `POST /api/auth/demo-login`
3. `src/app/api/auth/demo-login/route.ts` — `POST()` parses the body with `demoLoginSchema`
4. `src/lib/validation/authSchemas.ts` — `demoLoginSchema.parse()`
5. `src/services/authService.ts` — `demoLogin()` loads the user and active membership
6. `src/lib/auth/session.ts` — `setSessionCookie()` signs and stores `atlas_session`
7. `src/repositories/userRepository.ts` — `updateLastLogin()`
8. Returns session bootstrap info to the client

## Flow: Sales rep creates a lead from the workspace form
1. `src/components/crm/lead-intake-form.tsx` — submit handler calls `useCreateLead()`
2. `src/hooks/useLeads.ts` — mutation sends `POST /api/leads`
3. `src/lib/http/client.ts` — `apiFetch()`
4. `src/app/api/leads/route.ts` — `POST()`
5. `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()`
6. `src/lib/auth/session.ts` — `getOptionalSession()`
7. `src/lib/middleware/withTenantGuard.ts` — `requireOrgRequest()`
8. `src/lib/permissions/policy.ts` — `assertOrgPermission()`
9. `src/lib/validation/leadSchemas.ts` — `createLeadSchema.parse()`
10. `src/services/leadService.ts` — `createLead()`
11. `src/lib/permissions/assignment.ts` — `resolveAssignableMembership()`
12. `src/repositories/membershipRepository.ts` — `findById()`
13. `src/services/pipelineService.ts` — `requireDefaultPipeline()` or `requireStage()`
14. `src/repositories/pipelineRepository.ts` — `findDefault()` or `findStage()`
15. `src/repositories/leadRepository.ts` — `create()`
16. `src/repositories/leadRepository.ts` — `createStatusHistory()`
17. `src/repositories/assignmentHistoryRepository.ts` — `create()`
18. `src/services/auditService.ts` — `logOrgEvent()`
19. `src/repositories/auditRepository.ts` — `create()`
20. Returns `201` and React Query invalidates `["leads"]` and `["dashboard"]`

## Flow: Converting a lead to a contact
1. `src/hooks/useLeads.ts` — `useLeadConvert()` fires `POST /api/leads/:id/convert`
2. `src/lib/http/client.ts` — `apiFetch()`
3. `src/app/api/leads/[id]/convert/route.ts` — `POST()`
4. `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()`
5. `src/lib/middleware/withTenantGuard.ts` — `requireOrgRequest()`
6. `src/lib/validation/leadSchemas.ts` — `convertLeadSchema.parse()`
7. `src/services/leadService.ts` — `convertLead()`
8. `src/repositories/leadRepository.ts` — `findById()`
9. `src/repositories/contactRepository.ts` — `create()`
10. `src/repositories/leadRepository.ts` — `update()`
11. `src/repositories/leadRepository.ts` — `createStatusHistory()`
12. `src/services/dealService.ts` — `createDealInTransaction()` when `createDeal` is true
13. `src/repositories/dealRepository.ts` — `create()`
14. `src/services/auditService.ts` — `logOrgEvent()`
15. Returns updated lead, created contact, and optional deal

## Flow: Sales rep attempts admin-only invitation and is rejected
1. `src/app/api/org/invitations/route.ts` — `POST()`
2. `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()`
3. `src/lib/auth/session.ts` — `getOptionalSession()`
4. `src/lib/middleware/withTenantGuard.ts` — `requireOrgRequest()`
5. `src/lib/permissions/policy.ts` — `assertOrgPermission()`
6. `src/lib/http/errors.ts` — `forbiddenError()`
7. `src/lib/http/responses.ts` — `route()` converts the thrown `AppError` into `403`
8. The request never reaches `src/lib/validation/orgSchemas.ts` or `src/services/organizationService.ts`

## Flow: Deal stage transition
1. `src/app/api/deals/[id]/stage/route.ts` — `POST()`
2. `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()`
3. `src/lib/middleware/withTenantGuard.ts` — `requireOrgRequest()`
4. `src/lib/validation/dealSchemas.ts` — `moveDealStageSchema.parse()`
5. `src/services/dealService.ts` — `moveDealStage()`
6. `src/repositories/dealRepository.ts` — `findById()`
7. `src/services/pipelineService.ts` — `requireStage()`
8. `src/repositories/pipelineRepository.ts` — `findStage()`
9. `src/repositories/dealRepository.ts` — `update()`
10. `src/repositories/dealRepository.ts` — `createStageHistory()`
11. `src/services/auditService.ts` — `logOrgEvent()`
12. Returns the updated deal

## Flow: Export request becomes async work
1. `src/app/api/exports/route.ts` — `POST()`
2. `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()`
3. `src/lib/middleware/withTenantGuard.ts` — `requireOrgRequest()`
4. `src/lib/validation/exportSchemas.ts` — `requestExportSchema.parse()`
5. `src/services/exportService.ts` — `requestExport()`
6. `src/repositories/savedViewRepository.ts` — `findById()` if a saved view was referenced
7. `src/repositories/exportJobRepository.ts` — `create()`
8. `src/repositories/asyncJobRepository.ts` — `create()`
9. `src/services/auditService.ts` — `logOrgEvent()`
10. Returns the queued `ExportJob`

## Flow: Processing queued jobs
1. `src/app/api/jobs/process-due/route.ts` — `POST()`
2. `src/lib/middleware/withAuth.ts` — `requirePlatformAdminRequest()`
3. `src/services/jobService.ts` — `processDueJobs()`
4. `src/repositories/asyncJobRepository.ts` — `listDue()`
5. `src/repositories/asyncJobRepository.ts` — `update()` moves each job to `RUNNING`
6. For export jobs: `src/repositories/exportJobRepository.ts` — `update()` marks the export complete with file metadata
7. For CSV import jobs: `papaparse` parses text, then `src/repositories/contactRepository.ts` — `create()` inserts contacts
8. `src/repositories/asyncJobRepository.ts` — `update()` marks the job `SUCCEEDED` or `FAILED`
9. Returns a summary of processed jobs

## Flow: Contact CSV import request
1. `src/app/api/imports/contacts/route.ts` — `POST()`
2. `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()`
3. `src/lib/middleware/withTenantGuard.ts` — `requireOrgRequest()`
4. `src/lib/validation/exportSchemas.ts` — `createContactImportSchema.parse()`
5. `src/services/importService.ts` — `requestContactImport()`
6. `src/repositories/importJobRepository.ts` — `create()`
7. `src/repositories/asyncJobRepository.ts` — `create()`
8. `src/services/auditService.ts` — `logOrgEvent()`
9. Returns the queued import job
