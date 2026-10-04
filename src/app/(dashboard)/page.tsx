"use client";
import { useMemo } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where } from "firebase/firestore";
import type { Batch, Branch, Invoice, Payment, Student, User } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export default function DashboardPage() {
  const { userData, role } = useAuth();
  const isAdmin = role === "admin";

  const { data: branches = [] } = useCollection<Branch>(isAdmin ? query(collection(db, "branches")) : null);
  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));
  const { data: students = [] } = useCollection<Student>(query(collection(db, "students")));
  const { data: coaches = [] } = useCollection<User>(isAdmin ? query(collection(db, "users"), where("role", "==", "coach")) : null);
  const { data: pending = [] } = useCollection<User>(isAdmin ? query(collection(db, "users"), where("status", "==", "pending")) : null);
  const { data: invoices = [] } = useCollection<Invoice>(query(collection(db, "invoices")));
  const { data: payments = [] } = useCollection<Payment>(query(collection(db, "payments")));

  const outstanding = useMemo(() => {
    if (role !== "student") return null;
    const myIds = new Set(students.filter((s) => s.userId === userData?.id).map((s) => s.id));
    if (userData?.linkedEntityId) myIds.add(userData.linkedEntityId);
    return invoices
      .filter((i) => myIds.has(i.studentId))
      .reduce((sum, i) => sum + Math.max(0, i.amount - payments.filter((p) => p.invoiceId === i.id).reduce((s, p) => s + p.amount, 0)), 0);
  }, [role, students, invoices, payments, userData]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Welcome, {userData?.displayName}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin && <Stat label="Branches" value={branches.length} href="/branches" />}
        <Stat label="Batches" value={batches.length} href="/batches" />
        {isAdmin && <Stat label="Students" value={students.length} href="/students" />}
        {isAdmin && <Stat label="Coaches" value={coaches.length} href="/coaches" />}
        {isAdmin && <Stat label="Pending approvals" value={pending.length} href="/approvals" />}
        {role === "student" && outstanding !== null && <Stat label="Outstanding fees" value={outstanding} href="/invoices" />}
        {role === "student" && (
          <>
            <Stat label="My attendance" value="—" href="/my-attendance" />
            <Stat label="My progress" value="—" href="/my-report" />
          </>
        )}
        {role !== "student" && (
          <>
            <Stat label="Attendance" value="—" href="/attendance" />
            <Stat label="Leaves" value="—" href="/leaves" />
            <Stat label="Materials" value="—" href="/materials" />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="min-h-11">
      <Card className="h-full transition-colors hover:bg-accent">
        <CardContent>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}