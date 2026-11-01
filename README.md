# QueueLess — Campus Queue Management System

QueueLess is a campus queue management prototype with an Expo student app and a React web dashboard for staff. Students can view services, join and cancel queues, and follow their tokens. Staff can call and serve tokens and monitor queue activity. Firebase mode uses Authentication, Cloud Firestore, and trusted callable Cloud Functions; both clients also include separate local demo repositories.

> **Security status:** Queue mutations and privileged writes are handled by callable Functions and are covered by local Auth, Firestore Rules, and Functions Emulator tests. Production use still requires Firebase project setup, first-admin provisioning, deployment review, and migration of any existing active tokens to consistent lock records. See [SECURITY_REVIEW.md](SECURITY_REVIEW.md).

## Features

- Student mobile app for registration/sign-in, service listings, queue joining/cancellation, token position, history, profile settings, and in-app notifications.
- Staff dashboard for queue operations, service management, student listing, daily analytics, crowd thresholds, and demo data.
- Firebase Authentication and Firestore for shared account and queue data, with live Firestore listeners.
- Callable server functions for queue joins/cancellations, staff queue operations, notifications, service/settings management, role provisioning, and protected demo initialization.
- Local demo repositories for each client; demo data is in-memory and the clients' demo stores are independent.

Push notifications while the app is closed, campus SSO, predictive estimates, and multi-campus support are not implemented.

## Technologies

- Mobile: Expo SDK 54, Expo Router, React Native 0.81, React 19, TypeScript
- Admin dashboard: React 18, Vite 5, TypeScript, React Router
- Backend: Firebase Authentication, Cloud Firestore, Firebase Admin SDK, Cloud Functions for Firebase (Node.js 22)
- Security tests: Firebase Emulator Suite and `@firebase/rules-unit-testing`

## Architecture

The mobile and admin clients authenticate with Firebase Auth. Firestore rules allow scoped reads and limited profile/notification updates; clients cannot directly write queue counters, tokens, active-token locks, service configuration, settings, or audit events. Sensitive actions call authenticated Cloud Functions. Each function derives the actor UID from verified Firebase Auth, reads the caller's role from the protected user profile, and uses Firestore transactions to keep related queue/token/lock/event writes together.

```text
Expo student app ──────┐
                       ├── Firebase Auth + scoped Firestore reads
React/Vite dashboard ──┘          │
                                  └── Callable Cloud Functions
                                      └── transactional queue and admin writes

Local demo mode: separate in-memory repositories in each client
```

## Requirements

- Node.js 22 for deployed Cloud Functions (the local emulator may use another supported local Node runtime).
- npm.
- Java 21 or later for the pinned Firebase CLI 15 Emulator Suite.
- Expo Go or an Android/iOS development environment for device preview; native release builds need platform signing and store setup.
- Firebase CLI for emulator and Firebase deployment commands.

## Install

From the project root, install the root test tools and each package using the included lockfiles:

```bash
npm ci
npm --prefix functions ci
npm --prefix mobile ci
npm --prefix admin ci
```

## Configure Firebase

1. Create a Firebase project, enable Email/Password Authentication, and create Cloud Firestore.
2. Copy `mobile/.env.example` to `mobile/.env` and `admin/.env.example` to `admin/.env`.
3. Fill each file with that app's Firebase web configuration from the Firebase console. Set `EXPO_PUBLIC_DEMO_MODE=false` and `VITE_DEMO_MODE=false` to use Firebase; set either to `true` for that client's local demo mode.
4. Never commit `.env` files, service-account credentials, private keys, or user data. Client Firebase web configuration is bundled by design; enforce access with Firebase rules and Firebase project restrictions.
5. Create initial Auth accounts and student profiles through the app. Bootstrap the first administrator from a trusted environment with Application Default Credentials and an existing Auth UID:

```bash
cd functions
npm run bootstrap-admin -- <firebase-project-id> <existing-auth-uid>
```

Then administrators can provision STAFF or ADMIN roles from the trusted callable function. Do not assign privileged roles from a client or expose an Admin SDK credential in either app.

Before using these Functions with existing Firestore data, audit active WAITING/CALLED/SERVING tokens and ensure each has a matching `activeTokens/{uid}_{serviceId}` lock with the correct `tokenId`. The transactional functions deliberately reject inconsistent records; plan and review a migration rather than weakening those checks.

## Run locally

### Student app

```bash
cd mobile
npm run start
```

Use the Expo CLI options for web, Android, or iOS. With demo mode enabled (or Firebase keys absent), the app uses its local sample repository.

### Staff dashboard

```bash
cd admin
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Set `VITE_DEMO_MODE=true` in `admin/.env` to use the dashboard's local sample repository.

### Firebase Emulator tests

Install and authenticate the Firebase CLI if needed, then from the project root:

```bash
npm run test:emulators
```

The command builds Functions and runs Auth, Firestore Rules, and callable Function tests against demo project ID `demo-queueless`. Emulator tests use only local fake accounts and data. A successful local test run is not a production deployment or a complete security certification.

The test runner explicitly enables demo seeding only for the local Functions Emulator. Deployed Functions deny demo seeding. The mobile and admin apps are not wired to connect to the Emulator Suite; when configured for Firebase, they call the configured Firebase project and expect deployed Functions.

## Checks and production build

```bash
npm run build:functions
npm --prefix mobile run typecheck
npm --prefix admin run build
```

The admin build runs TypeScript project checks and creates the Vite production bundle. The mobile package defines a TypeScript check but no lint or production-build script. The repository currently has no lint command.

To build a mobile app for distribution, configure Expo/EAS and platform identifiers/signing separately. To deploy Firebase rules, indexes, and Functions after reviewing the target project and migration plan, use the Firebase CLI with the intended project selected. Demo seeding is disabled in deployed Functions. Do not deploy the current Functions to production before applying and validating the rules and data migration together.

## Project structure

```text
admin/                      React + Vite staff dashboard
mobile/                     Expo / React Native student app
shared/                     Shared queue types and pure queue logic
firebase/firestore.rules    Least-privilege Firestore client rules
firebase/firestore.indexes.json
functions/src/              Trusted callable queue/admin operations
functions/scripts/          First-admin bootstrap utility
tests/                      Auth, Firestore Rules, and Functions Emulator tests
firebase.json               Functions, Firestore, and Emulator Suite configuration
SECURITY_REVIEW.md          Security findings, mitigations, and remaining risks
```

## Privacy and security

- No secrets belong in source control. `.gitignore` excludes local environment files, keys, service-account JSON, dependencies, caches, logs, and build output.
- Staff and admin access is controlled by role records protected from client modification; privileged callables re-check roles on the server.
- Students can read their own tokens/profile/notifications; staff can read operational token and student data needed by the dashboard; only admins can read event logs and manage services/settings/roles.
- Firestore Admin SDK access bypasses Firestore Rules. Protect deployed Functions with strict authorization, validate configuration, monitor abuse, and keep administrative credentials server-side.
- Review data minimization, retention, backups, rate limits/App Check, and campus privacy requirements before real deployment.

## Known limitations

- Demo repositories are in-memory, reset on restart, and do not synchronize across the mobile and web clients.
- Push notifications while the app is closed are not implemented; current notifications are in-app Firestore records.
- Queue time estimates use configured service time and queue position.
- Existing Firebase data needs an integrity audit and possible active-lock migration before the new transactional Functions can safely operate on it.
- Production Firebase resources have not been deployed or verified as part of this work. See [SECURITY_REVIEW.md](SECURITY_REVIEW.md) for the audit, tests, and rollout requirements.
