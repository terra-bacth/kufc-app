"use client";
import { useMemo } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query } from "firebase/firestore";
import type { Payment, Student } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PaymentsPage() {
  useRequireRole("admin", "student");
  const { userData } = useAuth();
  const isAdmin = userData?.role === "admin";
  const { data: all = [] } = useCollection<Payment>(query(collection(db, "payments")));
  const { data: students = [] } = useCollection<Student>(query(collection(db, "students")));

  const mine = useMemo(() => {
    if (isAdmin) return all;
    const ids = new Set(students.filter((s) => s.userId === userData?.id).map((s) => s.id));
    if (userData?.linkedEntityId) ids.add(userData.linkedEntityId);
    return all.filter((p) => ids.has(p.studentId));
  }, [all, isAdmin, students, userData]);

  const total = mine.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Payment History</h1>
        <p className="text-sm text-muted-foreground">Collected: {total}</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mine
                .slice()
                .sort((a, b) => new Date(b.paidDate).getTime() - new Date(a.paidDate).getTime())
                .map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{new Date(p.paidDate).toLocaleDateString()}</TableCell>
                    <TableCell>{students.find((s) => s.id === p.studentId)?.name || p.studentId}</TableCell>
                    <TableCell>{p.amount}</TableCell>
                    <TableCell><Badge variant="secondary">{p.method}</Badge></TableCell>
                    <TableCell>{p.receiptUrl ? <a className="underline" href={p.receiptUrl} target="_blank" rel="noreferrer">View</a> : "—"}</TableCell>
                  </TableRow>
                ))}
              {mine.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">No payments recorded.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}