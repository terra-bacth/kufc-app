"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/lib/firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { deleteUser } from "firebase/auth";
import { validateBatchCode, normalizeBatchCode } from "@/lib/academy-validation";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"coach" | "student">("student");
  const [batchCode, setBatchCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (role === "student") {
      const codeError = validateBatchCode(batchCode);
      if (codeError) {
        toast.error(codeError);
        return;
      }
    }
    setLoading(true);
    try {
      const cred = await signUp(email, password);
      try {
      await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        displayName: name.trim(),
        phone: phone.trim(),
        role,
        status: "pending",
        // Kept for the admin to verify at approval. The batch itself is resolved
        // server-side on approval, never from this untrusted value.
        ...(role === "student" ? { requestedBatchCode: normalizeBatchCode(batchCode) } : {}),
        createdAt: serverTimestamp(),
      });
      } catch (error) {
        await deleteUser(cred.user).catch(() => {
          toast.error("Profile creation failed. Contact the academy before trying again.");
        });
        throw error;
      }
      router.push("/pending-approval");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to register";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Register</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Register as</Label>
            <div className="flex gap-2">
              <Button type="button" variant={role === "student" ? "default" : "outline"} onClick={() => setRole("student")} className="flex-1">
                Student
              </Button>
              <Button type="button" variant={role === "coach" ? "default" : "outline"} onClick={() => setRole("coach")} className="flex-1">
                Coach
              </Button>
            </div>
          </div>
          {role === "student" && (
            <div className="space-y-2">
              <Label htmlFor="batchCode">Batch join code</Label>
              <Input
                id="batchCode"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value.toUpperCase())}
                placeholder="e.g. K7M2QX"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={9}
                className="font-mono tracking-widest"
                required
              />
              <p className="text-xs text-muted-foreground">Ask your coach for the 6-character code. An admin still approves your account.</p>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
          <p className="text-sm text-center">
            Already have an account? <Link href="/login" className="underline">Login</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
