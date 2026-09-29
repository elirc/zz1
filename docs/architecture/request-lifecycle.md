# Request Lifecycle

Request: Sales rep creates a lead
1. `src/app/api/leads/route.ts` — receives `POST`, parses JSON, and starts the guarded flow
2. `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()` loads the signed session into `RequestContext`
3. `src/lib/middleware/withTenantGuard.ts` — `requireOrgRequest()` confirms active membership and `leads.write`
4. `src/lib/validation/leadSchemas.ts` — `createLeadSchema.parse()` validates the request body
5. `src/services/leadService.ts` — `createLead()` resolves owner assignment, pipeline/stage, and audit/history writes
6. `src/lib/permissions/assignment.ts` — `resolveAssignableMembership()` prevents unauthorized reassignment
7. `src/services/pipelineService.ts` — `requireDefaultPipeline()` or `requireStage()` validates tenant pipeline config
8. `src/repositories/leadRepository.ts` — `create()` inserts the lead with `organizationId`
9. `src/repositories/leadRepository.ts` — `createStatusHistory()` writes the initial lead status history row
10. `src/repositories/assignmentHistoryRepository.ts` — `create()` records initial ownership
11. `src/services/auditService.ts` — `logOrgEvent()` persists `lead.created`
12. Returns `201` with the created lead payload via `src/lib/http/responses.ts`

Request: Sales rep converts a lead to a contact
1. `src/app/api/leads/[id]/convert/route.ts` — receives `POST` for the lead conversion endpoint
2. `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()` loads user and active membership
3. `src/lib/middleware/withTenantGuard.ts` — `requireOrgRequest()` confirms active membership and `leads.convert`
4. `src/lib/validation/leadSchemas.ts` — `convertLeadSchema.parse()` validates the conversion payload
5. `src/services/leadService.ts` — `convertLead()` loads the lead and checks convertibility
6. `src/repositories/leadRepository.ts` — `findById()` fetches the lead plus `convertedContact`, activities, and history
7. `src/repositories/contactRepository.ts` — `create()` inserts the converted contact scoped to `organizationId`
8. `src/repositories/leadRepository.ts` — `update()` moves the lead to `CONVERTED`
9. `src/repositories/leadRepository.ts` — `createStatusHistory()` records the conversion state transition
10. `src/services/dealService.ts` — `createDealInTransaction()` optionally creates a deal from the converted lead
11. `src/services/auditService.ts` — `logOrgEvent()` persists `lead.converted`
12. Returns `200` with the converted lead, new contact, and optional deal

Request: Sales Rep attempts an admin-only invitation action and is rejected
1. `src/app/api/org/invitations/route.ts` — receives `POST` for invitation creation
2. `src/lib/middleware/withAuth.ts` — `requireAuthenticatedRequest()` loads session and active membership
3. `src/lib/middleware/withTenantGuard.ts` — `requireOrgRequest()` confirms active membership, then asks for `org.users.write`
4. `src/lib/permissions/policy.ts` — `assertOrgPermission()` rejects `SALES_REP` for `org.users.write`
5. `src/lib/http/responses.ts` — `route()` catches the `AppError` and returns `403`
6. The request never reaches `src/lib/validation/orgSchemas.ts` or `src/services/organizationService.ts`, which is the correct rejection path
