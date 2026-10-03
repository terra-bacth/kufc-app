"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import type { Coach, Batch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
import { collection, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useRequireRole } from "@/lib/guard";
import { toast } from "sonner";

export default function CoachesPage() {
  useRequireRole("admin");
  const { data: coaches = [] } = useCollection<Coach>(query(collection(db, "coaches")));
  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coach | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [branchIds, setBranchIds] = useState<string[]>([]);

  function reset() {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setUserId("");
    setSpecialization("");
    setBatchIds([]);
    setBranchIds([]);
  }

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await updateDocument("coaches", editing.id, { name: name.trim(), email: email.trim(), phone: phone.trim(), userId, specialization: specialization.trim(), batchIds, branchIds });
        toast.success("Coach updated");
      } else {
        await addDocument("coaches", { name: name.trim(), email: email.trim(), phone: phone.trim(), userId, specialization: specialization.trim(), batchIds, branchIds, status: "active", joiningDate: new Date(), createdAt: new Date() });
        toast.success("Coach created");
      }
      setOpen(false);
      reset();
    } catch {
      toast.error("Failed to save");
    }
  }

  async function handleDelete(c: Coach) {
    if (!confirm("Delete this coach?")) return;
    try {
      await deleteDocument("coaches", c.id);
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }

  const branchOptions = useMemo(() => Array.from(new Set(batches.map((b) => b.branchId))), [batches]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Coaches</h1>
        <Button onClick={() => { reset(); setOpen(true); }}>Add Coach</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Batches</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coaches.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell>{c.specialization}</TableCell>
                  <TableCell>{c.batchIds.length}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(c); setName(c.name); setEmail(c.email); setPhone(c.phone); setUserId(c.userId); setSpecialization(c.specialization); setBatchIds(c.batchIds); setBranchIds(c.branchIds); setOpen(true); }}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(c)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Coach" : "Add Coach"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Input placeholder="User ID (Firebase auth uid)" value={userId} onChange={(e) => setUserId(e.target.value)} required />
            <Input placeholder="Specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} required />
            <div className="space-y-2">
              <Label>Batches</Label>
              <div className="flex flex-wrap gap-2">
                {batches.map((b) => <Button type="button" key={b.id} size="sm" variant={batchIds.includes(b.id) ? "default" : "outline"} onClick={() => toggle(batchIds, setBatchIds, b.id)}>{b.name}</Button>)}
              </div>
            </div>
            <div className="space-y-2">
              <Label>User ID (link to approved account)</Label>
              <Input value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
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