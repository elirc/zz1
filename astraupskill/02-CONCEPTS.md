# Concepts: reread after conditional update

A successful update operation has two questions: did the database accept the write, and what row should the caller receive? This repository answers both through `updateMany` followed by a scoped reread. A null reread is meaningful even when no provider exception was thrown. Treating it as a success leaks an ambiguous result to the route and allows dependent writes to describe a state that does not exist.

The staged guard uses the existing `notFoundError` helper with code `deal_not_found`. It is placed immediately after `dealRepository.update`, before `createStageHistory` and `auditService.logOrgEvent`. That ordering gives the workflow a clear invariant: history and audit are only attempted after a non-null updated deal is observed. The guard does not add a transaction or solve concurrent writes by itself; it makes the current repository contract explicit.

Tenant scope remains a separate concept. `findById` and `update` both receive the request context, and the repository adds `organizationId`. A missing result could mean deletion, wrong tenant, or a stale identifier. All three should become the same safe not-found response at this service boundary. Provider-specific error messages are not required, and no text parsing was added.

