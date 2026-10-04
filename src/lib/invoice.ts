import type { Batch, Invoice, Payment, Student } from "./types";

export type InvoiceState = "draft" | "sent" | "partial" | "paid" | "overdue";

export function invoiceStatus(invoice: Invoice, payments: Payment[], now = new Date()): InvoiceState {
  if (invoice.status === "draft") return "draft";
  const paid = payments.filter((p) => p.invoiceId === invoice.id).reduce((s, p) => s + p.amount, 0);
  if (paid <= 0) return new Date(invoice.dueDate) < now ? "overdue" : "sent";
  if (paid >= invoice.amount) return "paid";
  return "partial";
}

export function balance(invoice: Invoice, payments: Payment[]) {
  const paid = payments.filter((p) => p.invoiceId === invoice.id).reduce((s, p) => s + p.amount, 0);
  return Math.max(0, invoice.amount - paid);
}

export function paidFor(invoiceId: string, payments: Payment[]) {
  return payments.filter((p) => p.invoiceId === invoiceId).reduce((s, p) => s + p.amount, 0);
}

const money = (n: number) => `INR ${n.toLocaleString("en-IN")}`;
export { money };

export function daysOverdue(invoice: Invoice, payments: Payment[], now = new Date()) {
  if (invoiceStatus(invoice, payments, now) !== "overdue") return 0;
  return Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / 86400000);
}

/**
 * Message for a WhatsApp fee reminder. Kept in one place so the wording, the
 * balance, and the deep link never disagree.
 *
 * Phones must be in E.164 with no +, spaces, or dashes — wa.me silently fails
 * otherwise. Indian numbers are 10 digits; the caller supplies the country code.
 */
export function buildFeeReminder(options: {
  student: Student;
  invoice: Invoice;
  balance: number;
  daysOverdue: number;
  academyName: string;
  whatsappNumber?: string;
  batch?: Batch;
}) {
  const { student, invoice, balance: due, daysOverdue, academyName, whatsappNumber, batch } = options;
  const name = student.name || "there";
  const urgency = daysOverdue > 0 ? ` (${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue)` : "";

  const lines = [
    `Hello ${name}, this is a friendly reminder from ${academyName}.`,
    `Invoice ${invoice.invoiceNumber} for ${new Date(invoice.month - 1, 0).toLocaleString("en", { month: "long" })} ${invoice.year}${batch ? ` — ${batch.name}` : ""} has a pending balance of ${money(due)}${urgency}.`,
    "Please clear it at your convenience. Reply to this message if you need help.",
    `Thank you, ${academyName}`,
  ];

  const text = lines.join("\n\n");
  const phone = (student.parentPhone || student.phone || "").replace(/\D/g, "");
  // ponytail: no number stored means no deep link; the admin still sees the text
  // to copy. Wiring an SMS gateway later means replacing this one branch.
  const url = whatsappNumber && phone
    ? `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`
    : null;

  return { text, url, phone };
}