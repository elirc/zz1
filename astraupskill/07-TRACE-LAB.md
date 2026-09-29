# Trace lab

Use this table while reading the actual service.

| Step | State or call | Expected observation |
| --- | --- | --- |
| 1 | `moveDealStage(ctx, d1, new)` enters a transaction | callback receives transaction client |
| 2 | `findById` returns deal in pipeline p1 | stage validation may continue |
| 3 | `requireStage` returns new stage in p1 | pipeline check passes |
| 4 | status is derived from `isClosed` and `isWon` | update payload is prepared |
| 5A | repository update returns null | shared not-found error is thrown |
| 6A | null branch | no history and no audit calls |
| 5B | repository update returns `{id:'d1'}` | dependent writes are reached |
| 6B | history then audit complete | updated deal is returned |

The important branch is after the repository call. The initial read alone cannot guarantee the row remains present, and a successful stage lookup says nothing about the deal update result. The trace makes the data boundary visible: repository return is the service's evidence. The harness can observe calls and return values but cannot observe SQL row counts, lock waits, rollback, or concurrent scheduling. Mark those as unverified in a review note.

