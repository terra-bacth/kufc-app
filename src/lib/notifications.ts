import type { Notification, NotificationKind } from "./types";

/** Shown when an invoice is created and its due date is within this many days. */
export const UPCOMING_DAYS = 7;

/**
 * Derives in-app notifications from invoices a student can actually see.
 *
 * Computed rather than stored: a stored notification would need to be written,
 * marked read, and expired, and would still go stale when an invoice is paid or
 * rescheduled. Deriving it means the badge can never disagree with the invoice.
 * Push delivery (FCM) is a separate concern — see AGENTS.md.
 */
export function deriveNotifications(input: {
  kind: NotificationKind;
  referenceId: string;
  referenceDate: Date;
  paid: boolean;
  dueDate: Date;
  balance: number;
  title: string;
  detail: string;
}, today = new Date()): Notification[] {
  const notices: Notification[] = [];

  if (input.kind === "fee" && !input.paid && input.balance > 0) {
    const daysLeft = Math.ceil((input.dueDate.getTime() - today.getTime()) / 86400000);
    if (daysLeft < 0) {
      notices.push({
        id: `${input.kind}-${input.referenceId}-overdue`,
        kind: input.kind,
        referenceId: input.referenceId,
        title: `${input.title} is overdue`,
        body: input.detail,
        date: input.dueDate,
        severity: "overdue",
      });
    } else if (daysLeft <= UPCOMING_DAYS) {
      notices.push({
        id: `${input.kind}-${input.referenceId}-due`,
        kind: input.kind,
        referenceId: input.referenceId,
        title: daysLeft === 0 ? `${input.title} is due today` : `${input.title} due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
        body: input.detail,
        date: input.dueDate,
        severity: "due",
      });
    }
  }

  // Attendance: low attendance percentage triggers a reminder.
  if (input.kind === "attendance" && typeof input.balance === "number" && input.balance < 60) {
    notices.push({
      id: `${input.kind}-${input.referenceId}-low`,
      kind: input.kind,
      referenceId: input.referenceId,
      title: `Attendance is low: ${Math.round(input.balance)}%`,
      body: input.detail,
      date: input.dueDate,
      severity: "due",
    });
  }

  // Test result: a new score is available.
  if (input.kind === "test" && input.paid === true && input.balance > 0) {
    notices.push({
      id: `${input.kind}-${input.referenceId}-new`,
      kind: input.kind,
      referenceId: input.referenceId,
      title: `New result: ${input.title}`,
      body: input.detail,
      date: input.referenceDate,
      severity: "due",
    });
  }

  return notices;
}

export function unreadCount(notices: Notification[], dismissed: string[]) {
  return notices.filter((n) => !dismissed.includes(n.id)).length;
}

export function sortNewest(notices: Notification[]) {
  return notices.slice().sort((a, b) => b.date.getTime() - a.date.getTime());
}