import Link from "next/link";
import { NAV } from "@/components/nav-items";
import { logout } from "@/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = { title: "Menu" };

export default function MenuPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl">Dusan OS</h1>
        <ThemeToggle />
      </div>
      {NAV.map((g) => (
        <section key={g.group}>
          <p className="mb-1 text-xs text-muted-foreground">{g.group}</p>
          <div className="divide-y rounded-xl border bg-card">
            {g.items.map((i) => (
              <Link key={i.href} href={i.href} className="flex items-center gap-3 px-4 py-3 text-sm">
                <i.icon className="size-4 text-muted-foreground" />
                {i.label}
              </Link>
            ))}
          </div>
        </section>
      ))}
      <form action={logout}><button className="text-sm text-destructive">Sign out</button></form>
    </div>
  );
}
