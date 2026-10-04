"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useDocument } from "@/lib/hooks/use-document";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, doc, query, where, writeBatch } from "firebase/firestore";
import type { AttendanceStatus, Batch, Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function AttendancePage() {
  useRequireRole("admin", "coach");
  const { userData } = useAuth();
  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));
  const allowed = useMemo(
    () => batches.filter((b) => userData?.role === "admin" || b.coachId === userData?.id || b.coachId === userData?.linkedEntityId),
    [batches, userData],
  );

  const [batchId, setBatchId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});

  const { data: students = [] } = useCollection<Student>(
    useMemo(() => (batchId ? query(collection(db, "students"), where("batchId", "==", batchId)) : null), [batchId]),
  );
  const { data: saved } = useDocument<{ students?: Record<string, AttendanceStatus> }>(
    `attendance/${batchId}/records/${date}`,
    batchId ? date : null,
  );
  const statusFor = (id: string) => marks[id] ?? saved?.students?.[id];

  async function save() {
    if (!batchId) return toast.error("Select a batch");
    const entries = Object.entries(marks);
    if (entries.length === 0) return toast.error("Mark at least one student before saving");
    try {
      // Session doc plus one doc per student, in a single atomic batch. The
      // per-student docs are what a student is allowed to read; the session doc
      // holds the whole class and stays admin/coach-only.
      const markedAt = new Date();
      const markedBy = userData?.id ?? "";
      const batch = writeBatch(db);

      batch.set(
        doc(db, "attendance", batchId, "records", date),
        { batchId, date, markedBy, markedAt, students: marks, coachPresent: true },
        { merge: true },
      );
      for (const [studentId, status] of entries) {
        batch.set(
          doc(db, "attendance", batchId, "records", date, "entries", studentId),
          { studentId, batchId, date, status, markedBy, markedAt },
          { merge: true },
        );
      }
      await batch.commit();
      toast.success(`Attendance saved for ${entries.length} student(s)`);
    } catch {
      toast.error("Could not save attendance");
    }
  }

  const bulk = (status: AttendanceStatus) => setMarks(Object.fromEntries(students.map((s) => [s.id, status])));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Attendance</h1>
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={batchId} onValueChange={(v) => { setBatchId(v || ""); setMarks({}); }}>
              <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
              <SelectContent>{allowed.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => bulk("present")}>All present</Button>
            <Button variant="outline" onClick={() => bulk("absent")}>All absent</Button>
          </div>
          <ul className="divide-y">
            {students.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span>{s.name}</span>
                <Select
                  value={statusFor(s.id) ?? ""}
                  onValueChange={(v) => setMarks((p) => ({ ...p, [s.id]: (v || "absent") as AttendanceStatus }))}
                >
                  <SelectTrigger className="w-32"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
          {batchId && <Button onClick={save}>Save attendance</Button>}
        </CardContent>
      </Card>
    </div>
  );
}