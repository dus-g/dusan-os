import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Stat({ label, value, sub, className, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string; tone?: "xp" | "success" | "destructive" }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular sm:text-xl", tone === "xp" && "text-xp", tone === "success" && "text-success", tone === "destructive" && "text-destructive")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground tabular">{sub}</p>}
    </div>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}>{children}</div>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Inline expandable editor using native <details> — no client JS required. */
export function Disclosure({ summary, children, className, open }: { summary: React.ReactNode; children: React.ReactNode; className?: string; open?: boolean }) {
  return (
    <details className={cn("group", className)} open={open}>
      <summary className="select-none">{summary}</summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
