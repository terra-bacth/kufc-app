"use client";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireRole(...allowed: ("admin" | "coach" | "student")[]) {
  const { role, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!role || !allowed.includes(role)) router.replace("/");
  }, [allowed, loading, role, router]);
}
