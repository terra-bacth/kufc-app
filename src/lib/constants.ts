import type { UserRole } from "@/lib/types";

export const NAV_ITEMS: {
  label: string;
  href: string;
  roles: UserRole[];
  adminOnly: boolean;
}[] = [
  { label: "Dashboard", href: "/", roles: ["admin", "coach", "student"], adminOnly: false },
  { label: "Branches", href: "/branches", roles: ["admin"], adminOnly: true },
  { label: "Batches", href: "/batches", roles: ["admin", "coach", "student"], adminOnly: false },
  { label: "Students", href: "/students", roles: ["admin"], adminOnly: true },
  { label: "Coaches", href: "/coaches", roles: ["admin"], adminOnly: true },
  { label: "Approvals", href: "/approvals", roles: ["admin"], adminOnly: true },
  { label: "Attendance", href: "/attendance", roles: ["admin", "coach", "student"], adminOnly: false },
  { label: "Leaves", href: "/leaves", roles: ["admin", "coach", "student"], adminOnly: false },
  { label: "Materials", href: "/materials", roles: ["admin", "coach", "student"], adminOnly: false },
  { label: "Tests", href: "/tests", roles: ["admin", "coach", "student"], adminOnly: false },
  { label: "Invoices", href: "/invoices", roles: ["admin", "student"], adminOnly: false },
  { label: "Payments", href: "/payments", roles: ["admin", "student"], adminOnly: false },
  { label: "Reports", href: "/reports", roles: ["admin"], adminOnly: true },
];
