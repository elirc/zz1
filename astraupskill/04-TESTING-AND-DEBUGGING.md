# Testing and debugging

The first useful test is a null update result, not a mocked database exception. The repository contract is a promise that it returns the updated row or null after its update-and-reread sequence. A test that only checks `updateMany` count would miss the service bug because the service never sees that count. The lab therefore uses the exact `dealRepository.update` call shape and returns null.

The test loader executes TypeScript in a VM. It provides the real service source, the real domain errors with status and code fields, and a transaction wrapper that invokes the callback. Imports used only as types are replaced with structural modules so the harness remains dependency-free. A Windows-specific failure occurred when deriving the root from URL pathname; `fileURLToPath` now supplies a portable root. This detail is part of making a teaching test reproducible.

For debugging, set breakpoints conceptually at initial read, stage resolution, update, guard, history, and audit. The failing trace should stop at the guard. If a refactor moves history above it, the test's "should not write" doubles fail. If the repository returns an object whose fields are stale, this test passes; that is a remaining repository contract question requiring real provider verification.

