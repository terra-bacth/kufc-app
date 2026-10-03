"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/contexts/auth-context";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, userData, loading, error } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const route = NAV_ITEMS.find((item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href + "/")));
  const allowed = !route || (!!userData && route.roles.includes(userData.role));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!error && userData?.status !== "active") {
      router.replace("/pending-approval");
      return;
    }
    if (!allowed) router.replace("/");
  }, [loading, user, userData, router, allowed, error]);

  if (error) return <p role="alert" className="p-6">{error}</p>;

  if (loading || !user || userData?.status !== "active" || !allowed) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
