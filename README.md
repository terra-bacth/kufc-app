# KUFC Coaching Academy

A Next.js 16 app for academy admins, coaches, and students. The app uses Firebase Auth, Firestore, and Storage directly from the browser.

## Try the demo with Docker Compose

No Firebase project or secrets are needed. The Compose stack runs the web app against local Firebase Auth, Firestore, and Storage emulators and loads a small demo dataset.

Requirements: Docker Engine with the Compose plugin.

```bash
docker compose up --build
```

In a second terminal, from the repository root, seed the demo accounts and data:

```bash
npm ci
npm run demo:seed
```

Open:

- App: <http://localhost:3000>
- Firebase Emulator UI: <http://localhost:4000>

Demo accounts (password for all: `DemoPass123!`):

| Role | Email |
| --- | --- |
| Admin | `admin@academy.test` |
| Coach | `coach@academy.test` |
| Student | `student@academy.test` |

The seed command is safe to rerun. It uses the Firebase Emulator's local `owner` token to set up demo profiles and fixtures; it does not contact a production Firebase project. Emulator state persists in a Docker volume. To wipe it and start over:

```bash
docker compose down -v
docker compose up --build
npm run demo:seed
```

To use a different web port, set `WEB_PORT`, for example `WEB_PORT=3100 docker compose up --build`. The browser must be able to reach the Firebase emulator HTTP endpoints on ports 9099, 8080, and 9199. `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST` defaults to `localhost`; it must resolve from the browser, not just inside Docker. The emulator setup is intended for local Docker Compose. Killercoda's HTTPS port proxy does not by itself make these HTTP emulator ports browser-accessible; use a local Docker host or a real Firebase project for remote preview. Killercoda's Next.js dev origin is allowlisted for HMR, but that does not proxy Firebase traffic.

## Use a real Firebase project

Copy `.env.example` to `.env.local`, fill in the Firebase web-app config values, then run:

```bash
npm ci
npm run dev
```

Do not set `NEXT_PUBLIC_FIREBASE_USE_EMULATORS=true` when using a real project. Apply Firestore rules and indexes with the Firebase CLI as appropriate for that project.

## Tests

Pure unit tests do not need Firebase or Docker:

```bash
npm test
```

Firestore and Storage security-rule tests use the Firebase emulators:

```bash
npm run test:rules
npm run test:storage
```

## Notes

- Attendance is stored both as a whole session (`attendance/{batchId}/records/{date}`) and as student-readable per-student entries below `entries/{studentId}`.
- Notifications are derived in-app; there is no push notification backend.
- `firebase/firestore.rules` and `firebase/storage.rules` are deny-by-default. Keep authorization enforcement there, not just in client-side filtering.
