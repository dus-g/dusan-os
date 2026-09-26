import { cn, clamp } from "@/lib/utils";

export function Progress({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "xp" | "success" | "destructive" }) {
  const color = { primary: "bg-primary", xp: "bg-xp", success: "bg-success", destructive: "bg-destructive" }[tone];
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-secondary", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}
