"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";
import { NAV, MOBILE_NAV } from "./nav-items";
import { cn } from "@/lib/utils";
import { logout } from "@/actions/auth";
import { ThemeToggle } from "./theme-toggle";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({ name, level }: { name: string; level: number }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <div className="flex items-center justify-between px-4 pb-2 pt-5">
        <Link href="/dashboard" className="flex items-baseline gap-2">
          <span className="font-serif text-2xl leading-none">Dusan</span>
          <span className="text-xs text-muted-foreground">OS</span>
        </Link>
        <span className="rounded-md bg-xp/15 px-1.5 py-0.5 text-[11px] font-semibold text-xp tabular">Lv {level}</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="px-2 pb-1 text-[11px] text-muted-foreground/70">{g.group}</p>
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  isActive(pathname, i.href) && "bg-secondary font-medium text-foreground",
                )}
              >
                <i.icon className="size-4" />
                {i.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="flex items-center justify-between border-t px-3 py-3">
        <span className="truncate text-sm">{name}</span>
        <div className="flex items-center">
          <ThemeToggle />
          <form action={logout}>
            <button className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="grid grid-cols-5">
        {MOBILE_NAV.map((i) => (
          <Link key={i.href} href={i.href} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground", isActive(pathname, i.href) && "text-primary")}>
            <i.icon className="size-5" />
            {i.label}
          </Link>
        ))}
        <Link href="/menu" className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground", pathname === "/menu" && "text-primary")}>
          <Menu className="size-5" />
          More
        </Link>
      </div>
    </nav>
  );
}
