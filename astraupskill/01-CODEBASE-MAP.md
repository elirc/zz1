# Codebase map

`src/services/dealService.ts` owns the move workflow. It opens a Prisma transaction, loads a tenant-scoped deal through `dealRepository.findById`, resolves the requested stage through `pipelineService.requireStage`, checks that stage and deal share a pipeline, derives `OPEN`, `WON`, or `LOST`, and asks `dealRepository.update` to persist the stage and close timestamp. It then creates stage history and an audit event.

`src/repositories/dealRepository.ts` is significant because its update method calls `updateMany` and then `findById`. That pattern can return null when the row disappeared between the initial read and the update, or when the update matched no tenant-scoped row. The service must treat that result as a failed CRUD update. `src/lib/db/tenantContext.ts` supplies the organization scope used by repositories; the staged change does not alter that scope helper.

The lab loads the service, not a copied transition function. It stubs Prisma transaction execution, pipeline resolution, repository calls, audit, while loading the real shared HTTP error constructors. The production error shape is preserved as status and code so the assertion checks the same not-found contract used by routes. It does not claim a real database race was scheduled.

