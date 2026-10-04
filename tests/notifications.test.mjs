import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveNotifications, unreadCount, sortNewest, UPCOMING_DAYS } from "../src/lib/notifications.ts";

const base = {
  kind: "fee",
  referenceId: "i1",
  referenceDate: new Date("2026-01-01"),
  balance: 1000,
  title: "Invoice INV-1",
  detail: "January fee",
};

const TODAY = new Date("2026-01-20");

test("a paid invoice produces no notice", () => {
  assert.deepEqual(
    deriveNotifications({ ...base, paid: true, dueDate: new Date("2026-01-10") }, TODAY),
    [],
  );
});

test("an invoice due in the future beyond the window is silent", () => {
  const notices = deriveNotifications({
    ...base, paid: false,
    dueDate: new Date(`2026-01-${20 + UPCOMING_DAYS + 1}T00:00:00`),
  }, TODAY);
  assert.deepEqual(notices, []);
});

test("an overdue invoice is flagged overdue", () => {
  const [notice] = deriveNotifications({ ...base, paid: false, dueDate: new Date("2026-01-10") }, TODAY);
  assert.equal(notice.severity, "overdue");
  assert.match(notice.title, /overdue/);
});

test("an invoice due today says today, not in zero days", () => {
  const [notice] = deriveNotifications({ ...base, paid: false, dueDate: new Date("2026-01-20T00:00:00") }, TODAY);
  assert.match(notice.title, /due today/);
});

test("singular day wording at one day out", () => {
  const [notice] = deriveNotifications({ ...base, paid: false, dueDate: new Date("2026-01-21T00:00:00") }, TODAY);
  assert.match(notice.title, /in 1 day\b/);
  assert.doesNotMatch(notice.title, /1 days/);
});

test("a zero balance is never nagged about even when unpaid", () => {
  assert.deepEqual(
    deriveNotifications({ ...base, paid: false, balance: 0, dueDate: new Date("2026-01-01") }, TODAY),
    [],
  );
});

test("notice ids are stable and distinct per reference", () => {
  const a = deriveNotifications({ ...base, paid: false, dueDate: new Date("2026-01-10") }, TODAY)[0];
  const b = deriveNotifications({ ...base, referenceId: "i2", paid: false, dueDate: new Date("2026-01-10") }, TODAY)[0];
  const again = deriveNotifications({ ...base, paid: false, dueDate: new Date("2026-01-10") }, TODAY)[0];
  assert.equal(a.id, again.id, "same input must yield the same id so dismissal sticks");
  assert.notEqual(a.id, b.id);
});

test("unreadCount ignores dismissed ids", () => {
  const notices = deriveNotifications({ ...base, paid: false, dueDate: new Date("2026-01-10") }, TODAY);
  assert.equal(unreadCount(notices, []), notices.length);
  assert.equal(unreadCount(notices, [notices[0].id]), 0);
  assert.equal(unreadCount(notices, ["nonexistent"]), notices.length);
});

test("sortNewest returns newest first without mutating the input", () => {
  const notices = [
    { id: "old", kind: "fee", referenceId: "a", title: "t", body: "b", date: new Date("2026-01-01"), severity: "due" },
    { id: "new", kind: "fee", referenceId: "b", title: "t", body: "b", date: new Date("2026-02-01"), severity: "due" },
  ];
  const sorted = sortNewest(notices);
  assert.equal(sorted[0].id, "new");
  assert.equal(notices[0].id, "old", "input must not be reordered in place");
});