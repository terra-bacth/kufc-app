"use client";
import { useMemo } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useRequireRole } from "@/lib/guard";
import { db } from "@/lib/firebase/config";
import { collectionGroup, query } from "firebase/firestore";
import type { AttendanceEntry, AttendanceRecord, Invoice, Payment, Student } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

type AnyRecord = AttendanceRecord & { id: string };

export default function ReportsPage() {
  useRequireRole("admin");
  const { data: students = [] } = useCollection<Student>(query(collection(db, "students")));
  const { data: invoices = [] } = useCollection<Invoice>(query(collection(db, "invoices")));
  const { data: payments = [] } = useCollection<Payment>(query(collection(db, "payments")));
    // Read per-student entries across every batch and session, then aggregate.
  // The admin is the only role that can read all entries; students see only
  // their own. This is the two-shape attendance model feeding the chart.
  const { data: entries = [] } = useCollection<AttendanceEntry>(
    query(collectionGroup(db, "entries")),
  );

  const perStudent = useMemo(() => {
    const tally = new Map<string, { present: number; total: number }>();
    for (const rec of entries) {
      const sid = rec.studentId;
      const row = tally.get(sid) ?? { present: 0, total: 0 };
      row.total += 1;
      if (rec.status === "present" || rec.status === "late") row.present += 1;
      tally.set(sid, row);
    }
    return students
      .map((s) => {
        const row = tally.get(s.id) ?? { present: 0, total: 0 };
        return { name: s.name, pct: row.total ? Math.round((row.present / row.total) * 100) : 0, sessions: row.total };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [entries, students]);

  const collected = payments.reduce((s, p) => s + p.amount, 0);
  const billed = invoices.reduce((s, i) => s + i.amount, 0);
  const overdue = invoices.filter((i) => new Date(i.dueDate) < new Date() && payments.filter((p) => p.invoiceId === i.id).reduce((s, p) => s + p.amount, 0) < i.amount).length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reports</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Billed" value={billed} />
        <Stat label="Collected" value={collected} />
        <Stat label="Overdue invoices" value={overdue} />
      </div>

      <Card>
        <CardHeader><CardTitle>Attendance % per student</CardTitle></CardHeader>
        <CardContent>
          <BarChart width={700} height={320} data={perStudent.slice(0, 15)}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" fontSize={12} interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis domain={[0, 100]} unit="%" fontSize={12} />
            <Bar dataKey="pct" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}