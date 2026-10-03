"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { updateDocument } from "@/lib/firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function ProfilePage() {
  const { userData, user } = useAuth();
  const [displayName, setDisplayName] = useState(userData?.displayName ?? "");
  const [phone, setPhone] = useState(userData?.phone ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!userData?.id) return;
    if (!displayName.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      await updateDocument("users", userData.id, { displayName: displayName.trim(), phone: phone.trim() });
      toast.success("Profile updated");
    } catch {
      toast.error("Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Details <Badge variant="secondary">{userData?.role}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ""} readOnly disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button onClick={save} disabled={busy}>Save changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}