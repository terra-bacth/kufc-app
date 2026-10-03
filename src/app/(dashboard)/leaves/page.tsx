"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where } from "firebase/firestore";
import { addDocument, updateDocument } from "@/lib/firebase/firestore";
import type { Leave } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const statusVariant = { pending: "secondary", approved: "default", rejected: "destructive" } as const;

export default function LeavesPage() {
  useRequireRole("admin", "coach", "student");
  const { userData } = useAuth();
  const isAdmin = userData?.role === "admin";
  const { data: all = [] } = useCollection<Leave>(query(collection(db, "leaves")));
  const visible = useMemo(
    () => (isAdmin ? all : all.filter((l) => l.requesterId === userData?.id || l.requesterId === userData?.linkedEntityId)),
    [all, isAdmin, userData],
  );

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function request() {
    if (!fromDate || !toDate) return toast.error("Pick both dates");
    if (toDate < fromDate) return toast.error("End date must be on or after start date");
    setBusy(true);
    try {
      await addDocument("leaves", {
        requestedBy: userData?.displayName ?? "",
        requesterType: userData?.role === "coach" ? "coach" : "student",
        requesterId: userData?.linkedEntityId || userData?.id || "",
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        reason: reason.trim(),
        status: "pending",
        createdAt: new Date(),
      });
      setFromDate("");
      setToDate("");
      setReason("");
      toast.success("Leave requested");
    } catch {
      toast.error("Could not submit request");
    } finally {
      setBusy(false);
    }
  }

  async function review(id: string, status: "approved" | "rejected") {
    try {
      await updateDocument("leaves", id, { status, reviewedBy: userData?.id, reviewedAt: new Date() });
      toast.success(`Request ${status}`);
    } catch {
      toast.error("Could not update request");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Leaves</h1>

      {!isAdmin && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-medium">Request leave</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea id="reason" rows={3} value={reason} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)} />
            </div>
            <Button onClick={request} disabled={busy}>Submit request</Button>
          </CardContent>
        </Card>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {visible.map((l) => (
          <li key={l.id}>
            <Card>
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{l.requestedBy}</p>
                    <p className="text-sm text-muted-foreground">{l.requesterType}</p>
                  </div>
                  <Badge variant={statusVariant[l.status]}>{l.status}</Badge>
                </div>
                <p className="text-sm">
                  {l.fromDate instanceof Date ? l.fromDate.toLocaleDateString() : String(l.fromDate)}
                  {" → "}
                  {l.toDate instanceof Date ? l.toDate.toLocaleDateString() : String(l.toDate)}
                </p>
                {l.reason && <p className="text-sm text-muted-foreground">{l.reason}</p>}
                {isAdmin && l.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => review(l.id, "approved")}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => review(l.id, "rejected")}>Reject</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
        {visible.length === 0 && <li className="text-sm text-muted-foreground">No leave requests.</li>}
      </ul>
    </div>
  );
}