"use client";
import { useMemo, useState } from "react";
import { useCollection } from "@/lib/hooks/use-collection";
import { useRequireRole } from "@/lib/guard";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query } from "firebase/firestore";
import { addDocument } from "@/lib/firebase/firestore";
import type { Batch, Invoice, Payment, Student } from "@/lib/types";
import { balance, buildFeeReminder, daysOverdue, invoiceStatus, money } from "@/lib/invoice";
import { ACADEMY as ACADEMY_CONST } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const ACADEMY = ACADEMY_CONST;

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

  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [busy, setBusy] = useState(false);
  const [payFor, setPayFor] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [remindFor, setRemindFor] = useState<string | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const reminder = useMemo(() => {
    if (!remindFor) return null;
    const invoice = invoices.find((i) => i.id === remindFor);
    if (!invoice) return null;
    return buildFeeReminder({
      student: students.find((s) => s.id === invoice.studentId)!,
      invoice,
      balance: balance(invoice, payments),
      daysOverdue: daysOverdue(invoice, payments),
      academyName: ACADEMY.name,
      batch: batches.find((b) => b.id === invoice.batchId),
      whatsappNumber: whatsappNumber || undefined,
    });
  }, [remindFor, invoices, students, batches, payments, whatsappNumber]);

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

  const outstanding = mine.reduce((sum, i) => sum + balance(i, payments), 0);
  const overdueCount = mine.filter((i) => invoiceStatus(i, payments) === "overdue").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Invoices</h1>
        <div className="text-sm text-muted-foreground">
          Outstanding: {money(outstanding)}
          {overdueCount > 0 && <span className="text-destructive"> · {overdueCount} overdue</span>}
        </div>
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
              <div className="space-y-2">
                <Label htmlFor="wa">Academy WhatsApp (with country code)</Label>
                <Input
                  id="wa"
                  placeholder="919000000000"
                  className="w-56"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ul className="grid gap-3 md:grid-cols-2">
        {mine.map((i) => {
          const student = students.find((s) => s.id === i.studentId);
          const due = balance(i, payments);
          const status = invoiceStatus(i, payments);
          return (
            <li key={i.id}>
              <Card>
                <CardContent className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{student?.name || i.studentId}</p>
                      <p className="text-sm text-muted-foreground">
                        {i.invoiceNumber} · {i.month}/{i.year} · due {new Date(i.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={status === "overdue" ? "destructive" : "secondary"}>{status}</Badge>
                  </div>
                  <p className="text-sm">
                    {money(i.amount)} · paid {money(i.amount - due)} · balance{" "}
                    <span className={due > 0 ? "font-medium" : ""}>{money(due)}</span>
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <InvoicePrint invoice={i} student={student} batch={batches.find((b) => b.id === i.batchId)} due={due} />
                    {isAdmin && due > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setRemindFor(i.id)}>Remind on WhatsApp</Button>
                    )}
                  </div>

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

      <Dialog open={!!reminder} onOpenChange={(v) => !v && setRemindFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fee reminder</DialogTitle>
            <DialogDescription>
              {reminder?.url
                ? "Send it from your WhatsApp, or copy the text below."
                : "No student phone or academy WhatsApp number yet — copy the text below."}
            </DialogDescription>
          </DialogHeader>
          {reminder && (
            <>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{reminder.text}</pre>
              <DialogFooter>
                <Button variant="outline" onClick={() => navigator.clipboard?.writeText(reminder.text).then(() => toast.success("Copied"))}>
                  Copy text
                </Button>
                {reminder.url && (
                  <Button render={<a href={reminder.url} target="_blank" rel="noreferrer" />}>Open WhatsApp</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Prints the browser's own print dialog to produce a PDF. A PDF library would be
 * ~200KB and would still not match the app's styling; the browser renderer is
 * already there and prints vector text.
 */
function InvoicePrint({ invoice, student, batch, due }: {
  invoice: Invoice;
  student?: Student;
  batch?: Batch;
  due: number;
}) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${invoice.invoiceNumber}</title>
<style>
  body{font:14px/1.5 system-ui,sans-serif;margin:40px;color:#111}
  h1{margin:0 0 2px;font-size:20px} .muted{color:#666}
  .row{display:flex;justify-content:space-between;margin:24px 0}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{text-align:left;padding:8px 4px;border-bottom:1px solid #ddd}
  .total{font-weight:700;font-size:16px}
  @media print{body{margin:0}}
</style></head><body>
<h1>${ACADEMY.name}</h1>
<p class="muted">Instagram: @${ACADEMY.instagram}</p>
<div class="row">
  <div><strong>Invoice</strong><br>${invoice.invoiceNumber}<br>
  ${new Date(invoice.month - 1, 0).toLocaleString("en", { month: "long" })} ${invoice.year}<br>
  Due ${new Date(invoice.dueDate).toLocaleDateString()}</div>
  <div><strong>Billed to</strong><br>${student?.name ?? "Student"}<br>
  ${batch?.name ?? ""}${batch?.sport ? ` · ${batch.sport}` : ""}<br>
  ${student?.phone ?? ""}</div>
</div>
<table><thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>
${invoice.lineItems.map((li) => `<tr><td>${li.description}</td><td style="text-align:right">${money(li.amount)}</td></tr>`).join("")}
<tr><td class="total">Total</td><td class="total" style="text-align:right">${money(invoice.amount)}</td></tr>
<tr><td>Balance due</td><td style="text-align:right">${money(due)}</td></tr>
</tbody></table>
<p class="muted">Generated ${new Date().toLocaleDateString()}. Please retain this invoice for your records.</p>
</body></html>`;

  function print() {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return toast.error("Allow popups to print, or use the browser's print menu.");
    w.document.write(html);
    w.document.close();
    w.focus();
    // Give the browser a beat to lay out before opening the print dialog.
    setTimeout(() => w.print(), 300);
  }

  return <Button size="sm" variant="outline" onClick={print}>Invoice PDF</Button>;
}