"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useRequireRole } from "@/lib/guard";
import { collection, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Batch, Student, User } from "@/lib/types";
import { resolveStudentBatch } from "@/lib/student-approval";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDocument, updateDocument } from "@/lib/firebase/firestore";
import { toast } from "sonner";

export default function ApprovalsPage() {
  useRequireRole("admin");
  const q = useMemo(() => query(collection(db, "users"), where("status", "==", "pending")), []);
  const { data: pending = [] } = useCollection<User>(q);
  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));

  // Per-user manual override, set when a code is missing or wrong. Not persisted:
  // it only matters for the approve click that follows.
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function approve(u: User, overrideBatchId?: string) {
    const resolution = resolveStudentBatch(u, batches);
    let batch: Batch | undefined;

    if (resolution.kind === "coach") {
      // Coaches have no batch; approve as-is.
    } else {
      batch = overrideBatchId
        ? batches.find((b) => b.id === overrideBatchId && b.status === "active")
        : resolution.kind === "code" ? resolution.batch : undefined;
      if (!batch) {
        toast.error("Pick the batch for this student first.");
        return;
      }
    }

    setBusy(u.id);
    try {
      if (batch) {
        // Doc id is the auth uid, so linkedEntityId == uid and the rules resolve
        // it without a second lookup.
        await addDocument("students", {
          name: u.displayName,
          email: u.email,
          phone: u.phone ?? "",
          userId: u.id,
          batchId: batch.id,
          branchId: batch.branchId,
          status: "active",
          joiningDate: new Date(),
          createdAt: new Date(),
        } as Omit<Student, "id">);
      }
      await updateDocument("users", u.id, {
        status: "active",
        ...(batch ? { linkedEntityId: u.id } : {}),
      });
      setChosen((p) => { const next = { ...p }; delete next[u.id]; return next; });
      toast.success(batch ? `${u.displayName} approved into ${batch.name}` : `${u.displayName} approved`);
    } catch {
      toast.error("Failed to approve");
    } finally {
      setBusy(null);
    }
  }

  async function reject(u: User) {
    try {
      await updateDocument("users", u.id, { status: "rejected" });
      toast.success(`${u.displayName} rejected`);
    } catch {
      toast.error("Failed to reject");
    }
  }

  const activeBatches = batches.filter((b) => b.status === "active");

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
                <TableHead>Requested batch</TableHead>
                <TableHead>Assign to</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((u) => {
                const resolution = resolveStudentBatch(u, batches);
                const codeMatched = resolution.kind === "code";
                const options = resolution.kind === "needs-choice" ? resolution.batch : activeBatches;
                const needsPick = u.role === "student" && !codeMatched;
                return (
                  <TableRow key={u.id}>
                    <TableCell>{u.displayName}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.phone}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell>
                      {u.role === "student" ? (
                        codeMatched ? (
                          <Badge variant="secondary">{resolution.batch.name}</Badge>
                        ) : (
                          <span className="text-destructive">
                            {u.requestedBatchCode ? `unmatched "${u.requestedBatchCode}"` : "no code given"}
                          </span>
                        )
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {u.role === "student" && (
                        <Select
                          value={chosen[u.id] ?? (codeMatched ? resolution.batch.id : "")}
                          onValueChange={(v) => setChosen((p) => ({ ...p, [u.id]: v || "" }))}
                        >
                          <SelectTrigger aria-label={`Batch for ${u.displayName}`}>
                            <SelectValue placeholder={needsPick ? "Pick batch" : "Change"} />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((b) => (
                              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                            ))}
                            {options.length === 0 && <SelectItem value="" disabled>No active batches</SelectItem>}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        size="sm"
                        disabled={busy === u.id || (u.role === "student" && activeBatches.length === 0)}
                        onClick={() => approve(u, chosen[u.id])}
                      >
                        {busy === u.id ? "Approving..." : "Approve"}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => reject(u)}>Reject</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">Nothing waiting for approval.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}