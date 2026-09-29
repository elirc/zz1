# Practice

Begin with prediction. Given an existing deal and a valid same-pipeline stage, list the calls in order: initial read, stage lookup, update, history, audit. Then change only the update result to null and predict the last permitted call. The answer should stop before history and audit and should expose a 404-style domain error.

Intermediate exercise: make `findById` return a deal on the first call and make the repository's update return null. Explain why this simulates a disappearing row at the service boundary even though it does not run SQL. Add a call counter for history and audit. Do not assert that the original deal was physically deleted; that fact is outside the double.

Advanced exercise: model an update result with a new stage but a stale title and decide whether the service should trust it. Read the repository implementation and propose a stronger repository-level contract or a second reread. Your answer must discuss extra query cost and the transaction snapshot. A final review exercise asks whether a null result should be 404 or 409 when the cause is a concurrent change. Tie the answer to the user-visible CRUD API rather than provider error text.

