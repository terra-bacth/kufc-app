"use client";
import { useState, useMemo } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import type { Branch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
import { collection, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/contexts/auth-context";
import { useRequireRole } from "@/lib/guard";
import { toast } from "sonner";

export default function BranchesPage() {
  useRequireRole("admin");
  const { role } = useAuth();
  const branchesQuery = useMemo(() => role === "admin" ? query(collection(db, "branches")) : null, [role]);
  const { data: branches = [], loading } = useCollection<Branch>(branchesQuery);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  function reset() {
    setEditing(null);
    setName("");
    setAddress("");
    setContactPhone("");
    setContactEmail("");
  }

  function handleOpenCreate() {
    reset();
    setOpen(true);
  }

  function handleEdit(b: Branch) {
    setEditing(b);
    setName(b.name);
    setAddress(b.address);
    setContactPhone(b.contactPhone);
    setContactEmail(b.contactEmail);
    setOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) {
        await updateDocument("branches", editing.id, { name: name.trim(), address: address.trim(), contactPhone: contactPhone.trim(), contactEmail: contactEmail.trim() });
        toast.success("Branch updated");
      } else {
        await addDocument("branches", {
          name: name.trim(),
          address: address.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          status: "active",
          createdAt: new Date(),
        });
        toast.success("Branch created");
      }
      setOpen(false);
      reset();
    } catch {
      toast.error("Failed to save branch");
    }
  }

  async function handleDelete(b: Branch) {
    if (!confirm("Delete this branch?")) return;
    try {
      await deleteDocument("branches", b.id);
      toast.success("Branch deleted");
    } catch {
      toast.error("Failed to delete branch");
    }
  }

  if (loading) return <p>Loading...</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Branches</h1>
        <Button onClick={handleOpenCreate}>Add Branch</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{b.name}</TableCell>
                  <TableCell>{b.address}</TableCell>
                  <TableCell>{b.contactPhone}</TableCell>
                  <TableCell>{b.contactEmail}</TableCell>
                  <TableCell>{b.status}</TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(b)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(b)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={(v) => !v && reset() || setOpen(v)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Branch" : "Add Branch"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
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
