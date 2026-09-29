# Solutions and review

The starter prediction permits history and audit only when update returns a non-null deal. The null branch is a safe not-found result because the service cannot prove that the requested row still belongs to the tenant. A call counter should remain zero for both dependent writes. The successful branch should return the updated object and produce one history record and one audit event.

For the first advanced exercise, a repository returning a stale object is a separate defect: the current service guard proves existence, not freshness. A provider-backed test should verify the update-and-reread behavior and decide whether the transaction isolation level is sufficient. Adding another reread in the service would duplicate repository responsibility and increase latency, so it needs evidence.

Reviewers should score four points: the guard uses the shared error contract; it sits directly after the repository result; failure skips history and audit; and the success path remains unchanged. They should also check that the message does not claim a specific database race was observed. The VM evidence supports service ordering, not provider concurrency. Any proposal to catch arbitrary database exceptions and label them not-found should be rejected because it would misclassify outages and unrelated uniqueness errors.

