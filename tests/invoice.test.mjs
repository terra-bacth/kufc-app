import { test } from "node:test";
import assert from "node:assert/strict";
import { invoiceStatus, balance, paidFor, daysOverdue, buildFeeReminder } from "../src/lib/invoice.ts";

const invoice = (over = {}) => ({
  id: "i1", studentId: "s1", batchId: "b1", invoiceNumber: "INV-1",
  month: 1, year: 2026, amount: 1000, dueDate: new Date("2026-01-10"),
  status: "sent", lineItems: [], createdAt: new Date(), ...over,
});

const payment = (amount, invoiceId = "i1") => ({
  id: `p${amount}`, invoiceId, studentId: "s1", amount,
  paidDate: new Date("2026-01-05"), method: "cash", createdAt: new Date(),
});

const student = (over = {}) => ({
  id: "s1", name: "Asha", email: "a@a.test", phone: "9876543210",
  parentPhone: "9123456789", batchId: "b1", branchId: "br1",
  status: "active", joiningDate: new Date(), createdAt: new Date(), ...over,
});

const NOW = new Date("2026-01-20");

test("status is sent before the due date, overdue after", () => {
  assert.equal(invoiceStatus(invoice(), [], new Date("2026-01-05")), "sent");
  assert.equal(invoiceStatus(invoice(), [], NOW), "overdue");
});

test("status is partial between nothing and full, then paid", () => {
  assert.equal(invoiceStatus(invoice(), [payment(400)], NOW), "partial");
  assert.equal(invoiceStatus(invoice(), [payment(1000)], NOW), "paid");
  // Overpayment must not produce a negative balance or a weird state.
  assert.equal(invoiceStatus(invoice(), [payment(1200)], NOW), "paid");
  assert.equal(balance(invoice(), [payment(1200)]), 0);
});

test("a draft stays a draft regardless of payment", () => {
  assert.equal(invoiceStatus(invoice({ status: "draft" }), [payment(1000)], NOW), "draft");
});

test("balance and paidFor only count the given invoice", () => {
  const payments = [payment(300), payment(200, "other")];
  assert.equal(paidFor("i1", payments), 300);
  assert.equal(balance(invoice(), payments), 700);
});

test("daysOverdue is zero unless overdue, and counts whole days", () => {
  assert.equal(daysOverdue(invoice(), [], new Date("2026-01-05")), 0);
  assert.equal(daysOverdue(invoice(), [], NOW), 10);
  assert.equal(daysOverdue(invoice(), [payment(1000)], NOW), 0);
  assert.equal(daysOverdue(invoice({ status: "draft" }), [], NOW), 0);
});

test("reminder text names the balance and does not go negative", () => {
  const { text } = buildFeeReminder({
    student: student(), invoice: invoice(), balance: 600, daysOverdue: 10,
    academyName: "KUFC", batch: { name: "Batch A" },
  });
  assert.match(text, /Asha/);
  assert.match(text, /INR 600/);
  assert.match(text, /10 days overdue/);
  assert.match(text, /Batch A/);
  // A negative or NaN balance is the failure this guards.
  assert.doesNotMatch(text, /INR -|NaN|Infinity/);
});

test("reminder is singular for one day overdue", () => {
  const { text } = buildFeeReminder({
    student: student(), invoice: invoice(), balance: 100, daysOverdue: 1,
    academyName: "KUFC",
  });
  assert.match(text, /1 day overdue/);
});

test("wa.me link uses parent phone and strips formatting", () => {
  const { url } = buildFeeReminder({
    student: student({ parentPhone: "+91 91234-56789" }), invoice: invoice(),
    balance: 1000, daysOverdue: 0, academyName: "KUFC", whatsappNumber: "+91 90000 00000",
  });
  assert.match(url, /^https:\/\/wa\.me\/919000000000\?text=/);
  // Must not leak raw digits into a malformed URL.
  assert.ok(!url.includes("+"));
});

test("reminder falls back to the student's own phone when no parent phone", () => {
  const { url, phone } = buildFeeReminder({
    student: student({ parentPhone: undefined }), invoice: invoice(),
    balance: 1000, daysOverdue: 0, academyName: "KUFC", whatsappNumber: "919000000000",
  });
  assert.equal(phone, "9876543210");
  assert.match(url, /^https:\/\/wa\.me\//);
});

test("no link is produced without a number, but the text is still copyable", () => {
  const { url, text } = buildFeeReminder({
    student: student({ parentPhone: "", phone: "" }), invoice: invoice(),
    balance: 1000, daysOverdue: 0, academyName: "KUFC", whatsappNumber: "919000000000",
  });
  assert.equal(url, null);
  assert.match(text, /INR 1,000/);
});

test("reminder works with no academy WhatsApp number configured", () => {
  const { url, text } = buildFeeReminder({
    student: student(), invoice: invoice(), balance: 1000, daysOverdue: 0, academyName: "KUFC",
  });
  assert.equal(url, null);
  assert.match(text, /KUFC/);
});