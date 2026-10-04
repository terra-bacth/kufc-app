import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRank, bumpAttendance } from "../src/lib/rollup.ts";

test("applyRank assigns dense ranks by attendancePct then testAvg", () => {
  const input = [
    { studentId: "a", attendancePct: 80, testAvg: 70 },
    { studentId: "b", attendancePct: 90, testAvg: 60 },
    { studentId: "c", attendancePct: 80, testAvg: 80 },
    { studentId: "d", attendancePct: 80, testAvg: 80 },
  ];
  const out = applyRank(input);
  // b (90) = rank 1
  assert.equal(out.find((x) => x.studentId === "b").rank, 1);
  // c/d (80, 80) tie = rank 2
  assert.equal(out.find((x) => x.studentId === "c").rank, 2);
  assert.equal(out.find((x) => x.studentId === "d").rank, 2);
  // a (80, 70) = rank 4 (dense: tied 2s skip to 4? No — dense means 1,2,3 — tied 2 then next is 3)
  // Wait: dense ranking: 1, 2, 2, 3. Let me verify.
  // The implementation uses dense: tied on both keys share position, next increments.
  assert.equal(out.find((x) => x.studentId === "a").rank, 3);
});

test("percentile reflects position in class", () => {
  const input = [
    { studentId: "a", attendancePct: 50, testAvg: 50 },
    { studentId: "b", attendancePct: 100, testAvg: 100 },
    { studentId: "c", attendancePct: 75, testAvg: 75 },
  ];
  const out = applyRank(input);
  // b is rank 1 of 3 -> percentile = ((3-1)/2)*100 = 100
  assert.equal(out.find((x) => x.studentId === "b").percentile, 100);
  // c rank 2 -> ((3-2)/2)*100 = 50
  assert.equal(out.find((x) => x.studentId === "c").percentile, 50);
  // a rank 3 -> ((3-3)/2)*100 = 0
  assert.equal(out.find((x) => x.studentId === "a").percentile, 0);
});

test("single student gets percentile 100", () => {
  const input = [{ studentId: "a", attendancePct: 60, testAvg: 60 }];
  const out = applyRank(input);
  assert.equal(out[0].percentile, 100);
});

test("bumpAttendance present increments both", () => {
  const cur = { sessionsAttended: 2, sessionsTotal: 3, attendancePct: 67 };
  const nxt = bumpAttendance(cur, "present");
  assert.deepEqual(nxt, { sessionsAttended: 3, sessionsTotal: 4, attendancePct: 75 });
});

test("bumpAttendance late counts as attended", () => {
  const cur = { sessionsAttended: 0, sessionsTotal: 0, attendancePct: 0 };
  const nxt = bumpAttendance(cur, "late");
  assert.deepEqual(nxt, { sessionsAttended: 1, sessionsTotal: 1, attendancePct: 100 });
});

test("bumpAttendance absent increments total only", () => {
  const cur = { sessionsAttended: 4, sessionsTotal: 5, attendancePct: 80 };
  const nxt = bumpAttendance(cur, "absent");
  assert.deepEqual(nxt, { sessionsAttended: 4, sessionsTotal: 6, attendancePct: 67 });
});