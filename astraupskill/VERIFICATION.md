# Verification

Executed command:

```text
node --experimental-vm-modules --test tests/deal-stage-update-result.test.mjs
```

The run passed four tests. The first loads the actual `src/services/dealService.ts`, makes the repository update return null, and verifies the shared not-found shape while history and audit remain untouched. The second returns an updated deal and verifies that stage history and audit continue in the normal path. The loader and test are under [tests/helpers/load-typescript.mjs](../tests/helpers/load-typescript.mjs) and [tests/deal-stage-update-result.test.mjs](../tests/deal-stage-update-result.test.mjs).

The check uses explicit transaction, repository, pipeline, and audit doubles. It does not execute Prisma, Next routes, native Vitest, or a real concurrent delete. It therefore supports the precise claim that the service responds safely to a null repository result and preserves the ordinary path. The original service source is preserved at [snapshots/src/services/dealService.ts](snapshots/src/services/dealService.ts). A future integration test should run the real repository against the supported database and verify the update-many/reread contract under tenant scope and contention.

The handoff manifest points to the staged evidence and the campaign-relative results path; root may capture a terminal check independently before delivery. Reviewers should retain the distinction between a null reread and a provider exception.

Additional runtime coverage refuses a foreign-pipeline stage and checks WON status, close timestamp, exact history payload, and shared transaction/context arguments. Persistence remains adapted; these are service contract assertions.

## Astra execution evidence

The captured focused production-source suite executed 4 tests: all passed, zero failed and zero skipped. Read the [captured output](evidence/crud-b07-astra-runtime.log) and [exact command and limits](evidence/results.json). Earlier check records remain preserved in the workspace.
