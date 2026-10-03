"use client";
import { useState, useMemo } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import type { Batch, Branch, Coach } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
import { collection, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/contexts/auth-context";
import { useRequireRole } from "@/lib/guard";
import { validateBatch, generateBatchCode, normalizeBatchCode, validateBatchCode } from "@/lib/academy-validation";
import { toast } from "sonner";

export default function BatchesPage() {
  useRequireRole("admin", "coach", "student");
  const { role, userData } = useAuth();
  const batchesQuery = useMemo(() => {
    if (role === "admin") return query(collection(db, "batches"));
    if (role === "coach" && userData?.linkedEntityId) return query(collection(db, "batches")); // filter client-side
    if (role === "student") return query(collection(db, "batches")); // filter client-side
    return null;
  }, [role, userData]);
  const { data: batches = [] } = useCollection<Batch>(batchesQuery);
  const { data: branches = [] } = useCollection<Branch>(query(collection(db, "branches")));
  const { data: coaches = [] } = useCollection<Coach>(query(collection(db, "coaches")));

  const visibleBatches = useMemo(() => {
    if (role === "admin") return batches;
    if (role === "coach" && userData?.linkedEntityId) return batches.filter((b) => b.coachId === userData.linkedEntityId);
    // ponytail: student view filtered later if batchId known; keep minimal
    return batches;
  }, [batches, role, userData]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Batch | null>(null);
  const [name, setName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [sport, setSport] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");
  const [monthlyFee, setMonthlyFee] = useState(1000);

  function reset() {
    setEditing(null);
    setName("");
    setBranchId("");
    setCoachId("");
    setSport("");
    setDays([]);
    setStartTime("16:00");
    setEndTime("17:00");
    setMonthlyFee(1000);
  }

  function toggleDay(d: string) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(a) - ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(b))));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name, branchId, coachId, sport, days, startTime, endTime, monthlyFee };
    const v = validateBatch(payload);
    if (v) {
      toast.error(v);
      return;
    }
    try {
      if (editing) {
        await updateDocument("batches", editing.id, payload);
        toast.success("Batch updated");
      } else {
        // Regenerate until unused: 31^6 is large, but "create" can be retried fast.
        let code = generateBatchCode();
        for (let i = 0; i < 5 && batches.some((b) => b.code === code); i++) code = generateBatchCode();
        await addDocument("batches", { ...payload, code, status: "active", createdAt: new Date() });
        toast.success(`Batch created — join code ${code}`);
      }
      setOpen(false);
      reset();
    } catch {
      toast.error("Failed to save batch");
    }
  }

  async function regenerateCode(batchId: string) {
    if (!confirm("New join code? The old one stops working immediately.")) return;
    let code = generateBatchCode();
    for (let i = 0; i < 5 && batches.some((b) => b.code === code); i++) code = generateBatchCode();
    try {
      await updateDocument("batches", batchId, { code });
      toast.success(`New code: ${code}`);
    } catch {
      toast.error("Could not regenerate code");
    }
  }

  async function handleDelete(b: Batch) {
    if (!confirm("Delete this batch?")) return;
    try {
      await deleteDocument("batches", b.id);
      toast.success("Batch deleted");
    } catch {
      toast.error("Failed to delete batch");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Batches</h1>
        {role === "admin" && <Button onClick={() => { reset(); setOpen(true); }}>Add Batch</Button>}
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Coach</TableHead>
                <TableHead>Sport</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Fee</TableHead>
                {role === "admin" && <TableHead>Join code</TableHead>}
                {role === "admin" && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleBatches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{branches.find((x) => x.id === b.branchId)?.name || b.branchId}</TableCell>
                  <TableCell>{coaches.find((x) => x.id === b.coachId)?.name || b.coachId}</TableCell>
                  <TableCell>{b.sport}</TableCell>
                  <TableCell>{b.schedule.days.join(", ")}</TableCell>
                  <TableCell>{b.schedule.startTime}–{b.schedule.endTime}</TableCell>
                  <TableCell>{b.monthlyFee}</TableCell>
                  {role === "admin" && <TableCell className="font-mono">{b.code}</TableCell>}
                  {role === "admin" && (
                    <TableCell className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditing(b); setName(b.name); setBranchId(b.branchId); setCoachId(b.coachId); setSport(b.sport); setDays(b.schedule.days); setStartTime(b.schedule.startTime); setEndTime(b.schedule.endTime); setMonthlyFee(b.monthlyFee); setOpen(true); }}>Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => regenerateCode(b.id)}>New code</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(b)}>Delete</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {role === "admin" && (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Batch" : "Add Batch"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={(v) => setBranchId(v || "")} required>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>{branches.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Coach</Label>
                <Select value={coachId} onValueChange={(v) => setCoachId(v || "")} required>
                  <SelectTrigger><SelectValue placeholder="Select coach" /></SelectTrigger>
                  <SelectContent>{coaches.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sport</Label>
                <Input value={sport} onChange={(e) => setSport(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Days</Label>
                <div className="flex flex-wrap gap-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <Button type="button" key={d} variant={days.includes(d) ? "default" : "outline"} size="sm" onClick={() => toggleDay(d)}>{d}</Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Monthly Fee (paise/rupees integer)</Label>
                <Input type="number" value={monthlyFee} onChange={(e) => setMonthlyFee(parseInt(e.target.value) || 0)} required />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
