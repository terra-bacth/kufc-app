# Coaching Academy Web App — Design Spec

## Overview

A responsive PWA (Next.js) to manage a coaching academy: branches, batches, students, coaches, attendance, leaves, study materials, tests, and invoicing. Three roles: Admin (full control), Coach (manage assigned batches), Student (read-only portal).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ App Router, TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| State | React Context + Firebase real-time listeners |
| Backend | Firebase Auth, Cloud Firestore, Firebase Storage, Cloud Functions |
| Charts | Recharts |
| Hosting | Vercel or Firebase Hosting |

## Roles & Access

| Role | Access |
|------|--------|
| Admin | Full CRUD on all entities, approve registrations, generate invoices, view reports |
| Coach | Mark attendance, upload materials, create tests for assigned batches only |
| Student | View own attendance, scores, materials, submit leave requests (read-only) |

## Auth Flow

- Self-registration for coaches and students (email, password, name, phone)
- New users get `status: "pending"` — redirected to waiting screen
- Admin approves/rejects via Approvals screen
- On approval, Cloud Function sets Firebase custom claims `{ role, status }`
- Login checks claims and routes to role-appropriate dashboard

## Firestore Data Model

### users/{userId}
```
email, displayName, role ("admin"|"coach"|"student"),
status ("pending"|"active"|"rejected"|"inactive"),
linkedEntityId (coachId or studentId), phone, createdAt
```

### branches/{branchId}
```
name, address, contactPhone, contactEmail, status, createdAt
```

### batches/{batchId}
```
name, branchId, coachId, sport,
schedule: { days: string[], startTime, endTime },
monthlyFee, status, createdAt
```

### students/{studentId}
```
name, email, phone, parentPhone, userId,
batchId, branchId, status ("active"|"inactive"),
joiningDate, createdAt
```

### coaches/{coachId}
```
name, email, phone, userId,
batchIds[], branchIds[], specialization,
status, joiningDate, createdAt
```

### attendance/{batchId}/records/{date_YYYY-MM-DD}
```
date, batchId, markedBy, markedAt,
students: { [studentId]: "present"|"absent"|"late" },
coachPresent: boolean
```

### leaves/{leaveId}
```
requestedBy, requesterType ("student"|"coach"), requesterId,
batchId, fromDate, toDate, reason,
status ("pending"|"approved"|"rejected"),
reviewedBy, reviewedAt, createdAt
```

### materials/{materialId}
```
title, description, batchId, uploadedBy,
fileUrl, fileType ("pdf"|"video"|"image"),
fileName, fileSize, createdAt
```

### tests/{testId}
```
title, batchId, totalMarks, date,
createdBy, status ("upcoming"|"completed"), createdAt
```

### testScores/{testId}/scores/{studentId}
```
studentId, marksObtained, grade, remarks
```

### invoices/{invoiceId}
```
studentId, batchId, invoiceNumber, month, year,
amount, dueDate,
status ("draft"|"sent"|"partial"|"paid"|"overdue"),
lineItems: [{ description, amount }],
createdAt, sentAt
```

### payments/{paymentId}
```
invoiceId, studentId, amount, paidDate,
method ("cash"|"upi"|"bank_transfer"|"card"),
receiptUrl, createdAt
```

## Routes

```
/login
/register
/pending-approval

/(dashboard)/                   — Role-aware sidebar layout
  /                             — Dashboard
  /branches                     — Admin only
  /batches                      — Admin: all, Coach: assigned, Student: enrolled
  /students                     — Admin only
  /coaches                      — Admin only
  /approvals                    — Admin only
  /attendance/[batchId]         — Admin/Coach: mark, Student: view own
  /leaves                       — Admin: manage, Coach/Student: request
  /materials/[batchId]          — Admin/Coach: upload, Student: download
  /tests                        — Admin/Coach: create, Student: view
  /tests/[testId]/scores        — Score entry / view
  /invoices                     — Admin: manage, Student: view
  /invoices/[invoiceId]         — Invoice detail
  /payments                     — Admin: record, Student: view
  /reports                      — Admin only
  /profile                      — All roles
```

## Key Screens

### Dashboard (all roles)
- Admin: stat cards (branches, batches, students, coaches, pending approvals, overdue invoices), quick-action buttons
- Coach: today's schedule, assigned batches, quick stats
- Student: next class, attendance %, recent scores

### Attendance
- Batch selector → date picker → student list with present/absent/late toggle
- "Mark all present" bulk action
- Coach sees only assigned batches
- Student sees calendar view of own attendance

### Invoicing
- Auto-generate monthly invoices per student from batch fee
- Invoice detail with line items, payment history, remaining balance
- Partial payment support
- Status badges: draft, sent, partial, paid, overdue
- "Send reminder" button (email via Cloud Function)
- Downloadable PDF invoice

### Reports (Admin)
- Attendance % per student (bar chart)
- Batch-wise attendance trends (line chart)
- Date range filter
- Payment collection summary, outstanding dues
- CSV export

## Mobile-First Responsive Strategy
- Sidebar → bottom nav on mobile
- DataTables → card lists on small screens
- Touch targets ≥ 44px
- PWA manifest for home screen install

## Firestore Security Rules Strategy
- Admin: read/write all collections
- Coach: read/write only where batchId is in their assigned batches
- Student: read own data, create leave requests, no write to attendance/tests
- Unauthenticated: no access

## File Upload Constraints
- PDFs/images: max 20MB
- Videos: max 100MB
- Storage path: `materials/{batchId}/{timestamp}_{filename}`
- Client-side validation before upload
