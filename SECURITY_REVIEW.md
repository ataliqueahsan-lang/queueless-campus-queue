# Queue ownership review — staging copy

This review applies only to this extracted staging copy. The original ZIP and any other copy were not changed.

## Change made

Student queue cancellation now records the cancelled token number in the same transaction that removes it from `waitingNumbers` and marks its token `CANCELLED`. Firestore rules require that number to be present in the prior queue, require the new list to equal the prior list with only that number removed, and check the token belongs to the signed-in user and changes from `WAITING` to `CANCELLED` using `getAfter()`. Other students cannot use this student update path to remove a queue entry they do not own. Staff operations remain on their existing staff-only path.

## Verification

- The existing pure queue-logic test ran successfully: 12 assertions passed.
- Firestore Rules Emulator tests were not run. Firebase CLI/emulator tooling is not installed in this environment.
- This check does not validate the mobile/admin builds, the Firebase deployment configuration, or all collection rules.

## Required before publication

Run Firestore Rules Emulator tests that prove: an owner can cancel their own waiting token; another student cannot cancel it; a client cannot remove a different number while presenting an owned token; and authorized staff queue transitions still work. Keep this project blocked from public publication until those tests pass and the complete rules set is reviewed.
