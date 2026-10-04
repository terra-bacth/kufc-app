"use client";
import { useMemo } from "react";
import { collection, collectionGroup, query, where } from "firebase/firestore";
import { useCollection } from "@/lib/hooks/use-collection";
import { useDocument } from "@/lib/hooks/use-document";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import type { AttendanceEntry, Batch, Student, StudentRollup, Test, TestScore } from "@/lib/types";
import { percentageOf, summarise, testIdFromScorePath } from "@/lib/attendance";
import { ACADEMY } from "@/lib/constants";
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
  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));
  const batchName = batches.find((b) => b.id === me?.batchId)?.name ?? "your batch";
  const { data: rollup } = useDocument<StudentRollup | null>(`rollups/${me?.batchId}/students/${studentId}`, me?.batchId && studentId ? studentId : null);

  const rankLabel = rollup && rollup.rank
    ? `#${rollup.rank} (${rollup.percentile}% of batch)`
    : "—";

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
  const { data: tests = [] } = useCollection<Test>(query(collection(db, "tests")));

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Progress</h1>
        <ReportCardPrint
          student={me}
          batchName={batchName}
          stats={{ attendance: { ...attendance, percent: attendance.percent }, tests: rows.length, avg: overall, rank: rankLabel }}
          rows={rows}
        />
      </div>
      <p className="text-sm text-muted-foreground">{batchName} · {me?.name ?? userData?.displayName}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attendance" value={`${attendance.percent}%`} />
        <Stat label="Tests taken" value={rows.length} />
        <Stat label="Average score" value={`${overall}%`} />
        <Stat label="Sessions attended" value={attendance.attended} />
        <Stat label="Batch rank" value={rankLabel} />
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

function ReportCardPrint({ student, batchName, stats, rows }: {
  student?: Student;
  batchName: string;
  stats: {
    attendance: { percent: number; attended: number; total: number };
    tests: number;
    avg: number;
    rank: string;
  };
  rows: { score: any; test?: any }[];
}) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${batchName} report card</title>
<style>
  body{font:14px/1.5 system-ui,sans-serif;margin:40px;color:#111}
  h1{margin:0 0 2px;font-size:20px}
  .muted{color:#666}
  .row{display:flex;justify-content:space-between;margin:24px 0}
  .total{font-weight:700;font-size:16px}
  @media print{body{margin:0}}
</style></head><body>
<h1>${batchName}</h1>
<div class="muted">Instagram: @${ACADEMY.instagram}</div>
<div class="row">
  <div><strong>Student:</strong> ${student?.name ?? "Anonymous"}</div>
  <div><strong>Batch:</strong> ${batchName}</div>
</div>
<div class="row">
  <div><strong>Attendance:</strong> ${stats.attendance.percent}% (${stats.attendance.attended}/${stats.attendance.total})</div>
  <div><strong>Tests:</strong> ${stats.tests}</div>
  <div><strong>Average:</strong> ${stats.avg}%</div>
  <div><strong>Rank:</strong> ${stats.rank}</div>
</div>
<table><thead><tr><th>Test</th><th>Score</th><th>Mark / Total</th></tr></thead><tbody>
${rows.map((r) => `<tr><td>${r.test?.title ?? "—"}</td><td style="text-align:right">${r.score?.marksObtained ?? 0}/${r.test?.totalMarks ?? 0}</td></tr>`).join("")}
<tr><td class="total">Average</td><td style="text-align:right">${stats.avg}%</td></tr>
</tbody></table>
<p style="font-size:10px;color:#999;margin-top:24px">Generated ${new Date().toLocaleDateString()} · ${ACADEMY.name}</p>
</body></html>`;
  function print() {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }
  return <Button size="sm" variant="outline" onClick={print}>Report card PDF</Button>;
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