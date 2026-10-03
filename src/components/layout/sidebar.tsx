"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/contexts/auth-context";

export function Sidebar() {
  const { role } = useAuth();
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex flex-col w-64 border-r min-h-screen">
      <div className="h-12 px-4 flex items-center font-semibold">KUFC Academy</div>
      <nav className="flex-1 px-2 space-y-1">
        {NAV_ITEMS.filter((item) => (role ? item.roles.includes(role) : false)).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn("block px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === item.href && "bg-accent")}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
