import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMonthGrid, summarise, toKey, percentageOf, WEEK_ORDER } from "../src/lib/attendance.ts";

const TODAY = new Date(2026, 0, 15); // Thu 15 Jan 2026

test("toKey pads month and day so keys sort and compare as strings", () => {
  assert.equal(toKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(toKey(new Date(2026, 11, 31)), "2026-12-31");
  assert.equal(toKey(new Date(2026, 8, 9)), "2026-09-09");
});

test("grid starts on Monday, matching the stored day names", () => {
  const cells = buildMonthGrid(2026, 1, {}, TODAY);
  const filled = cells.filter((c) => c.day !== null);
  assert.equal(filled[0].key, "2026-01-01");
  // 1 Jan 2026 is a Thursday, Monday-first means it sits at index 3.
  assert.equal(cells.findIndex((c) => c.day === 1) % 7, WEEK_ORDER.indexOf("Thu"));
});

test("grid is always whole weeks and covers every day of the month", () => {
  for (const [y, m, expected] of [[2026, 1, 31], [2026, 2, 28], [2024, 2, 29], [2026, 4, 30]]) {
    const cells = buildMonthGrid(y, m, {}, TODAY);
    assert.equal(cells.length % 7, 0, `${y}-${m} not a whole number of weeks`);
    assert.equal(cells.filter((c) => c.day !== null).length, expected, `${y}-${m} wrong day count`);
  }
});

test("padding cells carry no day number so they render blank", () => {
  const cells = buildMonthGrid(2026, 1, {}, TODAY);
  for (const c of cells.filter((x) => x.day === null)) {
    assert.equal(c.status, undefined);
    assert.equal(c.isToday, false);
  }
});

test("statuses land on the right day", () => {
  const cells = buildMonthGrid(2026, 1, { "2026-01-07": "absent", "2026-01-09": "late", "2026-01-02": "present" }, TODAY);
  assert.equal(cells.find((c) => c.key === "2026-01-07").status, "absent");
  assert.equal(cells.find((c) => c.key === "2026-01-09").status, "late");
  assert.equal(cells.find((c) => c.key === "2026-01-01").status, undefined);
});

test("today is flagged exactly once, and future days are marked", () => {
  const cells = buildMonthGrid(2026, 1, {}, TODAY);
  assert.equal(cells.filter((c) => c.isToday).length, 1);
  assert.equal(cells.find((c) => c.isToday).key, "2026-01-15");
  assert.equal(cells.find((c) => c.key === "2026-01-20").isFuture, true);
  assert.equal(cells.find((c) => c.key === "2026-01-10").isFuture, false);
});

test("a day already marked present is not also treated as future", () => {
  // Regression: past marks must show, since a coach can mark a session days late.
  const cells = buildMonthGrid(2026, 1, { "2026-01-10": "present" }, TODAY);
  const cell = cells.find((c) => c.key === "2026-01-10");
  assert.equal(cell.isFuture, false);
  assert.equal(cell.status, "present");
});

test("summarise counts late as attended but reports it separately", () => {
  const s = summarise({ a: "present", b: "absent", c: "late", d: "present" });
  assert.deepEqual(s, { total: 4, attended: 3, absent: 1, late: 1, percent: 75 });
});

test("summarise on no records is 0%, not NaN", () => {
  const s = summarise({});
  assert.equal(s.percent, 0);
  assert.equal(s.total, 0);
  assert.equal(Number.isNaN(s.percent), false);
});

test("percentageOf guards a zero total", () => {
  assert.equal(percentageOf(0, 0), 0);
  assert.equal(percentageOf(18, 20), 90);
  assert.equal(percentageOf(20, 20), 100);
});