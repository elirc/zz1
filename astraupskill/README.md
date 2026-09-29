# zz1 deal transition integrity

This course follows a race-shaped CRUD boundary in the CRM deal service. `dealRepository.update` uses a tenant-scoped `updateMany` and then rereads the deal. A concurrent delete or scope mismatch can therefore produce `null`. Before this staged change, `moveDealStage` immediately wrote stage history and audit data and returned the null value, leaving an apparently successful workflow with no updated deal. The change checks the reread result and raises the existing not-found error before history or audit.

The real service is [dealService.ts](../src/services/dealService.ts); its exact original bytes are in [snapshots/src/services/dealService.ts](snapshots/src/services/dealService.ts). The executable lab is [deal-stage-update-result.test.mjs](../tests/deal-stage-update-result.test.mjs). It loads the production service and uses injected repository, pipeline, transaction, and audit doubles. It runs both the disappearing-row path and the normal update path. The evidence demonstrates control flow and side-effect ordering, while leaving provider isolation and concurrent scheduling for an integration test.

Read the chapters as a progression: map the transaction boundary, reason about reread semantics, inspect the before/after guard, then debug the VM harness. Practice asks you to distinguish a missing row from a rejected transition. Solutions identify which claims are proven and which remain hypotheses.

