# QueueLess Security Review

**Scope:** this local QueueLess source checkout, including the Expo student app, React/Vite staff dashboard, Firestore rules/indexes, Firebase configuration, and new trusted callable Functions. No production Firebase project or remote repository was changed. This review is not a penetration test or production security certification.

## Pre-change findings

The original repository had no Cloud Functions or Firestore Emulator test suite. The clients directly mutated queue counters, tokens, active-token locks, notifications, and event records. Rules did not enforce those operations as one atomic, authenticated business action. In particular:

- A client could alter queue counters/waiting numbers without creating the corresponding token and active lock.
- A client could create token documents without a validated join flow.
- A student could delete their active-token lock while leaving an active token.
- Event actors were supplied by the client rather than established by trusted code.
- Staff role changes and user-profile writes were not sufficiently restricted; the staff UI also relied on client-side role checks.
- User/profile and operational data access was broader than necessary for student, staff, and administrator roles.
- Profile-loading fallback behavior could let a failed role lookup behave like a student session rather than fail closed.

## Changes made

- Firestore rules now deny all client writes to queues, tokens, active-token locks, queue events, services, and settings. Notification creation/deletion is server-only; an owner can only mark their own notification read. Profile creation is restricted to a matching authenticated email and STUDENT role; a student can update only their own name/student ID. Client role changes are denied.
- Read access is role-scoped: students read their own profile, tokens, locks, and notifications; staff can read student profiles and operational tokens; event logs and admin data management are restricted to administrators. Signed-in clients can read service, queue, and settings documents.
- Added callable Functions that derive actor UID from Firebase Auth, read the role from the protected Firestore profile, validate request fields and state transitions, and write queue/token/lock/event data transactionally. Functions include join/cancel, staff token/queue actions, service/settings management, notifications, role provisioning, and guarded demo seeding.
- Mobile/admin Firebase repositories route privileged writes through Functions. Mobile auth now fails closed if the profile is missing, unreadable, or not a student. Admin screens show privileged settings/service controls only to admins; server checks remain authoritative.
- Added Functions build configuration, Firebase Emulator configuration, the required active-token query index, emulator tests, and ignores for build output/debug logs. Added lockfiles for packages installed and used during validation.
- Added a trusted first-admin bootstrap script using Application Default Credentials. It requires an existing Firebase Auth account and existing profile; it does not embed credentials.
- Moved administrator authorization ahead of Firebase Auth UID lookup in `provisionUserRole`, while retaining a second authorization check in the mutation transaction. Unauthorized callers now receive the same `permission-denied` result for existing and nonexistent target UIDs.
- Queue parsing now rejects negative `currentToken`, `nextToken` below 1, current counters at/above next, and waiting numbers not greater than current. Added malformed-counter emulator cases.
- Demo seeding now requires both the Functions Emulator runtime marker and explicit `QUEUELESS_ALLOW_DEMO_SEED=true`. The emulator test runner sets this flag for local tests; deployed Functions do not receive it and deny seeding.
- Upgraded the root Firebase CLI dev dependency to 15.34.2 to remove the root audit's critical `tar` finding. No broad dependency upgrades were applied.

## Emulator test results

Ran the Auth Emulator, Firestore Emulator, and Functions Emulator with demo project ID `demo-queueless` (Functions TypeScript build runs first).

**Previously completed fallback suite: 10 tests passed, 0 failed.** The suite covers unauthenticated access; student own/cross-user reads and denied writes; valid student profile creation and denied privilege escalation; atomic joins, counter/token/lock/event agreement, forged UID and duplicate requests; malformed counters; notification ownership; owner cancellation and replay rejection; staff authorization and queue transitions; administrator-only service/settings/role operations; admin-only demo seeding with matching locks and refusal to seed over live data; and the production-deny branch of the demo-seeding guard. The release re-run with the pinned CLI did not reach test execution because the host Java runtime is unsupported.

The earlier fallback run used Firebase CLI 14.27.0 and JDK 11. A re-run on 2026-11-01 using the project-pinned Firebase CLI 15.34.2 stopped before emulator startup with: `firebase-tools no longer supports Java version before 21`. This host currently exposes Java 8. On an earlier Java 21 attempt, Firestore Emulator 1.22.0 failed with a Windows selector loopback error (`Unable to establish loopback connection`, `Invalid argument: connect`); IPv4 preference did not resolve it. The pinned CLI 15 + Java 21 path therefore remains unverified on this host.

Environment note: the current Windows Java installation is Java 8; Firebase CLI 15.34.2 requires JDK 21 for the latest Firestore Emulator. The earlier JDK 11 fallback is not suitable for this pinned CLI. The emulator runner also used host Node 24 while `functions/package.json` targets Node 22; use Node 22 for deployment parity and revalidate with the target Firebase CLI/runtime versions.

## Build/check results

- `npm --prefix functions run build` — passed (TypeScript).
- `npm --prefix mobile run typecheck` — passed.
- `npm --prefix admin run build` — passed (TypeScript and Vite production bundle). Vite emitted its standard large-chunk warning for the dashboard bundle.
- `npx tsx shared/queueLogic.test.ts` — passed, all 12 assertions. `tsx` was fetched by `npx` for this command because it is not declared in the project manifests.
- Lint — not available; root, mobile, admin, and Functions packages define no lint script/configuration.
- Current separate npm audits: root 21 (5 high, 16 moderate); Functions 8 (all moderate); mobile 35 (9 high, 25 moderate, 1 low); admin 8 (5 high, 3 moderate). No blanket audit fix or broad framework upgrade was applied. The high findings include Firebase/Firestore client packages across root, mobile, and admin; Expo Router, PostCSS, and image-size in mobile; and Vite in admin. Available automatic fixes require major framework/package changes, so compatibility work remains.

## Remaining risks and rollout requirements

- **Existing data consistency:** the new queue functions require active tokens to have matching active-token locks. Audit and backfill legacy WAITING/CALLED/SERVING records before deploying; do not weaken the transaction checks. Validate all Firestore fields and indexes against a sanitized production backup.
- **Admin bootstrap:** secure the first administrator through a trusted operator workstation/ADC, verify the target account and UID out-of-band, then remove access to that bootstrap path as appropriate. Protect admin accounts with MFA and operational controls.
- **Data visibility:** staff can read student profile fields and queue tokens for dashboard operations. Confirm that fields displayed/stored meet campus privacy and retention requirements; minimize personal data before real use.
- **Functions operations:** Cloud Functions use the Admin SDK and bypass Firestore Rules. Configure production project/region, billing, IAM, logs/alerts, abuse controls, rate limiting/App Check strategy, backups, and incident response. Callable auth alone does not prevent abuse by valid accounts.
- **Function-specific authorization:** admin role provisioning permits an administrator to assign STUDENT, STAFF, or ADMIN to an existing account. Restrict this capability operationally and review role changes in audit events.
- **CLI/JDK emulator validation:** current `firebase-tools` 15.34.2 requires Java 21 for the latest Firestore Emulator. The Java 21 run could not start Firestore on this Windows host due to the selector loopback exception, so validate the pinned CLI/JDK combination in a supported environment before release.
- **Other dependency findings:** root still has 21 audit findings after the CLI upgrade; Functions, mobile, and admin were not upgraded and retain their prior findings. Review fresh per-package audit output and make compatible targeted upgrades.
- **Commit privacy:** the original local commit metadata was replaced with the account’s GitHub noreply identity before publication. The original repository backup remains local and must not be pushed.
- **Client configuration:** Firebase web config values in Expo/Vite clients are public identifiers, not secrets. Keep service-account keys and other credentials server-side and out of Git.
- **Mobile distribution:** store signing, privacy disclosures, app identifiers, and Expo/EAS release configuration remain external setup tasks.
- **No production Firebase deployment:** Firestore rules/indexes/Functions have only been exercised locally in emulators. No production Firebase resources or data have been changed.

## Before deploying

1. Review rules and Functions changes against the actual Firebase project and data model.
2. Back up data and prepare a reviewed migration to make active token/lock records consistent.
3. Configure the first admin securely and confirm administrator/staff account protections.
4. Run the emulator suite after any changes using the Firebase CLI and Node/JDK versions intended for deployment.
5. Review dependency advisories, validate Firebase CLI 15 with JDK 21 in a supported environment, configure operational controls, and deploy rules/indexes and Functions as one coordinated release. Confirm the deployed rules and callable endpoints before enabling Firebase mode in public clients.
