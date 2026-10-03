"use client";
import { useMemo } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useRequireRole } from "@/lib/guard";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Batch, Student, User } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { addDocument, updateDocument } from "@/lib/firebase/firestore";
import { toast } from "sonner";

export default function ApprovalsPage() {
  useRequireRole("admin");
  const q = useMemo(() => query(collection(db, "users"), where("status", "==", "pending")), []);
  const { data: pending = [] } = useCollection<User>(q);
  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));

  async function approve(u: User) {
    try {
      // A student is only useful once their batch is known, so resolve the code
      // to a real batch and create their students/{uid} record. Using the uid as
      // the doc id means linkedEntityId == uid, which the rules read directly.
      let batchId: string | undefined;
      if (u.role === "student") {
        const code = u.requestedBatchCode;
        const match = code ? batches.find((b) => b.code === code) : undefined;
        if (!match) {
          toast.error(`No batch matches code "${code ?? ""}". Ask the student for the right code, or edit the record.`);
          return;
        }
        batchId = match.id;
        await addDocument("students", {
          name: u.displayName,
          email: u.email,
          phone: u.phone ?? "",
          userId: u.id,
          batchId,
          branchId: match.branchId,
          status: "active",
          joiningDate: new Date(),
          createdAt: new Date(),
        } as Omit<Student, "id">);
      }
      await updateDocument("users", u.id, {
        status: "active",
        ...(batchId ? { linkedEntityId: u.id } : {}),
      });
      toast.success(`${u.displayName} approved${batchId ? ` into ${batches.find((b) => b.id === batchId)?.name}` : ""}`);
    } catch {
      toast.error("Failed to approve");
    }
  }

  async function reject(u: User) {
    try {
      await updateDocument("users", u.id, { status: "rejected" });
      toast.success("User rejected");
    } catch {
      toast.error("Failed to reject");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Pending Approvals</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.displayName}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.phone}</TableCell>
                  <TableCell>{u.role}</TableCell>
                  <TableCell>
                    {u.role === "student"
                      ? (batches.find((b) => b.code === u.requestedBatchCode)?.name
                          ?? <span className="text-destructive">unknown code {u.requestedBatchCode ?? "—"}</span>)
                      : "—"}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button size="sm" onClick={() => approve(u)}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => reject(u)}>Reject</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
