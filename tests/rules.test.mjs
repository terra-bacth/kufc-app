import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import { test, before, after } from "node:test";

let env;

const PROJECT = "demo-kufc";
const EMULATOR = "http://127.0.0.1:8080";

const IDS = {
  admin: "admin-uid",
  coachA: "coachA-uid",
  coachB: "coachB-uid",
  studentA: "studentA-uid",
  studentB: "studentB-uid",
  pending: "pending-uid",
  coachARecord: "coachA-coach",
  coachBRecord: "coachB-coach",
  studentARecord: "studentA-student",
  studentBRecord: "studentB-student",
  branch: "branch-1",
  batchA: "batch-a",
  batchB: "batch-b",
  invoiceA: "invoice-a",
};

// ---- seeding over the emulator REST API -----------------------------------
// The REST API honours the `owner` token, which bypasses security rules. That
// is how a fixture creates the admin that is allowed to create everything else.

function toValue(v) {
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (v && typeof v === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toValue(x)])) } };
  }
  return { nullValue: null };
}

async function seedDoc(path, data) {
  const res = await fetch(
    `${EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`,
    {
      method: "PATCH",
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
    },
  );
  if (!res.ok) throw new Error(`seed ${path} failed: ${res.status} ${await res.text()}`);
}

async function seed() {
  const now = new Date();
  const base = { phone: "1", createdAt: now };

  await seedDoc(`users/${IDS.admin}`, { ...base, email: "owner@academy.test", displayName: "Owner", role: "admin", status: "active" });
  await seedDoc(`users/${IDS.coachA}`, { ...base, email: "coachA@academy.test", displayName: "Coach A", role: "coach", status: "active", linkedEntityId: IDS.coachARecord });
  await seedDoc(`users/${IDS.coachB}`, { ...base, email: "coachB@academy.test", displayName: "Coach B", role: "coach", status: "active", linkedEntityId: IDS.coachBRecord });
  await seedDoc(`users/${IDS.studentA}`, { ...base, email: "studentA@academy.test", displayName: "Student A", role: "student", status: "active", linkedEntityId: IDS.studentARecord });
  await seedDoc(`users/${IDS.studentB}`, { ...base, email: "studentB@academy.test", displayName: "Student B", role: "student", status: "active", linkedEntityId: IDS.studentBRecord });
  await seedDoc(`users/${IDS.pending}`, { ...base, email: "pending@academy.test", displayName: "Pending", role: "coach", status: "pending" });

  await seedDoc(`branches/${IDS.branch}`, { name: "Main", address: "Street", contactPhone: "1", contactEmail: "a@b.test", status: "active", createdAt: now });

  await seedDoc(`coaches/${IDS.coachARecord}`, { name: "Coach A", email: "a@a.test", phone: "1", userId: IDS.coachA, batchIds: [IDS.batchA], branchIds: [IDS.branch], specialization: "Math", status: "active", joiningDate: now, createdAt: now });
  await seedDoc(`coaches/${IDS.coachBRecord}`, { name: "Coach B", email: "b@b.test", phone: "1", userId: IDS.coachB, batchIds: [IDS.batchB], branchIds: [IDS.branch], specialization: "Sci", status: "active", joiningDate: now, createdAt: now });

  await seedDoc(`batches/${IDS.batchA}`, { name: "Batch A", branchId: IDS.branch, coachId: IDS.coachARecord, sport: "Math", schedule: { days: ["Mon"], startTime: "16:00", endTime: "17:00" }, monthlyFee: 1000, status: "active", createdAt: now });
  await seedDoc(`batches/${IDS.batchB}`, { name: "Batch B", branchId: IDS.branch, coachId: IDS.coachBRecord, sport: "Sci", schedule: { days: ["Tue"], startTime: "17:00", endTime: "18:00" }, monthlyFee: 1200, status: "active", createdAt: now });

  await seedDoc(`students/${IDS.studentARecord}`, { name: "Student A", email: "sa@a.test", phone: "1", userId: IDS.studentA, batchId: IDS.batchA, branchId: IDS.branch, status: "active", joiningDate: now, createdAt: now });
  await seedDoc(`students/${IDS.studentBRecord}`, { name: "Student B", email: "sb@b.test", phone: "1", userId: IDS.studentB, batchId: IDS.batchB, branchId: IDS.branch, status: "active", joiningDate: now, createdAt: now });

  await seedDoc(`invoices/${IDS.invoiceA}`, { studentId: IDS.studentARecord, batchId: IDS.batchA, invoiceNumber: "INV-1", month: 1, year: 2026, amount: 1000, dueDate: now, status: "sent", lineItems: [{ description: "fee", amount: 1000 }], createdAt: now });

  await seedDoc(`attendance/${IDS.batchA}/records/2026-01-05`, {
    batchId: IDS.batchA, date: "2026-01-05", markedBy: IDS.coachA, markedAt: now,
    students: { [IDS.studentARecord]: "present" }, coachPresent: true,
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync("firebase/firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
  await seed();
});

after(async () => { await env.cleanup(); });

const dbFor = (uid) => env.authenticatedContext(uid).firestore();

// --- privilege escalation: the holes that matter most -----------------------

test("unauthenticated cannot read the academy", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "branches", IDS.branch)));
  await assertFails(getDoc(doc(db, "batches", IDS.batchA)));
});

test("self-registration cannot claim the admin role", async () => {
  const db = env.authenticatedContext("fresh-uid").firestore();
  await assertFails(setDoc(doc(db, "users", "fresh-uid"), {
    email: "fresh-uid@academy.test", displayName: "Sneaky", phone: "1",
    role: "admin", status: "active", createdAt: new Date(),
  }));
});

test("self-registration cannot pre-approve itself", async () => {
  const db = env.authenticatedContext("fresh2-uid").firestore();
  await assertFails(setDoc(doc(db, "users", "fresh2-uid"), {
    email: "fresh2-uid@academy.test", displayName: "Eager", phone: "1",
    role: "coach", status: "active", createdAt: new Date(),
  }));
});

test("self-registration cannot claim another coach's linkedEntityId", async () => {
  const db = env.authenticatedContext("fresh3-uid").firestore();
  await assertFails(setDoc(doc(db, "users", "fresh3-uid"), {
    email: "fresh3-uid@academy.test", displayName: "Thief", phone: "1",
    role: "coach", status: "pending", linkedEntityId: IDS.coachARecord, createdAt: new Date(),
  }));
});

test("a user cannot promote their own role or status", async () => {
  const db = dbFor(IDS.coachA);
  await assertFails(updateDoc(doc(db, "users", IDS.coachA), { role: "admin" }));
  await assertFails(updateDoc(doc(db, "users", IDS.coachA), { status: "pending" }));
});

test("a user cannot hijack another account's profile", async () => {
  await assertFails(updateDoc(doc(dbFor(IDS.coachA), "users", IDS.coachB), { displayName: "Mine now" }));
});

test("a user may edit their own name and phone", async () => {
  await assertSucceeds(updateDoc(doc(dbFor(IDS.coachA), "users", IDS.coachA), { displayName: "Renamed", phone: "9" }));
});

test("a pending account is inert even with a coach role", async () => {
  const db = dbFor(IDS.pending);
  await assertFails(getDoc(doc(db, "branches", IDS.branch)));
  await assertFails(getDoc(doc(db, "batches", IDS.batchA)));
});

// --- coach scoping ---------------------------------------------------------

test("coach can read structure but not write it", async () => {
  const db = dbFor(IDS.coachA);
  await assertSucceeds(getDoc(doc(db, "branches", IDS.branch)));
  await assertFails(updateDoc(doc(db, "batches", IDS.batchA), { name: "Hijacked" }));
  await assertFails(setDoc(doc(db, "branches", "new-branch"), { name: "x" }));
});

test("coach marks attendance only for their own batch", async () => {
  const own = dbFor(IDS.coachA);
  const other = dbFor(IDS.coachB);

  await assertSucceeds(setDoc(doc(own, "attendance", IDS.batchA, "records", "2026-02-02"), {
    batchId: IDS.batchA, date: "2026-02-02", markedBy: IDS.coachA, markedAt: new Date(),
    students: { [IDS.studentARecord]: "present" }, coachPresent: true,
  }));
  await assertFails(setDoc(doc(other, "attendance", IDS.batchA, "records", "2026-02-03"), {
    batchId: IDS.batchA, date: "2026-02-03", markedBy: IDS.coachB, markedAt: new Date(),
    students: {}, coachPresent: true,
  }));
});

test("coach reads their own roster but not the other coach's", async () => {
  await assertSucceeds(getDoc(doc(dbFor(IDS.coachA), "students", IDS.studentARecord)));
  await assertFails(getDoc(doc(dbFor(IDS.coachA), "students", IDS.studentBRecord)));
});

// --- students --------------------------------------------------------------

test("students cannot read attendance at all", async () => {
  const db = dbFor(IDS.studentA);
  await assertFails(getDoc(doc(db, "attendance", IDS.batchA, "records", "2026-01-05")));
  await assertFails(setDoc(doc(db, "attendance", IDS.batchA, "records", "2026-01-08"), {}));
});

test("student reads own record and invoice, not others'", async () => {
  const db = dbFor(IDS.studentA);
  await assertSucceeds(getDoc(doc(db, "students", IDS.studentARecord)));
  await assertFails(getDoc(doc(db, "students", IDS.studentBRecord)));
  await assertSucceeds(getDoc(doc(db, "invoices", IDS.invoiceA)));
});

test("student cannot write to the student collection", async () => {
  await assertFails(updateDoc(doc(dbFor(IDS.studentA), "students", IDS.studentARecord), { name: "Renamed" }));
});

test("student files a leave only as themselves", async () => {
  const db = dbFor(IDS.studentA);
  await assertSucceeds(addDoc(collection(db, "leaves"), {
    requestedBy: "Student A", requesterType: "student", requesterId: IDS.studentARecord,
    fromDate: new Date(), toDate: new Date(), reason: "Family trip", status: "pending", createdAt: new Date(),
  }));
});

test("student cannot file a forged or pre-approved leave", async () => {
  const db = dbFor(IDS.studentA);
  await assertFails(addDoc(collection(db, "leaves"), {
    requestedBy: "Impostor", requesterType: "student", requesterId: IDS.studentBRecord,
    fromDate: new Date(), toDate: new Date(), reason: "Forged", status: "approved", createdAt: new Date(),
  }));
  await assertFails(addDoc(collection(db, "leaves"), {
    requestedBy: "Student A", requesterType: "coach", requesterId: IDS.studentARecord,
    fromDate: new Date(), toDate: new Date(), reason: "Wrong type", status: "pending", createdAt: new Date(),
  }));
});

test("student cannot record a payment", async () => {
  await assertFails(addDoc(collection(dbFor(IDS.studentA), "payments"), {
    invoiceId: IDS.invoiceA, studentId: IDS.studentARecord, amount: 1000,
    paidDate: new Date(), method: "cash", createdAt: new Date(),
  }));
});

// --- admin -----------------------------------------------------------------

test("admin can approve, and the account then gains access", async () => {
  await assertSucceeds(updateDoc(doc(dbFor(IDS.admin), "users", IDS.pending), { status: "active" }));
  await assertSucceeds(getDoc(doc(dbFor(IDS.pending), "branches", IDS.branch)));
});

test("admin can create branches and students", async () => {
  const db = dbFor(IDS.admin);
  await assertSucceeds(setDoc(doc(db, "branches", "branch-2"), {
    name: "Second", address: "Road", contactPhone: "2", contactEmail: "c@d.test", status: "active", createdAt: new Date(),
  }));
});

test("unknown collections are closed by the catch-all", async () => {
  const db = dbFor(IDS.admin);
  await assertFails(setDoc(doc(db, "secrets", "x"), { value: 1 }));
  await assertFails(getDoc(doc(db, "secrets", "x")));
});