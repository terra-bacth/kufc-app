"use client";
import { useMemo } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useRequireRole } from "@/lib/guard";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { User } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { updateDocument } from "@/lib/firebase/firestore";
import { toast } from "sonner";

export default function ApprovalsPage() {
  useRequireRole("admin");
  const q = useMemo(() => query(collection(db, "users"), where("status", "==", "pending")), []);
  const { data: pending = [] } = useCollection<User>(q);

  async function approve(u: User) {
    try {
      await updateDocument("users", u.id, { status: "active" });
      toast.success("User approved");
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
