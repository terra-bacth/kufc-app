"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signOutUser } from "@/lib/firebase/auth";
import { useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function PendingApprovalPage() {
  const { user, userData, loading, error } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (userData?.status === "active") router.replace("/");
  }, [user, userData, loading, router]);
  const message = error || (userData?.status === "rejected" ? "Your registration was rejected. Contact the academy." : userData?.status === "inactive" ? "Your account is inactive. Contact the academy." : !userData && !loading ? "Your profile is missing. Contact the academy to complete registration." : "Your account is under review. This page updates when an admin approves it.");
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Account status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          {message}
        </p>
        <Button className="w-full" variant="outline" onClick={() => { signOutUser().catch(() => toast.error("Could not sign out.")); }}>
          Sign out
        </Button>
      </CardContent>
    </Card>
  );
}
