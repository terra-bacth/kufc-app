import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveStudentBatch } from "../src/lib/student-approval.ts";

const batch = (id, code, status = "active") => ({
  id, name: `Batch ${id}`, branchId: "b1", coachId: "c1", sport: "Math",
  schedule: { days: ["Mon"], startTime: "16:00", endTime: "17:00" },
  monthlyFee: 1000, code, status, createdAt: new Date(),
});

const student = (requestedBatchCode) => ({
  id: "u1", email: "s@a.test", displayName: "S", role: "student",
  status: "pending", requestedBatchCode, createdAt: new Date(),
});

const batches = [batch("a", "K7M2QX"), batch("b", "P3R8TV"), batch("c", "OLD111", "inactive")];

test("a valid code resolves to its batch", () => {
  const r = resolveStudentBatch(student("K7M2QX"), batches);
  assert.equal(r.kind, "code");
  assert.equal(r.batch.id, "a");
});

test("codes are matched case-insensitively and trimmed", () => {
  assert.equal(resolveStudentBatch(student(" k7m2qx "), batches).batch.id, "a");
});

test("a wrong code asks the admin to choose instead of failing", () => {
  const r = resolveStudentBatch(student("ZZZ999"), batches);
  assert.equal(r.kind, "needs-choice");
  // Inactive batches are not offered as options.
  assert.deepEqual(r.batch.map((b) => b.id), ["a", "b"]);
});

test("a missing code asks the admin to choose", () => {
  assert.equal(resolveStudentBatch(student(undefined), batches).kind, "needs-choice");
  assert.equal(resolveStudentBatch(student(""), batches).kind, "needs-choice");
});

test("a code pointing at an inactive batch asks the admin to choose", () => {
  const r = resolveStudentBatch(student("OLD111"), batches);
  assert.equal(r.kind, "needs-choice");
  assert.ok(!r.batch.some((b) => b.id === "c"));
});

test("coaches never go through batch resolution", () => {
  const coach = { ...student("K7M2QX"), role: "coach" };
  assert.equal(resolveStudentBatch(coach, batches).kind, "coach");
});

test("no active batches yields an empty choice list, not a crash", () => {
  const r = resolveStudentBatch(student("K7M2QX"), []);
  assert.equal(r.kind, "needs-choice");
  assert.deepEqual(r.batch, []);
});

test("batches created before codes existed do not break resolution", () => {
  const legacy = [batch("a", undefined)];
  assert.equal(resolveStudentBatch(student("K7M2QX"), legacy).kind, "needs-choice");
  assert.equal(resolveStudentBatch(student(undefined), legacy).batch.length, 1);
});