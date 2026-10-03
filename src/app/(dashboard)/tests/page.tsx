"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useDocument } from "@/lib/hooks/use-document";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, doc, query, setDoc, where } from "firebase/firestore";
import { addDocument, updateDocument } from "@/lib/firebase/firestore";
import type { Batch, Student, Test } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function TestsPage() {
  useRequireRole("admin", "coach", "student");
  const { userData } = useAuth();
  const canWrite = userData?.role === "admin" || userData?.role === "coach";
  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));
  const { data: students = [] } = useCollection<Student>(query(collection(db, "students")));
  const { data: tests = [] } = useCollection<Test>(query(collection(db, "tests")));

  const [title, setTitle] = useState("");
  const [batchId, setBatchId] = useState("");
  const [totalMarks, setTotalMarks] = useState(100);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scoresFor, setScoresFor] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});

  const activeTest = useMemo(() => tests.find((t) => t.id === scoresFor) ?? null, [tests, scoresFor]);
  const batchStudents = useMemo(
    () => (activeTest ? students.filter((s) => s.batchId === activeTest.batchId) : []),
    [students, activeTest],
  );
  const { data: savedScores } = useDocument<{ scores?: Record<string, number> }>(
    `testScores/${scoresFor}/scores/${scoresFor}`,
    scoresFor,
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("Title is required");
    if (!batchId) return toast.error("Choose a batch");
    if (!Number.isInteger(totalMarks) || totalMarks <= 0) return toast.error("Total marks must be a positive whole number");
    try {
      await addDocument("tests", {
        title: title.trim(),
        batchId,
        totalMarks,
        date: new Date(date),
        createdBy: userData?.id ?? "",
        status: date > new Date().toISOString().slice(0, 10) ? "upcoming" : "completed",
        createdAt: new Date(),
      });
      setTitle("");
      toast.success("Test created");
    } catch {
      toast.error("Could not create test");
    }
  }

  async function saveScores() {
    if (!activeTest) return;
    for (const [studentId, value] of Object.entries(marks)) {
      if (!Number.isInteger(value) || value < 0 || value > activeTest.totalMarks) {
        return toast.error("Marks must be whole numbers within the total");
      }
      await setDoc(doc(db, "testScores", activeTest.id, "scores", studentId), { studentId, marksObtained: value }, { merge: true });
    }
    await updateDocument("tests", activeTest.id, { status: "completed" });
    toast.success("Scores saved");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Tests & Exams</h1>

      {canWrite && (
        <Card>
          <CardContent>
            <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t">Title</Label>
                <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <Select value={batchId} onValueChange={(v) => setBatchId(v || "")}>
                <SelectTrigger><SelectValue placeholder="Batch" /></SelectTrigger>
                <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="space-y-2">
                <Label htmlFor="m">Total marks</Label>
                <Input id="m" type="number" value={totalMarks} onChange={(e) => setTotalMarks(Number(e.target.value))} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="d">Date</Label>
                <Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="sm:col-span-2"><Button type="submit">Create test</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {tests.map((t) => (
          <li key={t.id}>
            <Card>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{t.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {batches.find((b) => b.id === t.batchId)?.name || t.batchId} · {t.totalMarks} marks · {t.status}
                    </p>
                  </div>
                  {canWrite && (
                    <Button size="sm" variant="outline" onClick={() => { setScoresFor(scoresFor === t.id ? null : t.id); setMarks({}); }}>
                      {scoresFor === t.id ? "Close" : "Enter scores"}
                    </Button>
                  )}
                </div>
                {scoresFor === t.id && (
                  <div className="space-y-2">
                    <ul className="divide-y">
                      {batchStudents.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 py-1">
                          <span className="text-sm">{s.name}</span>
                          <Input
                            type="number"
                            className="w-24"
                            value={marks[s.id] ?? savedScores?.scores?.[s.id] ?? ""}
                            onChange={(e) => setMarks((p) => ({ ...p, [s.id]: Number(e.target.value) }))}
                          />
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" onClick={saveScores}>Save scores</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
        {tests.length === 0 && <li className="text-sm text-muted-foreground">No tests yet.</li>}
      </ul>
    </div>
  );
}