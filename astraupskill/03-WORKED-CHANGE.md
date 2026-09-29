# Worked change

Before, the service called `dealRepository.update` and immediately created history and audit. If the repository reread returned null, history still ran and the method returned null. The staged after version adds a postcondition guard:

```ts
const updated = await dealRepository.update(ctx, tx, dealId, { stageId: nextStage.id, status, closedAt });
if (!updated) {
  throw notFoundError("deal_not_found", "The deal disappeared before the stage update completed.");
}
await dealRepository.createStageHistory(ctx, tx, { dealId, fromStageId: deal.stageId, toStageId: nextStage.id, changedByMembershipId: ctx.membership.membershipId, note: input.note });
```

The test configures the actual service's injected repository to return null, then asserts the error has status 404 and code `deal_not_found`; history and audit are configured to throw if called, making accidental continuation visible. A second test returns a deal and verifies both dependent writes occur. This is a narrow postcondition check. It does not assert that `updateMany` itself changed one row, because the repository is the I/O boundary under test.

