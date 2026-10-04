"use client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import { signOutUser } from "@/lib/firebase/auth";
import Link from "next/link";
import { MobileNav } from "./mobile-nav";
import { toast } from "sonner";
import { NotificationsBell } from "@/components/notifications-bell";

export function Header() {
  const { user, userData } = useAuth();
  return (
    <header className="h-12 border-b flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <MobileNav />
        <span className="md:hidden font-medium">KUFC</span>
      </div>
      <div className="flex items-center gap-1">
        <NotificationsBell />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" />}>
            {userData?.displayName || user?.email?.split("@")[0] || "User"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/profile" />}>Profile</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { signOutUser().catch(() => toast.error("Could not sign out. Try again.")); }}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    </header>
  );
}
