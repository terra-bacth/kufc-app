"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import type { Student, Batch } from "@/lib/types";
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
import { useRequireRole } from "@/lib/guard";
import { toast } from "sonner";

export default function StudentsPage() {
  useRequireRole("admin");
  const { data: students = [] } = useCollection<Student>(query(collection(db, "students")));
  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [batchId, setBatchId] = useState("");
  const [branchId, setBranchId] = useState("");

  function reset() {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setParentPhone("");
    setBatchId("");
    setBranchId("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const b = batches.find((x) => x.id === batchId);
    try {
      if (editing) {
        await updateDocument("students", editing.id, { name: name.trim(), email: email.trim(), phone: phone.trim(), parentPhone: parentPhone.trim(), batchId, branchId: b?.branchId || branchId });
        toast.success("Student updated");
      } else {
        await addDocument("students", { name: name.trim(), email: email.trim(), phone: phone.trim(), parentPhone: parentPhone.trim(), batchId, branchId: b?.branchId || branchId, status: "active", joiningDate: new Date(), createdAt: new Date() });
        toast.success("Student created");
      }
      setOpen(false);
      reset();
    } catch {
      toast.error("Failed to save");
    }
  }

  async function handleDelete(s: Student) {
    if (!confirm("Delete this student?")) return;
    try {
      await deleteDocument("students", s.id);
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Students</h1>
        <Button onClick={() => { reset(); setOpen(true); }}>Add Student</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.email}</TableCell>
                  <TableCell>{s.phone}</TableCell>
                  <TableCell>{s.parentPhone}</TableCell>
                  <TableCell>{batches.find((x) => x.id === s.batchId)?.name || s.batchId}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(s); setName(s.name); setEmail(s.email); setPhone(s.phone); setParentPhone(s.parentPhone || ""); setBatchId(s.batchId); setBranchId(s.branchId); setOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(s)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Student" : "Add Student"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Input placeholder="Parent Phone" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
            <Select value={batchId} onValueChange={(v) => setBatchId(v || "")} required>
              <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
              <SelectContent>{batches.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
            </Select>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
