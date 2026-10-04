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
npm test              # all 43 unit tests (no emulator needed)
npm run test:rules          # security rules, needs Java 11+ (see below)
```

`npx lint` is removed in Next 16; `npm run lint` runs the ESLint CLI directly.

### Running the rules tests

Java 21+ is required by the emulator and is **not on PATH by default on this
machine**. It lives at `C:\Program Files\Eclipse Adoptium\jdk-25.0.4.101-hotspot`.

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-25.0.4.101-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
npm run test:rules      # 32 firestore tests
npm run test:storage    # 16 storage tests
```

Both suites seed fixtures through the emulator REST API with the `owner` token,
because `@firebase/rules-unit-testing` v5 exports no `withSecurityRulesDisabled`.

Test files are `.mjs` with TS types stripped, so **do not add TS type annotations
to them** — `--experimental-strip-types` fails on `.mjs` annotations.

Storage tests use `getMetadata` for read checks, not download: `getBytesFromURL`
is not exported in Node. It exercises the same read rule.

A `PERMISSION_DENIED` line in output is usually an expected denial from
`assertFails`, not a failure. Judge by pass/fail counts.

## Auth model

`users/{uid}` holds `role` (`admin` | `coach` | `student`) and `status`
(`pending` | `active` | `rejected` | `inactive`). AuthContext live-subscribes to
that doc, so approval and suspension take effect without a re-login.

Self-registration creates `status: "pending"`. Only an admin flips it to `active`.
The `(dashboard)` layout redirects on any non-active status, so an unapproved
account can never see the app shell.

### Students join by batch code

Each batch gets a generated 6-character `code` (admin can regenerate). A student
enters it at registration; it is stored on `users/{uid}.requestedBatchCode` and is
**untrusted** — the approvals page resolves it against `batches/{id}.code` and
refuses to approve if nothing matches.

On approval the admin creates `students/{uid}` (doc id = the auth uid) and sets
`linkedEntityId = uid`, so `entityId()` in the rules resolves without a second
lookup. The code alphabet omits `0 O 1 I L` because codes get read aloud.

The code is a hint, not a gate. Match, mismatch, and absent all reach the admin,
who picks from active batches in the approvals table. Batches predating the code
field have `code === undefined`, so they never auto-match — expected, not a bug.

Registrants cannot change `requestedBatchCode` after submitting, or a pending
student could redirect their own enrolment.

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

## Student views and the two-shape attendance model

Attendance is stored twice, on purpose, because one shape cannot serve both audiences:

```
attendance/{batchId}/records/{date}                    whole session — admin/coach only
attendance/{batchId}/records/{date}/entries/{studentId} one student's mark — readable by that student
```

The session doc holds every student's mark, so it can never be readable by a student.
The `entries/` doc is what makes `/my-attendance` possible without exposing the class.
The coach writes both in **one `writeBatch`** so they cannot drift apart.

Do not collapse these into one document, and do not drop the per-student write — the
student calendar and the rules that permit it both depend on it.

Student scores work the same way: `testScores/{testId}/scores/{studentId}` is keyed by
student, so a student reads only their own, and only for tests in their own batch.
`useCollection` exposes `doc.ref.path` as `path` because a collection group query
**loses the parent `testId`** — `testIdFromScorePath()` in `src/lib/attendance.ts`
recovers it. Without it every score row looks identical.

## Notifications are derived, not stored

The bell (`src/components/notifications-bell.tsx`) computes fee notices from invoices
at render time via `deriveNotifications()`. Nothing is written to Firestore, so a badge
can never disagree with an invoice, and paying off a balance makes the notice vanish
without a delete step. Dismissals live in `localStorage` — a student clearing a badge on
their own phone does not need a write round-trip.

**This is in-app only: it shows when the app is open.** Real push needs FCM (a service
worker, VAPID keys, and a server to send from) — that is the first thing this app would
genuinely need a backend for. Not built.

## Fee reminders are a WhatsApp deep link, not an API

`buildFeeReminder()` produces the message text and a `wa.me` link. **Nothing is sent
programmatically** — the admin's WhatsApp opens with the text and they tap send. Real
outbound messaging needs the paid WhatsApp Business Platform. The admin's own number is
entered once on the invoices page; with no number stored, the text is still copyable.

## PDF invoices use the browser's print dialog

`InvoicePrint` writes a small HTML document and calls `window.print()`. A PDF library
would be ~200KB and still would not match the app's styling. Output is the browser's
print-to-PDF, so fonts and layout are the browser's, not ours.

## Known gaps

- **Attendance marked before this change has no `entries/` docs**, so those sessions are
  invisible to students. Re-save the date in the coach UI to backfill, or run a one-off
  script over existing `attendance/*/records/*`.
- **No push notifications** (FCM), only in-app — see Notifications above.
- **Coach batch filtering is client-side only.** Harmless to the user, but it is not
  a security control. The rules are.
- **A wrong or missing batch code never blocks approval.** `resolveStudentBatch` in
  `src/lib/student-approval.ts` returns `needs-choice` and the approvals table shows
  a batch picker. Do not "fix" this by rejecting unresolvable codes — a parent
  reading six characters off a screenshot will typo one, and pre-code registrations
  have none. A silent wrong batch is worse than one extra admin click.
- **PDF invoices and payment-reminder emails are not built**, despite being in the
  design spec.
- **PWA icons are placeholders** re-using scaffold SVGs.
- **Only one test exists** (`tests/academy.test.mjs`, batch validation). Attendance
  totals, invoice balances, and role guards are untested.