import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getMetadata, deleteObject } from "firebase/storage";
import { test, before, after } from "node:test";

let env;

const IDS = {
  admin: "admin-uid",
  coachA: "coachA-uid",
  coachB: "coachB-uid",
  studentA: "studentA-uid",
  studentB: "studentB-uid",
  coachARecord: "coachA-coach",
  coachBRecord: "coachB-coach",
  studentARecord: "studentA-student",
  studentBRecord: "studentB-student",
  branch: "branch-1",
  batchA: "batch-a",
  batchB: "batch-b",
};

const PROJECT = "demo-kufc";
const EMULATOR = "http://127.0.0.1:8080";

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

// Rules read role and batch membership from Firestore, so those fixtures must
// exist. Seeded over REST with the `owner` token, which bypasses rules.
async function seedDoc(path, data) {
  const res = await fetch(`${EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`, {
    method: "PATCH",
    headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, toValue(v)])) }),
  });
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

  await seedDoc(`branches/${IDS.branch}`, { name: "Main", address: "Street", contactPhone: "1", contactEmail: "a@b.test", status: "active", createdAt: now });
  await seedDoc(`batches/${IDS.batchA}`, { name: "Batch A", branchId: IDS.branch, coachId: IDS.coachARecord, sport: "Math", schedule: { days: ["Mon"], startTime: "16:00", endTime: "17:00" }, monthlyFee: 1000, code: "K7M2QX", status: "active", createdAt: now });
  await seedDoc(`batches/${IDS.batchB}`, { name: "Batch B", branchId: IDS.branch, coachId: IDS.coachBRecord, sport: "Sci", schedule: { days: ["Tue"], startTime: "17:00", endTime: "18:00" }, monthlyFee: 1200, code: "P3R8TV", status: "active", createdAt: now });

  await seedDoc(`students/${IDS.studentARecord}`, { name: "Student A", email: "sa@a.test", phone: "1", userId: IDS.studentA, batchId: IDS.batchA, branchId: IDS.branch, status: "active", joiningDate: now, createdAt: now });
  await seedDoc(`students/${IDS.studentBRecord}`, { name: "Student B", email: "sb@b.test", phone: "1", userId: IDS.studentB, batchId: IDS.batchB, branchId: IDS.branch, status: "active", joiningDate: now, createdAt: now });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync("firebase/firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("firebase/storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await seed();
});

after(async () => { await env.cleanup(); });

const storageFor = (uid) => env.authenticatedContext(uid).storage();

const bytes = (n, fill = 65) => new Uint8Array(n).fill(fill);
const pdf = (n = 1024) => new Blob([bytes(n)], { type: "application/pdf" });
const png = (n = 1024) => new Blob([bytes(n)], { type: "image/png" });
const mp4 = (n = 1024) => new Blob([bytes(n)], { type: "video/mp4" });
const txt = (n = 1024) => new Blob([bytes(n)], { type: "text/plain" });

const put = (storage, path, blob) => uploadBytes(ref(storage, path), blob);
// getMetadata performs a read check in the emulator, which is what the read
// rule governs; downloading needs a browser fetch path unavailable in Node.
const peek = (storage, path) => getMetadata(ref(storage, path));

// --- read access ------------------------------------------------------------

test("admin, assigned coach, and enrolled student can read materials", async () => {
  const path = `materials/${IDS.batchA}/notes.pdf`;
  await assertSucceeds(put(storageFor(IDS.admin), path, pdf()));

  await assertSucceeds(peek(storageFor(IDS.admin), path));
  await assertSucceeds(peek(storageFor(IDS.coachA), path));
  await assertSucceeds(peek(storageFor(IDS.studentA), path));
});

test("a coach cannot read another batch's materials", async () => {
  await assertFails(peek(storageFor(IDS.coachB), `materials/${IDS.batchA}/notes.pdf`));
});

test("a student cannot read another batch's materials", async () => {
  await assertFails(peek(storageFor(IDS.studentB), `materials/${IDS.batchA}/notes.pdf`));
});

test("unauthenticated cannot read materials", async () => {
  const anon = env.unauthenticatedContext().storage();
  await assertFails(peek(anon, `materials/${IDS.batchA}/notes.pdf`));
});

// --- write access -----------------------------------------------------------

test("admin and assigned coach can upload", async () => {
  await assertSucceeds(put(storageFor(IDS.admin), `materials/${IDS.batchA}/admin.pdf`, pdf()));
  await assertSucceeds(put(storageFor(IDS.coachA), `materials/${IDS.batchA}/coach.pdf`, pdf()));
});

test("a coach cannot upload into another batch's folder", async () => {
  await assertFails(put(storageFor(IDS.coachB), `materials/${IDS.batchA}/intruder.pdf`, pdf()));
});

test("students cannot upload", async () => {
  await assertFails(put(storageFor(IDS.studentA), `materials/${IDS.batchA}/cheat.pdf`, pdf()));
});

test("a batch with no assigned coach rejects the coach that owns the account", async () => {
  // Guards against a rule that trusts the caller's role without checking the batch.
  await assertFails(put(storageFor(IDS.coachA), `materials/not-a-real-batch/file.pdf`, pdf()));
});

// --- type limits ------------------------------------------------------------

test("pdf, image, and video types are accepted", async () => {
  const s = storageFor(IDS.admin);
  await assertSucceeds(put(s, `materials/${IDS.batchA}/a.pdf`, pdf()));
  await assertSucceeds(put(s, `materials/${IDS.batchA}/a.png`, png()));
  await assertSucceeds(put(s, `materials/${IDS.batchA}/a.mp4`, mp4()));
});

test("other content types are rejected", async () => {
  const s = storageFor(IDS.admin);
  await assertFails(put(s, `materials/${IDS.batchA}/a.txt`, txt()));
  await assertFails(put(s, `materials/${IDS.batchA}/a.exe`, new Blob([bytes(64)], { type: "application/x-msdownload" })));
});

// --- size limits ------------------------------------------------------------

test("pdf and image over 20MB are rejected", async () => {
  const s = storageFor(IDS.admin);
  await assertFails(put(s, `materials/${IDS.batchA}/big.pdf`, pdf(21 * 1024 * 1024)));
  await assertFails(put(s, `materials/${IDS.batchA}/big.png`, png(21 * 1024 * 1024)));
});

test("video over 100MB is rejected", async () => {
  await assertFails(put(storageFor(IDS.admin), `materials/${IDS.batchA}/big.mp4`, mp4(101 * 1024 * 1024)));
});

test("a 30MB video is allowed, proving video uses the larger ceiling", async () => {
  await assertSucceeds(put(storageFor(IDS.admin), `materials/${IDS.batchA}/ok.mp4`, mp4(30 * 1024 * 1024)));
});

// --- delete -----------------------------------------------------------------

test("admin and assigned coach can delete", async () => {
  const s = storageFor(IDS.admin);
  await assertSucceeds(put(s, `materials/${IDS.batchA}/temp.pdf`, pdf()));

  await assertSucceeds(deleteObject(ref(s, `materials/${IDS.batchA}/temp.pdf`)));
  const other = storageFor(IDS.coachA);
  await assertSucceeds(put(other, `materials/${IDS.batchA}/temp2.pdf`, pdf()));
  await assertSucceeds(deleteObject(ref(other, `materials/${IDS.batchA}/temp2.pdf`)));
});

test("students and other coaches cannot delete", async () => {
  const s = storageFor(IDS.admin);
  await assertSucceeds(put(s, `materials/${IDS.batchA}/keeper.pdf`, pdf()));

  await assertFails(deleteObject(ref(storageFor(IDS.studentA), `materials/${IDS.batchA}/keeper.pdf`)));
  await assertFails(deleteObject(ref(storageFor(IDS.coachB), `materials/${IDS.batchA}/keeper.pdf`)));
});

// --- outside the materials namespace ----------------------------------------

test("paths outside materials/ are closed", async () => {
  const s = storageFor(IDS.admin);
  await assertFails(put(s, "public/secret.pdf", pdf()));
  await assertFails(put(s, `${IDS.batchA}/loose.pdf`, pdf()));
});