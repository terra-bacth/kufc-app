"use client";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import Link from "next/link";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/contexts/auth-context";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { useState } from "react";

export function MobileNav() {
  const { role } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="md:hidden" render={<Button variant="ghost" aria-label="Open navigation" />}>
          <Menu className="size-4" />
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-64">
        <SheetTitle className="px-4 pt-4">KUFC Academy</SheetTitle>
        <SheetDescription className="sr-only">Academy navigation</SheetDescription>
        <nav className="px-2 space-y-1">
          {NAV_ITEMS.filter((item) => (role ? item.roles.includes(role) : false)).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cn("block px-2 py-1.5 rounded-md text-sm hover:bg-accent", pathname === item.href && "bg-accent")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
