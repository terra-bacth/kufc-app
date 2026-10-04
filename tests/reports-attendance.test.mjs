import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reportsPage = readFileSync("src/app/(dashboard)/reports/page.tsx", "utf8");

test("Reports chart reads entries collectionGroup, not top-level attendance", () => {
  // The chart aggregates per-student attendance. It must read the per-student
  // entries subcollection across all batches, not the session doc which would
  // expose the whole class map. A top-level collection("attendance") is empty
  // because docs live at attendance/{batchId}/records/{date}.
  assert.match(reportsPage, /collectionGroup\s*\(\s*db\s*,\s*["']entries["']\s*\)/);
  assert.doesNotMatch(reportsPage, /collection\s*\(\s*db\s*,\s*["']attendance["']\s*\)/);
});

test("Reports chart does not use studentId filter (admin sees all)", () => {
  // Admin report must aggregate every student; a studentId where clause would
  // restrict it to one student. my-attendance uses the filter; reports does not.
  assert.doesNotMatch(reportsPage, /where\s*\(\s*["']studentId["']/);
});