"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query } from "firebase/firestore";
import type { Invoice, Notification, Payment, Student } from "@/lib/types";
import { balance, invoiceStatus, money } from "@/lib/invoice";
import { deriveNotifications, sortNewest, unreadCount } from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "cn";

// ponytail: dismissals live in localStorage, not Firestore. A student clearing a
// badge on their own phone does not need a write round-trip or a read rule.
// Swap for a user/{uid}/dismissed subcollection if it must follow them across
// devices.
const KEY = "kufc-dismissed-notifications";

function readDismissed(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function NotificationsBell() {
  const { userData } = useAuth();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: invoices = [] } = useCollection<Invoice>(query(collection(db, "invoices")));
  const { data: payments = [] } = useCollection<Payment>(query(collection(db, "payments")));
  const { data: students = [] } = useCollection<Student>(query(collection(db, "students")));

  const notices = useMemo(() => {
    const myId = userData?.linkedEntityId || userData?.id;
    const myStudentIds = new Set(students.filter((s) => s.userId === userData?.id).map((s) => s.id));
    if (myId) myStudentIds.add(myId);

    const mine = invoices.filter((i) => myStudentIds.has(i.studentId));
    return sortNewest(
      mine.flatMap((invoice) =>
        deriveNotifications({
          kind: "fee",
          referenceId: invoice.id,
          referenceDate: invoice.createdAt,
          paid: invoiceStatus(invoice, payments) === "paid",
          dueDate: new Date(invoice.dueDate),
          balance: balance(invoice, payments),
          title: `Invoice ${invoice.invoiceNumber}`,
          detail: `${money(balance(invoice, payments))} outstanding · due ${new Date(invoice.dueDate).toLocaleDateString()}`,
        }),
      ),
    );
  }, [invoices, payments, students, userData]);

  const visible = notices.filter((n) => !dismissed.includes(n.id));
  const unread = unreadCount(notices, dismissed);

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !loaded) {
          setDismissed(readDismissed());
          setLoaded(true);
        }
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label={`Notifications, ${unread} unread`} />}>
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
        </div>
        <ul className="max-h-80 overflow-auto">
          {visible.map((n) => (
            <li key={n.id}>
              <Link
                href="/invoices"
                onClick={() => {
                  // Clear on open rather than adding an X target for a thumb.
                  setDismissed((p) => {
                    const next = [...new Set([...p, n.id])];
                    localStorage.setItem(KEY, JSON.stringify(next));
                    return next;
                  });
                  setOpen(false);
                }}
                className={cn(
                  "block border-b px-4 py-3 text-sm last:border-b-0 hover:bg-accent",
                  n.severity === "overdue" && "border-l-2 border-l-destructive",
                  n.severity === "due" && "border-l-2 border-l-amber-500",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{n.title}</span>
                  <Badge variant={n.severity === "overdue" ? "destructive" : "secondary"}>
                    {n.severity}
                  </Badge>
                </div>
                <p className="text-muted-foreground">{n.body}</p>
              </Link>
            </li>
          ))}
          {visible.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              {notices.length === 0 ? "Nothing due soon." : "All caught up."}
            </li>
          )}
        </ul>
        <div className="border-t px-4 py-2">
          <Button variant="ghost" size="sm" className="w-full" render={<Link href="/invoices" />}>
            View invoices
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}