<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# KUFC Coaching Academy

Next.js 16 PWA for a coaching academy: branches, batches, students, coaches,
attendance, leaves, materials, tests, and invoicing. Admin, coach, and student roles.

## Architecture: there is no backend

Every screen is `"use client"`. The browser talks straight to Firebase Auth,
Firestore, and Storage. There is no API layer, no server-side Firebase Admin, no
`firebase/functions/` directory.

Consequences that surprise people:

- **"Test locally, wire up the database later" does not work here.** Firebase config
  is required on first page load. Put real keys in `.env.local` or nothing functions.
- **There is no server to scale or containerise per-function.** A container is just
  Node serving a bundle; all state lives in Firestore.
- Adding an API route or Cloud Function means introducing a server for the first
  time — it needs its own auth story because the browser SDK tokens are not trusted
  by a server without verification.

## Commands

```bash
npm run dev                 # localhost:3000
npm run build               # Turbopack, no --turbopack flag needed
node --test --experimental-strip-types tests/academy.test.mjs   # pure unit, no emulator
npm run test:rules          # security rules, needs Java 11+ (see below)
```

`npx lint` is removed in Next 16; `npm run lint` runs the ESLint CLI directly.

### Running the rules tests

Java is required by the Firebase emulator and is **not on PATH by default on this
machine**. It lives at `C:\Program Files\Eclipse Adoptium\jdk-11.0.32.101-hotspot`.
Recent `firebase-tools` requires Java 21+, so the pinned 13.35.1 is used instead:

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-11.0.32.101-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
npm run test:rules
```

Test files are `.mjs` with TypeScript types stripped, so **do not add TS type
annotations to them** — `--experimental-strip-types` fails on `.mjs` annotations.
`tests/rules.test.mjs` seeds fixtures through the emulator REST API using the
`owner` token, because `@firebase/rules-unit-testing` at this version exports no
`withSecurityRulesDisabled` helper.

A `PERMISSION_DENIED` line in the output is usually an expected denial from an
`assertFails`, not a test failure. Judge by the pass/fail counts.

## Auth model

`users/{uid}` holds `role` (`admin` | `coach` | `student`) and `status`
(`pending` | `active` | `rejected` | `inactive`). AuthContext live-subscribes to
that doc, so approval and suspension take effect without a re-login.

Self-registration creates `status: "pending"`. Only an admin flips it to `active`.
The `(dashboard)` layout redirects on any non-active status, so an unapproved
account can never see the app shell.

Firestore rules read the role from the same document, so the client and the rules
cannot disagree about who someone is.

## Security rules — read before changing data access

`firebase/firestore.rules` and `firebase/storage.rules` are deny-by-default. Two
invariants worth preserving, because breaking either is a security hole rather
than a bug:

1. **`users` create** pins `role` to `coach`/`student` and `status` to `pending`,
   and forbids `linkedEntityId`. Without that, anyone could self-register as an
   admin or point at another coach's record to inherit their batches.
2. **`users` update** for a non-admin is limited to `displayName` and `phone` via
   `diff().affectedKeys().hasOnly([...])`. Role and status stay admin-only.

Coach scoping goes through `assignedCoach(batchId)`, which compares the caller's
`linkedEntityId` against `batches/{batchId}.coachId`. Client-side filtering in
`batches/page.tsx` is cosmetic; the rules are the real boundary.

Storage upload limits (20MB PDF/image, 100MB video) are duplicated in
`LIMITS` on the materials page and in `sizeOk()` in the storage rules. **Change
both together.**

## Known gaps

- **Student attendance view is blocked by design.** An attendance record holds a map
  of every student in the batch, so granting student reads would expose the whole
  class. Per-student documents are needed before that view can ship.
- **Coach batch filtering is client-side only.** Harmless to the user, but it is not
  a security control. The rules are.
- **Self-registered students are not linked to `students/{studentId}`.** Approval
  sets `users/{uid}.status` but nothing writes `linkedEntityId`, so student-scoped
  rules and the dashboard cannot resolve a self-registered student's batch. Approving
  a registration must also create or link the `students` record.
- **PDF invoices and payment-reminder emails are not built**, despite being in the
  design spec.
- **PWA icons are placeholders** re-using scaffold SVGs.
- **Only one test exists** (`tests/academy.test.mjs`, batch validation). Attendance
  totals, invoice balances, and role guards are untested.