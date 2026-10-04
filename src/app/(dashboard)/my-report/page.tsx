"use client";
import { useMemo } from "react";
import { collectionGroup, query, where } from "firebase/firestore";
import { useCollection } from "@/lib/hooks/use-collection";
import { useDocument } from "@/lib/hooks/use-document";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import type { AttendanceEntry, Batch, Student, Test, TestScore } from "@/lib/types";
import { percentageOf, summarise, testIdFromScorePath } from "@/lib/attendance";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

export default function MyReportPage() {
  useRequireRole("student");
  const { userData } = useAuth();
  const studentId = userData?.linkedEntityId ?? "";

  const { data: me } = useDocument<Student>("students", studentId || null);
  const { data: batches = [] } = useCollection<Batch>(query(collectionGroup(db, "batches")));
  const batchName = batches.find((b) => b.id === me?.batchId)?.name ?? "your batch";

  const { data: entries = [] } = useCollection<AttendanceEntry>(
    useMemo(
      () => (studentId ? query(collectionGroup(db, "entries"), where("studentId", "==", studentId)) : null),
      [studentId],
    ),
  );

  // Score docs are keyed by student id, so a collection group filtered on it
  // returns only this student's marks across every test.
  const { data: scores = [] } = useCollection<TestScore & { id: string }>(
    useMemo(
      () => (studentId ? query(collectionGroup(db, "scores"), where("studentId", "==", studentId)) : null),
      [studentId],
    ),
  );
  const { data: tests = [] } = useCollection<Test>(query(collectionGroup(db, "tests")));

  const attendance = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of entries) map[e.date] = e.status;
    return summarise(map as never);
  }, [entries]);

  const rows = useMemo(() => {
    return scores
      .map((s) => ({ score: s, test: tests.find((t) => t.id === testIdFromScorePath(s.path)) }))
      .filter((r) => r.test)
      .sort((a, b) => new Date(b.test!.date).getTime() - new Date(a.test!.date).getTime());
  }, [scores, tests]);

  const chart = rows
    .filter((r) => r.test)
    .slice(0, 10)
    .reverse()
    .map((r) => ({
      name: r.test!.title.length > 10 ? `${r.test!.title.slice(0, 9)}…` : r.test!.title,
      pct: percentageOf(r.score.marksObtained, r.test!.totalMarks),
    }));

  const overall = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + percentageOf(r.score.marksObtained, r.test!.totalMarks), 0) / rows.length)
    : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My Progress</h1>
      <p className="text-sm text-muted-foreground">{batchName} · {me?.name ?? userData?.displayName}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attendance" value={`${attendance.percent}%`} />
        <Stat label="Tests taken" value={rows.length} />
        <Stat label="Average score" value={`${overall}%`} />
        <Stat label="Sessions attended" value={attendance.attended} />
      </div>

      <Card>
        <CardHeader><CardTitle>Score trend</CardTitle></CardHeader>
        <CardContent>
          {chart.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scores recorded yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={12} interval={0} />
                  <YAxis domain={[0, 100]} unit="%" fontSize={12} width={40} />
                  <Bar dataKey="pct" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Test results</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rows.map(({ score, test }) => (
              <li key={score.id} className="space-y-1 py-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{test!.title}</span>
                  <span>{score.marksObtained}/{test!.totalMarks}</span>
                </div>
                <Progress value={percentageOf(score.marksObtained, test!.totalMarks)} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(test!.date).toLocaleDateString()}</span>
                  <Badge variant={percentageOf(score.marksObtained, test!.totalMarks) >= 40 ? "secondary" : "destructive"}>
                    {percentageOf(score.marksObtained, test!.totalMarks)}%
                  </Badge>
                </div>
              </li>
            ))}
            {rows.length === 0 && <li className="py-2 text-sm text-muted-foreground">No results yet.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}