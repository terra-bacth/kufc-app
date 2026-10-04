"use client";
import { useMemo, useState } from "react";
import { collectionGroup, query, where } from "firebase/firestore";
import { useCollection } from "@/lib/hooks/use-collection";
import { useDocument } from "@/lib/hooks/use-document";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import type { AttendanceEntry, AttendanceStatus, Student } from "@/lib/types";
import { buildMonthGrid, monthLabel, summarise, toKey, WEEK_ORDER, WEEKDAY_INITIALS } from "@/lib/attendance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

const CELL_STYLE: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500 text-white",
  late: "bg-amber-500 text-white",
  absent: "bg-destructive text-white",
};

export default function MyAttendancePage() {
  useRequireRole("student");
  const { userData } = useAuth();
  const studentId = userData?.linkedEntityId ?? "";

  const { data: me } = useDocument<Student>("students", studentId || null);
  const batchId = me?.batchId ?? "";

  // collectionGroup so the student gets their own entries across every batch and
  // date in one query. The rules allow only entries whose id is their own.
  const entriesQuery = useMemo(
    () => (studentId ? query(collectionGroup(db, "entries"), where("studentId", "==", studentId)) : null),
    [studentId],
  );
  const { data: entries = [] } = useCollection<AttendanceEntry>(entriesQuery);

  const byDate = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    for (const e of entries) map[e.date] = e.status;
    return map;
  }, [entries]);

  const now = new Date();
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });

  const grid = useMemo(() => buildMonthGrid(cursor.year, cursor.month, byDate), [cursor, byDate]);
  const stats = useMemo(() => summarise(byDate), [byDate]);

  const shift = (delta: number) => {
    const d = new Date(cursor.year, cursor.month - 1 + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const marked = entries
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">My Attendance</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attendance" value={`${stats.percent}%`} />
        <Stat label="Sessions" value={stats.total} />
        <Stat label="Present" value={stats.attended} />
        <Stat label="Absent" value={stats.absent} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous month">‹</Button>
            <CardTitle>{monthLabel(cursor.year, cursor.month)}</CardTitle>
            <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Next month">›</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEK_ORDER.map((d, i) => <div key={d} className="py-1">{WEEKDAY_INITIALS[i]}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell) => (
              <div
                key={cell.key}
                aria-label={cell.day === null ? undefined : `${cell.key}${cell.status ? ` ${cell.status}` : ""}`}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md text-sm",
                  cell.day === null && "invisible",
                  cell.status && CELL_STYLE[cell.status],
                  !cell.status && cell.day !== null && cell.isFuture && "text-muted-foreground/40",
                  cell.isToday && !cell.status && "ring-2 ring-primary",
                )}
              >
                {cell.day}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <Legend className="bg-emerald-500" label="Present" />
            <Legend className="bg-amber-500" label="Late" />
            <Legend className="bg-destructive" label="Absent" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent sessions</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y">
            {marked.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span>{e.date}</span>
                <Badge variant={e.status === "absent" ? "destructive" : "secondary"}>{e.status}</Badge>
              </li>
            ))}
            {marked.length === 0 && <li className="py-2 text-sm text-muted-foreground">No sessions recorded yet.</li>}
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

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-sm", className)} aria-hidden />
      {label}
    </span>
  );
}