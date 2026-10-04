import type { UserRole } from "@/lib/types";

export const ACADEMY = {
  name: "KUFC Coaching Academy",
  instagram: "__kaizenutd__",
  instagramUrl: "https://www.instagram.com/__kaizenutd__/",
} as const;

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
  // Coaches mark attendance; students read their own calendar. Different pages
  // because the write path and the read path have different rules.
  { label: "Mark attendance", href: "/attendance", roles: ["admin", "coach"], adminOnly: false },
  { label: "My attendance", href: "/my-attendance", roles: ["student"], adminOnly: false },
  { label: "Leaves", href: "/leaves", roles: ["admin", "coach", "student"], adminOnly: false },
  { label: "Materials", href: "/materials", roles: ["admin", "coach", "student"], adminOnly: false },
  { label: "Tests", href: "/tests", roles: ["admin", "coach", "student"], adminOnly: false },
  { label: "Invoices", href: "/invoices", roles: ["admin", "student"], adminOnly: false },
  { label: "Payments", href: "/payments", roles: ["admin", "student"], adminOnly: false },
  // The reports page aggregates the whole academy, so it stays admin-only.
  { label: "My progress", href: "/my-report", roles: ["student"], adminOnly: false },
  { label: "Reports", href: "/reports", roles: ["admin"], adminOnly: true },
];