"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query } from "firebase/firestore";
import { addDocument, updateDocument } from "@/lib/firebase/firestore";
import type { Batch, Invoice, Payment, Student } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const due = (iso: string) => new Date(iso + "T23:59:59");

function deriveStatus(amount: number, paid: number, dueDate: Date, base: Invoice["status"]): Invoice["status"] {
  if (base === "draft") return "draft";
  if (paid <= 0) return dueDate < new Date() ? "overdue" : "sent";
  if (paid >= amount) return "paid";
  return "partial";
}

export default function InvoicesPage() {
  useRequireRole("admin", "student");
  const { userData } = useAuth();
  const isAdmin = userData?.role === "admin";
  const { data: students = [] } = useCollection<Student>(query(collection(db, "students")));
  const { data: batches = [] } = useCollection<Batch>(query(collection(db, "batches")));
  const { data: invoices = [] } = useCollection<Invoice>(query(collection(db, "invoices")));
  const { data: payments = [] } = useCollection<Payment>(query(collection(db, "payments")));

  const mine = useMemo(() => {
    const myId = userData?.linkedEntityId || userData?.id;
    const myStudents = students.filter((s) => s.userId === userData?.id).map((s) => s.id);
    return isAdmin ? invoices : invoices.filter((i) => i.studentId === myId || myStudents.includes(i.studentId));
  }, [invoices, students, isAdmin, userData]);

  const paidFor = (invoiceId: string) => payments.filter((p) => p.invoiceId === invoiceId).reduce((sum, p) => sum + p.amount, 0);

  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);

  async function generate() {
    const m = Number(month);
    const y = Number(year);
    if (!(m >= 1 && m <= 12) || !Number.isInteger(y)) return toast.error("Pick a valid month and year");
    const target = students.filter((s) => s.status === "active");
    if (target.length === 0) return toast.error("No active students to invoice");
    setBusy(true);
    try {
      const already = new Set(invoices.filter((i) => i.month === m && i.year === y).map((i) => i.studentId));
      let created = 0;
      for (const s of target) {
        if (already.has(s.id)) continue;
        const batch = batches.find((b) => b.id === s.batchId);
        if (!batch) continue;
        await addDocument("invoices", {
          studentId: s.id,
          batchId: batch.id,
          invoiceNumber: `INV-${y}${m}-${s.id.slice(0, 6).toUpperCase()}`,
          month: m,
          year: y,
          amount: batch.monthlyFee,
          dueDate: new Date(y, m, 10),
          status: "sent",
          lineItems: [{ description: `${batch.name} — ${month}/${year}`, amount: batch.monthlyFee }],
          createdAt: new Date(),
        });
        created++;
      }
      toast.success(created ? `${created} invoice(s) generated` : "All students already invoiced this month");
    } catch {
      toast.error("Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment(invoiceId: string) {
    if (!Number.isInteger(amount) || amount <= 0) return toast.error("Enter a positive whole amount");
    try {
      await addDocument("payments", {
        invoiceId,
        studentId: invoices.find((i) => i.id === invoiceId)?.studentId ?? "",
        amount,
        paidDate: new Date(),
        method: "cash",
        createdAt: new Date(),
      });
      setPayFor(null);
      setAmount(0);
      toast.success("Payment recorded");
    } catch {
      toast.error("Could not record payment");
    }
  }

  const outstanding = mine.reduce((sum, i) => sum + Math.max(0, i.amount - paidFor(i.id)), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <p className="text-sm text-muted-foreground">Outstanding: {outstanding}</p>
      </div>

      {isAdmin && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-medium">Generate monthly invoices</h2>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="m">Month</Label>
                <Input id="m" type="number" min={1} max={12} className="w-24" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="y">Year</Label>
                <Input id="y" type="number" className="w-28" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <Button onClick={generate} disabled={busy}>Generate</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {mine.map((i) => {
          const paid = paidFor(i.id);
          const status = deriveStatus(i.amount, paid, new Date(i.dueDate), i.status);
          return (
            <li key={i.id}>
              <Card>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{students.find((s) => s.id === i.studentId)?.name || i.studentId}</p>
                      <p className="text-sm text-muted-foreground">{i.invoiceNumber} · {i.month}/{i.year} · due {due(String(i.dueDate).slice(0, 10)).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={status === "overdue" ? "destructive" : "secondary"}>{status}</Badge>
                  </div>
                  <p className="text-sm">{i.amount} · paid {paid} · balance {Math.max(0, i.amount - paid)}</p>
                  {isAdmin && (
                    payFor === i.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-2">
                          <Label htmlFor={`a-${i.id}`}>Amount</Label>
                          <Input id={`a-${i.id}`} type="number" className="w-28" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                        </div>
                        <Button size="sm" onClick={() => recordPayment(i.id)}>Save payment</Button>
                        <Button size="sm" variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setPayFor(i.id)}>Record payment</Button>
                    )
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
        {mine.length === 0 && <li className="text-sm text-muted-foreground">No invoices yet.</li>}
      </ul>
    </div>
  );
}