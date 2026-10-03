# Coaching Academy App — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Next.js 14 PWA with Firebase Auth (email/password, role-based), a responsive sidebar layout, all TypeScript types, and reusable Firestore hooks — the foundation every feature depends on.

**Architecture:** Next.js App Router with route groups: `(auth)` for login/register, `(dashboard)` for the authenticated app shell with role-aware sidebar. Firebase Auth with custom claims for role enforcement. AuthContext provides `user`, `role`, `loading` to the whole app. Middleware redirects unauthenticated users.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, shadcn/ui, Firebase (Auth + Firestore + Storage), Cloud Functions

**Spec:** `docs/superpowers/specs/2026-10-03-coaching-academy-app-design.md`

## Global Constraints

- Node 18+, Next.js 14+ App Router (not Pages Router)
- TypeScript strict mode
- Tailwind CSS 3+ with shadcn/ui components (install via `npx shadcn@latest`)
- Firebase JS SDK v10+ (modular API, tree-shakeable imports)
- All Firebase config via `.env.local` (never committed)
- Mobile-first responsive: all touch targets ≥ 44px
- No Redux, no Zustand — React Context + Firebase listeners only

## Review Focus

1. **Unauthenticated access to dashboard routes** — middleware must redirect to `/login`; a user who clears cookies and navigates to `/` should see the login page.
2. **Pending user accessing dashboard** — a user with `status: "pending"` must be redirected to `/pending-approval`, never see the sidebar.
3. **Role mismatch on restricted routes** — a coach navigating to `/branches` (admin-only) must be redirected to `/`.
4. **Firebase config leak** — `.env.local` must be in `.gitignore`; no Firebase key should appear in committed files.
5. **Auth state flash** — on page load, the app must show a loading spinner while Firebase Auth initializes, not flash the login page then redirect.

---

### Task 1: Project Scaffold + Dependencies

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.env.local`, `.env.example`, `.gitignore`

**Interfaces:**
- Produces: A runnable Next.js dev server at `localhost:3000`

- [ ] **Step 1: Scaffold Next.js project**

Run:
```bash
npx create-next-app@latest "KUFC app" --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

- [ ] **Step 2: Install Firebase + shadcn/ui + Recharts**

```bash
npm install firebase recharts
npx shadcn@latest init
```
Choose: New York style, Zinc base color, CSS variables = yes.

- [ ] **Step 3: Install shadcn/ui components needed for foundation**

```bash
npx shadcn@latest add button card input label select separator sheet avatar dropdown-menu badge toast dialog form table tabs
```

- [ ] **Step 4: Create `.env.local` and `.env.example`**

`.env.example` with placeholder values (committed):
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```
`.env.local` with real values (gitignored).

- [ ] **Step 5: Verify `.gitignore` includes `.env.local`**

Check existing `.gitignore` from create-next-app; add `.env.local` if missing.

- [ ] **Step 6: Verify dev server starts**

Run: `npm run dev`
Expected: Next.js dev server running at `http://localhost:3000`

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project with Firebase, shadcn/ui, Recharts"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/lib/types/index.ts`

**Interfaces:**
- Produces: All entity interfaces — `User`, `Branch`, `Batch`, `Student`, `Coach`, `AttendanceRecord`, `Leave`, `Material`, `Test`, `TestScore`, `Invoice`, `Payment`, `UserRole`, `UserStatus`, `AttendanceStatus`, `LeaveStatus`, `InvoiceStatus`, `PaymentMethod`

- [ ] **Step 1: Create `src/lib/types/index.ts`**

Define all interfaces and types matching the Firestore data model in the spec. Key types:

```typescript
export type UserRole = "admin" | "coach" | "student";
export type UserStatus = "pending" | "active" | "rejected" | "inactive";
export type AttendanceStatus = "present" | "absent" | "late";
export type LeaveStatus = "pending" | "approved" | "rejected";
export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue";
export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "card";
export type FileType = "pdf" | "video" | "image";
export type TestStatus = "upcoming" | "completed";
```

Each entity interface includes `id: string` (from Firestore doc ID) and `Timestamp` fields as `Date`. Example — `Branch { id, name, address, contactPhone, contactEmail, status, createdAt }`.

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/index.ts
git commit -m "feat: add all TypeScript entity interfaces and union types"
```

---

### Task 3: Firebase Configuration

**Files:**
- Create: `src/lib/firebase/config.ts`
- Create: `src/lib/firebase/auth.ts`
- Create: `src/lib/firebase/firestore.ts`
- Create: `src/lib/firebase/storage.ts`

**Interfaces:**
- Consumes: env vars `NEXT_PUBLIC_FIREBASE_*`
- Produces:
  - `app` (FirebaseApp singleton)
  - `auth` (Auth instance)
  - `db` (Firestore instance)
  - `storage` (Storage instance)
  - `signIn(email: string, password: string): Promise<UserCredential>`
  - `signUp(email: string, password: string): Promise<UserCredential>`
  - `signOutUser(): Promise<void>`
  - `onAuthChange(callback: (user: FirebaseUser | null) => void): Unsubscribe`

- [ ] **Step 1: Create `src/lib/firebase/config.ts`**

Initialize Firebase app with env vars. Export `app`, `auth`, `db`, `storage` singletons. Use `getApps().length === 0` guard to prevent re-initialization.

- [ ] **Step 2: Create `src/lib/firebase/auth.ts`**

Export `signIn`, `signUp`, `signOutUser`, `onAuthChange` wrappers using modular Firebase Auth API (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged`).

- [ ] **Step 3: Create `src/lib/firebase/firestore.ts`**

Export generic Firestore helpers:
- `getDocById<T>(collectionName: string, id: string): Promise<T | null>`
- `getDocs<T>(collectionName: string, ...queryConstraints: QueryConstraint[]): Promise<T[]>`
- `addDocument<T>(collectionName: string, data: Omit<T, "id">): Promise<string>`
- `updateDocument(collectionName: string, id: string, data: Partial<unknown>): Promise<void>`
- `deleteDocument(collectionName: string, id: string): Promise<void>`

All converters attach `id` from `doc.id` into the returned object.

- [ ] **Step 4: Create `src/lib/firebase/storage.ts`**

Export:
- `uploadFile(path: string, file: File, onProgress?: (pct: number) => void): Promise<string>` — uploads file, returns download URL
- `deleteFile(path: string): Promise<void>`

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/firebase/
git commit -m "feat: add Firebase config, auth, firestore, and storage helpers"
```

---

### Task 4: Auth Context + Role Detection

**Files:**
- Create: `src/contexts/auth-context.tsx`

**Interfaces:**
- Consumes: `onAuthChange` from Task 3, `User` and `UserRole` from Task 2
- Produces:
  - `AuthProvider` (wraps app in `src/app/layout.tsx`)
  - `useAuth(): { user: FirebaseUser | null, userData: User | null, role: UserRole | null, loading: boolean, isAdmin: boolean, isCoach: boolean, isStudent: boolean }`

- [ ] **Step 1: Create `src/contexts/auth-context.tsx`**

`AuthProvider` component:
1. Listens to `onAuthStateChanged`
2. When user exists, fetches their Firestore `users/{uid}` document to get `role` and `status`
3. Exposes `user` (Firebase user), `userData` (Firestore user doc), `role`, `loading`, and boolean helpers
4. While loading, provides `{ user: null, userData: null, role: null, loading: true }`

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/contexts/auth-context.tsx
git commit -m "feat: add AuthContext with role detection from Firestore"
```

---

### Task 5: Auth Pages (Login + Register + Pending Approval)

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/(auth)/pending-approval/page.tsx`
- Modify: `src/app/layout.tsx` — wrap children in `AuthProvider`

**Interfaces:**
- Consumes: `signIn`, `signUp` from Task 3, `useAuth` from Task 4, `addDocument` from Task 3
- Produces: Working login, registration, and pending-approval pages

- [ ] **Step 1: Create `src/app/(auth)/layout.tsx`**

Centered card layout for auth pages. Full-height, centered content with academy branding.

- [ ] **Step 2: Create `src/app/(auth)/login/page.tsx`**

Form with email + password inputs, submit button. On submit: call `signIn()`. On success: check Firestore user doc — if `status === "pending"` redirect to `/pending-approval`, else redirect to `/`. Show error toast on invalid credentials. Link to `/register`.

- [ ] **Step 3: Create `src/app/(auth)/register/page.tsx`**

Form with: name, email, phone, password, role selector (Coach or Student radio buttons). On submit:
1. Call `signUp()` to create Firebase Auth user
2. Call `addDocument("users", { email, displayName, phone, role, status: "pending", createdAt: new Date() })`
3. Redirect to `/pending-approval`

- [ ] **Step 4: Create `src/app/(auth)/pending-approval/page.tsx`**

Static page: "Your account is under review. An admin will approve your registration shortly." with a "Sign Out" button.

- [ ] **Step 5: Modify `src/app/layout.tsx`**

Wrap `{children}` in `<AuthProvider>`. Import and add `<Toaster />` from shadcn/ui.

- [ ] **Step 6: Verify login and register pages render**

Run: `npm run dev`, navigate to `/login` and `/register`.
Expected: Both pages render with forms.

- [ ] **Step 7: Commit**

```bash
git add src/app/
git commit -m "feat: add login, register, and pending-approval pages"
```

---

### Task 6: Dashboard Layout Shell (Sidebar + Header + Role-Aware Nav)

**Files:**
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/components/layout/mobile-nav.tsx`
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/page.tsx` (placeholder dashboard)
- Create: `src/lib/constants.ts`

**Interfaces:**
- Consumes: `useAuth` from Task 4
- Produces:
  - `Sidebar` component with role-filtered nav items
  - `Header` component with user avatar dropdown (profile, sign out)
  - `MobileNav` component (sheet-based sidebar for mobile)
  - `NAV_ITEMS` constant array in `constants.ts` with `{ label, href, icon, roles: UserRole[] }`
  - Dashboard layout that guards against unauthenticated/pending users

- [ ] **Step 1: Create `src/lib/constants.ts`**

Define `NAV_ITEMS` array:
```typescript
{ label: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "coach", "student"] }
{ label: "Branches", href: "/branches", icon: Building2, roles: ["admin"] }
{ label: "Batches", href: "/batches", icon: Users, roles: ["admin", "coach", "student"] }
{ label: "Students", href: "/students", icon: GraduationCap, roles: ["admin"] }
{ label: "Coaches", href: "/coaches", icon: UserCog, roles: ["admin"] }
{ label: "Approvals", href: "/approvals", icon: UserCheck, roles: ["admin"] }
{ label: "Attendance", href: "/attendance", icon: ClipboardCheck, roles: ["admin", "coach", "student"] }
{ label: "Leaves", href: "/leaves", icon: Calendar, roles: ["admin", "coach", "student"] }
{ label: "Materials", href: "/materials", icon: FileText, roles: ["admin", "coach", "student"] }
{ label: "Tests", href: "/tests", icon: BookOpen, roles: ["admin", "coach", "student"] }
{ label: "Invoices", href: "/invoices", icon: Receipt, roles: ["admin", "student"] }
{ label: "Payments", href: "/payments", icon: CreditCard, roles: ["admin", "student"] }
{ label: "Reports", href: "/reports", icon: BarChart3, roles: ["admin"] }
```
Icons from `lucide-react`.

- [ ] **Step 2: Create `src/components/layout/sidebar.tsx`**

Desktop sidebar (hidden on mobile via `hidden md:flex`). Filters `NAV_ITEMS` by user's role. Highlights active route. Academy name/logo at top. Collapsible width.

- [ ] **Step 3: Create `src/components/layout/header.tsx`**

Top header bar. Left: mobile menu trigger + page title. Right: user avatar dropdown with: user name, role badge, "Profile" link, "Sign Out" action.

- [ ] **Step 4: Create `src/components/layout/mobile-nav.tsx`**

shadcn `Sheet` triggered by hamburger button in header. Same nav items as sidebar, filtered by role. Closes on navigation.

- [ ] **Step 5: Create `src/app/(dashboard)/layout.tsx`**

Auth guard: if `loading`, show spinner. If `!user`, redirect to `/login`. If `userData?.status === "pending"`, redirect to `/pending-approval`. If `userData?.status === "rejected"`, redirect to `/login` with error.
Renders: `<Sidebar />` + `<div className="flex-1"><Header /><main>{children}</main></div>`

- [ ] **Step 6: Create `src/app/(dashboard)/page.tsx`**

Placeholder dashboard: "Welcome, {displayName}! Role: {role}". This is replaced by the real dashboard in Plan 2.

- [ ] **Step 7: Verify layout renders with sidebar and header**

Run: `npm run dev`.
Expected: Visiting `/` shows login (unauthenticated). After logging in as admin, sidebar with all nav items appears.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/ src/app/(dashboard)/ src/lib/constants.ts
git commit -m "feat: add responsive dashboard layout with role-aware sidebar and header"
```

---

### Task 7: Firestore Hooks (useCollection, useDocument)

**Files:**
- Create: `src/lib/hooks/use-collection.ts`
- Create: `src/lib/hooks/use-document.ts`
- Create: `src/lib/hooks/use-auth.ts` (re-export of useAuth for convenience)

**Interfaces:**
- Consumes: `db` from Task 3
- Produces:
  - `useCollection<T>(collectionName: string, ...queryConstraints: QueryConstraint[]): { data: T[], loading: boolean, error: Error | null }`
  - `useDocument<T>(collectionName: string, id: string | null): { data: T | null, loading: boolean, error: Error | null }`

Both hooks use `onSnapshot` for real-time updates and clean up listeners on unmount.

- [ ] **Step 1: Create `src/lib/hooks/use-collection.ts`**

Real-time Firestore collection listener. Uses `onSnapshot` with `query(collection(db, name), ...constraints)`. Converts each doc to `{ id: doc.id, ...doc.data() } as T`. Handles Timestamp → Date conversion for `createdAt` fields. Returns `{ data, loading, error }`. Unsubscribes in cleanup.

- [ ] **Step 2: Create `src/lib/hooks/use-document.ts`**

Real-time Firestore document listener. Uses `onSnapshot(doc(db, name, id))`. Returns `null` when `id` is null (no listener created). Same Timestamp handling.

- [ ] **Step 3: Create `src/lib/hooks/use-auth.ts`**

Re-export: `export { useAuth } from "@/contexts/auth-context";`

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/hooks/
git commit -m "feat: add real-time Firestore hooks (useCollection, useDocument)"
```

---

### Task 8: Firestore Security Rules + Cloud Function for Custom Claims

**Files:**
- Create: `firebase/firestore.rules`
- Create: `firebase/storage.rules`
- Create: `firebase/functions/src/index.ts`
- Create: `firebase/functions/package.json`

**Interfaces:**
- Produces:
  - Firestore rules enforcing role-based access
  - Storage rules restricting uploads to authenticated users
  - Cloud Function `onUserApproved` — triggered on Firestore write to `users/{uid}` when `status` changes to `"active"`, sets custom claims `{ role }` on the Firebase Auth user

- [ ] **Step 1: Create `firebase/firestore.rules`**

Rules skeleton:
- `users`: authenticated users can read own doc; admins can read/write all
- `branches`: admins read/write; coaches/students read
- `batches`: admins read/write; coaches read where `coachId == request.auth.uid`; students read where enrolled
- `attendance`, `leaves`, `materials`, `tests`, `testScores`, `invoices`, `payments`: similar role-based patterns
- Default deny

- [ ] **Step 2: Create `firebase/storage.rules`**

- Authenticated users can read files in `materials/`
- Admins and coaches can write to `materials/{batchId}/` (validate file size: images/PDFs < 20MB, videos < 100MB)
- No public access

- [ ] **Step 3: Create Cloud Function `onUserStatusChange`**

`firebase/functions/src/index.ts`:
Firestore trigger `onDocumentUpdated("users/{userId}")`. When `status` changes to `"active"`:
1. Read `role` from the document
2. Call `auth.setCustomUserClaims(userId, { role, status: "active" })`

This ensures Firebase Auth tokens carry the role for middleware/client checks.

- [ ] **Step 4: Create `firebase/functions/package.json`**

Dependencies: `firebase-admin`, `firebase-functions`. TypeScript build config.

- [ ] **Step 5: Commit**

```bash
git add firebase/
git commit -m "feat: add Firestore rules, Storage rules, and custom claims Cloud Function"
```

---

### Task 9: Middleware for Route Protection

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: Firebase Auth session (cookie or token)
- Produces: Next.js middleware that protects `/(dashboard)` routes

- [ ] **Step 1: Create `src/middleware.ts`**

Since Firebase Auth uses client-side tokens (not cookies by default), the middleware approach is:
- Middleware runs on `/(dashboard)` path matches
- Client-side protection is the primary guard (in `(dashboard)/layout.tsx` from Task 6)
- Middleware adds a lightweight check: if no auth cookie is present, redirect to `/login`

For Phase 1, the primary auth guard is the `(dashboard)/layout.tsx` redirect logic from Task 6. The middleware provides defense-in-depth for direct URL access.

Matcher config:
```typescript
export const config = {
  matcher: ["/((?!_next|api|favicon.ico|login|register|pending-approval).*)"],
};
```

- [ ] **Step 2: Verify route protection works**

Navigate to `/` while logged out.
Expected: Redirected to `/login`.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Next.js middleware for route protection"
```

---

### Task 10: PWA Manifest + Meta Tags

**Files:**
- Create: `public/manifest.json`
- Modify: `src/app/layout.tsx` — add manifest link and PWA meta tags

**Interfaces:**
- Produces: Installable PWA with home-screen icon support

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "KUFC Coaching Academy",
  "short_name": "KUFC",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#09090b",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Add manifest link and meta tags to `src/app/layout.tsx`**

In `<head>`: `<link rel="manifest" href="/manifest.json" />`, `<meta name="theme-color" content="#09090b" />`, `<meta name="apple-mobile-web-app-capable" content="yes" />`, viewport meta.

- [ ] **Step 3: Create placeholder icons**

Create simple placeholder `icon-192.png` and `icon-512.png` in `public/`. These are replaced with real branding later.

- [ ] **Step 4: Commit**

```bash
git add public/manifest.json public/icon-*.png src/app/layout.tsx
git commit -m "feat: add PWA manifest and meta tags"
```
