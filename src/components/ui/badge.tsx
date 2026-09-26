import { cn } from "@/lib/utils";

const tones = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-accent text-accent-foreground",
  xp: "bg-xp/15 text-xp",
  success: "bg-success/15 text-success",
  destructive: "bg-destructive/15 text-destructive",
  outline: "border text-muted-foreground",
};

export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: keyof typeof tones; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", tones[tone], className)}>{children}</span>;
}
