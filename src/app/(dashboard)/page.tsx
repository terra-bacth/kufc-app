"use client";
import { useAuth } from "@/contexts/auth-context";

export default function DashboardPage() {
  const { userData } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Welcome, {userData?.displayName}</h1>
      <p className="text-sm text-muted-foreground">Role: {userData?.role}</p>
    </div>
  );
}
