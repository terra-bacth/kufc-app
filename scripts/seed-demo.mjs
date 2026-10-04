const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-kufc";
const authUrl = process.env.AUTH_EMULATOR_URL ?? "http://127.0.0.1:9099";
const firestoreUrl = process.env.FIRESTORE_EMULATOR_URL ?? "http://127.0.0.1:8080";
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-api-key";
const password = "DemoPass123!";

async function authRequest(operation, email) {
  const response = await fetch(
    `${authUrl}/identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${operation} ${email}: ${body.error?.message ?? response.statusText}`);
  }
  return body;
}

async function ensureAccount(email) {
  try {
    return await authRequest("signUp", email);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("EMAIL_EXISTS")) throw error;
    return authRequest("signInWithPassword", email);
  }
}

function firestoreValue(value) {
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (value === null) return { nullValue: "NULL_VALUE" };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(firestoreValue) } };
  }
  return {
    mapValue: {
      fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, firestoreValue(item)])),
    },
  };
}

async function seedDocument(path, data) {
  const response = await fetch(
    `${firestoreUrl}/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, firestoreValue(value)])),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Seeding ${path} failed: ${response.status} ${await response.text()}`);
  }
}

const accounts = {
  admin: await ensureAccount("admin@academy.test"),
  coach: await ensureAccount("coach@academy.test"),
  student: await ensureAccount("student@academy.test"),
};
const now = new Date();
const dueDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
const sessionDate = now.toISOString().slice(0, 10);
const commonUser = { createdAt: now, phone: "5550100" };

await Promise.all([
  seedDocument(`users/${accounts.admin.localId}`, {
    ...commonUser, email: "admin@academy.test", displayName: "Demo Admin", role: "admin", status: "active",
  }),
  seedDocument(`users/${accounts.coach.localId}`, {
    ...commonUser, email: "coach@academy.test", displayName: "Demo Coach", role: "coach", status: "active", linkedEntityId: "demo-coach",
  }),
  seedDocument(`users/${accounts.student.localId}`, {
    ...commonUser, email: "student@academy.test", displayName: "Demo Student", role: "student", status: "active", linkedEntityId: "demo-student",
  }),
]);

await Promise.all([
  seedDocument("branches/demo-branch", {
    name: "Demo Pune Branch", address: "Pune", contactPhone: "5550100", contactEmail: "hello@academy.test", status: "active", createdAt: now,
  }),
  seedDocument("coaches/demo-coach", {
    name: "Demo Coach", email: "coach@academy.test", phone: "5550101", userId: accounts.coach.localId,
    batchIds: ["demo-batch"], branchIds: ["demo-branch"], specialization: "Football", status: "active", joiningDate: now, createdAt: now,
  }),
  seedDocument("batches/demo-batch", {
    name: "Demo U-16", branchId: "demo-branch", coachId: "demo-coach", sport: "Football",
    schedule: { days: ["Mon", "Wed", "Fri"], startTime: "17:00", endTime: "18:30" },
    monthlyFee: 4500, code: "K7M2QX", status: "active", createdAt: now,
  }),
  seedDocument("students/demo-student", {
    name: "Demo Student", email: "student@academy.test", phone: "5550102", parentPhone: "5550103",
    userId: accounts.student.localId, batchId: "demo-batch", branchId: "demo-branch", status: "active", joiningDate: now, createdAt: now,
  }),
  seedDocument("students/demo-student-2", {
    name: "Sample Teammate", email: "teammate@academy.test", phone: "5550104",
    batchId: "demo-batch", branchId: "demo-branch", status: "active", joiningDate: now, createdAt: now,
  }),
]);

await Promise.all([
  seedDocument(`attendance/demo-batch/records/${sessionDate}`, {
    batchId: "demo-batch", date: sessionDate, markedBy: accounts.coach.localId, markedAt: now,
    students: { "demo-student": "present", "demo-student-2": "late" }, coachPresent: true,
  }),
  seedDocument(`attendance/demo-batch/records/${sessionDate}/entries/demo-student`, {
    studentId: "demo-student", batchId: "demo-batch", date: sessionDate, status: "present", markedBy: accounts.coach.localId, markedAt: now,
  }),
  seedDocument(`attendance/demo-batch/records/${sessionDate}/entries/demo-student-2`, {
    studentId: "demo-student-2", batchId: "demo-batch", date: sessionDate, status: "late", markedBy: accounts.coach.localId, markedAt: now,
  }),
  seedDocument("tests/demo-test", {
    title: "Demo Skills Assessment", batchId: "demo-batch", totalMarks: 100, date: now,
    createdBy: accounts.coach.localId, status: "completed", createdAt: now,
  }),
  seedDocument("testScores/demo-test/scores/demo-student", {
    studentId: "demo-student", marksObtained: 82, grade: "A", remarks: "Great work",
  }),
  seedDocument("invoices/demo-invoice", {
    studentId: "demo-student", batchId: "demo-batch", invoiceNumber: "DEMO-2026-01", month: now.getMonth() + 1,
    year: now.getFullYear(), amount: 4500, dueDate, status: "sent", lineItems: [{ description: "Monthly coaching fee", amount: 4500 }], createdAt: now,
  }),
  seedDocument("payments/demo-payment", {
    invoiceId: "demo-invoice", studentId: "demo-student", amount: 1500, paidDate: now,
    method: "upi", createdAt: now,
  }),
]);

console.log("Demo data seeded in the Firebase emulators.");
console.log("Sign in at http://localhost:3000 with:");
console.log(`  admin@academy.test / ${password}  (admin)`);
console.log(`  coach@academy.test / ${password}  (coach)`);
console.log(`  student@academy.test / ${password}  (student)`);
