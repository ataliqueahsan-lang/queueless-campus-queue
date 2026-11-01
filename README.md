# QueueLess

QueueLess is a campus queue management prototype with a student mobile app and a staff web dashboard. Students can join a service queue and follow their token; staff can manage services and queue activity. Both clients can use Firebase Authentication and Cloud Firestore for shared, real-time data, or use local demo data.

> **Release status:** This repository is a prototype. Review `SECURITY_REVIEW.md` before connecting a public client to a live Firebase project. Firestore Rules Emulator coverage and a complete rules review are still required. The in-memory demo stores are not persistent or shared between the mobile app and dashboard.

## Features

- Expo / React Native student app with registration, sign-in, service listings, digital tokens, queue position, history, profile settings, and in-app notifications.
- React / Vite staff dashboard with sign-in, queue controls, service management, student listing, daily analytics, crowd thresholds, and demo-data loading.
- Firebase Authentication and Cloud Firestore repositories, with Firestore listeners for live updates when configured.
- Demo repositories for trying each client without a Firebase project.
- Shared queue logic and a standalone assertion-based queue logic script.

Push notifications while the app is closed, campus single sign-on, predictive queue estimates, and multi-campus support are not implemented.

## Technology

- Mobile: Expo SDK 54, Expo Router, React Native 0.81, React 19, TypeScript
- Admin: React 18, Vite 5, TypeScript, React Router
- Data and authentication: Firebase Authentication, Cloud Firestore, Firebase client SDK
- Shared logic: TypeScript

## Architecture

The mobile app and admin dashboard each use a repository interface. A Firebase-backed repository connects to the same Auth and Firestore project; a mock repository provides local in-memory demo data. Firestore rules are included in `firebase/firestore.rules`, and indexes are in `firebase/firestore.indexes.json`. Client-side role checks improve navigation, while Firestore rules are intended to enforce data access.

```text
mobile (Expo) ───────┐
                     ├── Firebase Auth + Cloud Firestore
admin (React/Vite) ──┘         (or separate local demo stores)
```

## Requirements

- Node.js compatible with Expo SDK 54 and npm
- Expo Go for device preview, or an Android/iOS development environment for native builds
- A Firebase project only for shared, persistent mode
- Firebase CLI only if deploying Firestore rules/indexes from the command line

There is no root `package.json`; install and run each client from its own directory.

## Install and run

### Student app (demo mode)

```bash
cd mobile
npm install
npx expo install --fix
npx expo start
```

Scan the QR code with Expo Go, or use the Expo CLI shortcuts for web/Android/iOS. Demo mode uses sample data in memory. The demo sign-in accepts the demo account shown in the sign-in screen and any password; it is not real authentication.

### Staff dashboard (demo mode)

```bash
cd admin
npm install
```

Set `VITE_DEMO_MODE=true` in a local `admin/.env` file, then run:

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The mobile and admin demo stores are independent and do not synchronize.

## Firebase setup

1. Create a Firebase project, enable Email/Password in Authentication, and create a Cloud Firestore database.
2. Copy `mobile/.env.example` to `mobile/.env` and `admin/.env.example` to `admin/.env`.
3. Fill in the Firebase web app configuration in each local file. Use `EXPO_PUBLIC_...` names for the mobile app and `VITE_...` names for the dashboard. Set the corresponding `..._DEMO_MODE=false`.
4. Create staff accounts through Firebase Authentication and assign a `STAFF` or `ADMIN` role to their `users/{uid}` profile using a trusted administrative process.
5. Review the rules and indexes. Do not connect a public client to a live database until the outstanding security review and rules tests described in `SECURITY_REVIEW.md` are complete.

Firebase client configuration values are embedded in client bundles and must be protected by restrictive Firestore rules and Firebase service configuration. Never commit `.env` files, service-account credentials, private keys, or user data. Do not grant staff roles from untrusted clients.

To deploy rules and indexes after they have been reviewed and tested, install/authenticate Firebase CLI and run from the repository root:

```bash
firebase login
firebase use --add
firebase deploy --only firestore
```

## Checks

The packages expose these commands:

```bash
# Mobile TypeScript check
cd mobile
npm run typecheck

# Admin typecheck and production bundle
cd admin
npm run build

# Shared queue logic assertions (requires tsx available through npx)
cd shared
npx tsx queueLogic.test.ts
```

The project does not define a root-level test or lint script. Firestore Rules Emulator tests are a separate required release check and have not been run (see `SECURITY_REVIEW.md`).

## Project structure

```text
.
├── admin/                 React/Vite staff dashboard
├── firebase/              Firestore rules and indexes
├── mobile/                Expo student application
├── shared/                Shared queue logic, types, and assertion script
├── firebase.json          Firebase CLI configuration
├── SECURITY_REVIEW.md     Review scope and outstanding release checks
└── sync-shared.sh         Shared-source synchronization helper
```

## Known limitations

- Demo data is in-memory, resets when a client restarts, and is not shared between the two apps.
- In-app alerts are generated while the student app is open; remote push notifications are not implemented.
- Queue wait times are estimates based on configured service time.
- The current Firestore rules have not completed Emulator testing or full review; see `SECURITY_REVIEW.md`. Do not treat the current Firebase configuration as production-ready.
- Production operation needs trusted staff provisioning, reviewed rules, tested multi-client queue transactions, monitoring, backups, and abuse controls.
- Mobile store distribution requires app identifiers, signing credentials, store accounts, and release builds (for example, using EAS Build). These are not included here.

## Safe production direction

Use Firebase Authentication for student and staff identity, Firestore for durable queue state, and trusted server-side code (such as callable Cloud Functions) for sensitive queue mutations, role provisioning, and audit events. Keep staff authorization enforced by server-side claims or protected role records plus Firestore rules. Test owner/staff/unauthenticated and adversarial cases with the Firestore Rules Emulator before deployment. Keep Firebase Admin credentials only in the server environment; never in either client app.
