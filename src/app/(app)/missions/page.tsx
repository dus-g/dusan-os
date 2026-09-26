import type { Mission } from "@prisma/client";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { syncProgress, missionProgress } from "@/lib/progress";
import { today as todayFn, diffDays, fmtDate, toISO } from "@/lib/dates";
import { money, centsToInput } from "@/lib/money";
import { DIFFICULTY_XP } from "@/lib/xp";
import { saveMission, setMissionProgress, completeMission, reopenMission, archiveMission, setMainMission } from "@/actions/life";
import { PageHeader, Stat, StatGrid, Disclosure, Empty } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Star, Check, RotateCcw, Archive } from "lucide-react";

export const metadata = { title: "Missions" };

const METRIC_LABEL: Record<Mission["metric"], string> = {
  MANUAL: "Manual progress",
  SAVINGS_TOTAL: "Total savings ($)",
  HOURS_WORKED: "Lifetime hours worked",
  SHIFTS_COUNT: "Number of shifts",
  DAYS_EMPLOYED: "Days since first shift",
  UNI_STARTED: "University started",
};
const PRIORITY_TONE = { LOW: "outline", MEDIUM: "default", HIGH: "primary", CRITICAL: "destructive" } as const;

function MissionForm({ m, categories }: { m?: Mission; categories: string[] }) {
  const target = m?.metric === "SAVINGS_TOTAL" ? centsToInput(m.metricTarget ?? 0) : m?.metricTarget ?? "";
  return (
    <form action={saveMission} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {m && <input type="hidden" name="id" value={m.id} />}
      <Field label="Title" className="col-span-2"><Input name="title" defaultValue={m?.title} required placeholder="e.g. Run a half marathon" /></Field>
      <Field label="Category">
        <Select name="category" defaultValue={m?.category ?? categories[0]}>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Deadline"><Input type="date" name="deadline" defaultValue={m?.deadline ? toISO(m.deadline) : ""} /></Field>
      <Field label="Priority">
        <Select name="priority" defaultValue={m?.priority ?? "MEDIUM"}>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
        </Select>
      </Field>
      <Field label="Difficulty">
        <Select name="difficulty" defaultValue={m?.difficulty ?? "MEDIUM"}>
          {Object.entries(DIFFICULTY_XP).map(([d, xp]) => <option key={d} value={d}>{d[0] + d.slice(1).toLowerCase()} · {xp} XP</option>)}
        </Select>
      </Field>
      <Field label="XP reward" hint="Blank = difficulty default"><Input name="xpReward" inputMode="numeric" defaultValue={m?.xpReward} /></Field>
      <Field label="Progress %"><Input name="progress" type="number" min={0} max={100} defaultValue={m?.progress ?? 0} /></Field>
      <Field label="Track automatically by">
        <Select name="metric" defaultValue={m?.metric ?? "MANUAL"}>
          {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Target (for auto-tracking)"><Input name="metricTarget" inputMode="decimal" defaultValue={target} placeholder="e.g. 5000" /></Field>
      <Field label="Description" className="col-span-2"><Textarea name="description" defaultValue={m?.description ?? ""} className="min-h-9" /></Field>
      <div className="col-span-2 flex items-end justify-end sm:col-span-4"><SubmitButton size="sm">{m ? "Save mission" : "Add mission"}</SubmitButton></div>
    </form>
  );
}

function IconForm({ action, id, title, children }: { action: (fd: FormData) => Promise<void>; id: string; title: string; children: React.ReactNode }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title={title} aria-label={title}>{children}</button>
    </form>
  );
}

export default async function MissionsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "active" } = await searchParams;
  const { userId, settings } = await getUser();
  const today = todayFn(settings.timezone);
  const stats = await syncProgress(userId);
  const missions = await db.mission.findMany({ where: { userId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] });
  const cats = settings.missionCategories.length ? settings.missionCategories : ["Personal"];

  const active = missions.filter((m) => m.status === "ACTIVE");
  const completed = missions.filter((m) => m.status === "COMPLETED");
  const archived = missions.filter((m) => m.status === "ARCHIVED");
  const list = view === "completed" ? completed : view === "archived" ? archived : active;
  const nonArchived = active.length + completed.length;
  const xpEarned = completed.reduce((s, m) => s + m.xpReward, 0);
  const xpAvailable = active.reduce((s, m) => s + m.xpReward, 0);

  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  if (view === "active") list.sort((a, b) => rank[a.priority] - rank[b.priority] || (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity));

  const tabs = [["active", `Active (${active.length})`], ["completed", `Completed (${completed.length})`], ["archived", `Archived (${archived.length})`]] as const;

  return (
    <>
      <PageHeader title="Missions" description="The big things you're working towards. Auto-tracked missions complete themselves; the rest you move along by hand." />
      <StatGrid className="mb-6">
        <Stat label="Active" value={active.length} />
        <Stat label="Completed" value={completed.length} sub={`${nonArchived ? Math.round((completed.length / nonArchived) * 100) : 0}% completion`} tone="success" />
        <Stat label="XP earned" value={xpEarned.toLocaleString()} tone="xp" />
        <Stat label="XP on the table" value={xpAvailable.toLocaleString()} />
      </StatGrid>

      <Card className="mb-6">
        <CardContent className="pt-4 sm:pt-5">
          <Disclosure summary={<span className="cursor-pointer text-sm font-medium text-primary">+ New mission</span>}>
            <MissionForm categories={cats} />
          </Disclosure>
        </CardContent>
      </Card>

      <nav className="mb-4 flex gap-1 text-sm">
        {tabs.map(([k, label]) => (
          <a key={k} href={`?view=${k}`} className={`rounded-md px-3 py-1.5 ${view === k ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground"}`}>{label}</a>
        ))}
      </nav>

      {!list.length && <Empty title="Nothing here">Missions you {view === "active" ? "add" : view === "completed" ? "complete" : "archive"} will appear here.</Empty>}

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((m) => {
          const p = missionProgress(m, stats);
          const isMain = settings.mainMissionId === m.id;
          const daysLeft = m.deadline ? diffDays(m.deadline, today) : null;
          const auto = m.metric !== "MANUAL";
          let detail = "";
          if (m.metric === "SAVINGS_TOTAL") detail = `${money(stats.savings, settings.currency, { noCents: true })} of ${money(m.metricTarget ?? 0, settings.currency, { noCents: true })}`;
          if (m.metric === "HOURS_WORKED") detail = `${Math.round(stats.lifetimeMinutes / 60)} of ${m.metricTarget} h`;
          if (m.metric === "SHIFTS_COUNT") detail = `${stats.shiftCount} of ${m.metricTarget} shifts`;
          if (m.metric === "DAYS_EMPLOYED") detail = `${stats.daysEmployed} of ${m.metricTarget} days`;
          return (
            <Card key={m.id} className={isMain ? "border-primary/60" : undefined}>
              <CardHeader>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isMain && <Badge tone="primary"><Star className="size-3" /> Main mission</Badge>}
                    <Badge tone={PRIORITY_TONE[m.priority]}>{m.priority.toLowerCase()}</Badge>
                    <Badge tone="outline">{m.category}</Badge>
                    <Badge tone="xp">{m.xpReward} XP</Badge>
                  </div>
                  <CardTitle className="mt-2 text-base">{m.title}</CardTitle>
                  {m.description && <CardDescription className="mt-0.5">{m.description}</CardDescription>}
                </div>
                <div className="flex shrink-0">
                  {m.status === "ACTIVE" && !isMain && <IconForm action={setMainMission} id={m.id} title="Make main mission"><Star className="size-3.5" /></IconForm>}
                  {m.status === "ACTIVE" && <IconForm action={completeMission} id={m.id} title="Mark complete"><Check className="size-3.5" /></IconForm>}
                  {m.status !== "ACTIVE" && <IconForm action={reopenMission} id={m.id} title="Reopen"><RotateCcw className="size-3.5" /></IconForm>}
                  {m.status !== "ARCHIVED" && <IconForm action={archiveMission} id={m.id} title="Archive"><Archive className="size-3.5" /></IconForm>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-1.5 flex justify-between text-xs text-muted-foreground tabular">
                  <span>{auto ? detail || METRIC_LABEL[m.metric] : `${m.difficulty.toLowerCase()} difficulty`}</span>
                  <span>{Math.round(p)}%</span>
                </div>
                <Progress value={p} tone={m.status === "COMPLETED" ? "success" : "primary"} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {m.status === "COMPLETED" && m.completedAt ? `Completed ${fmtDate(m.completedAt)}` :
                      m.deadline ? <span className={daysLeft !== null && daysLeft < 0 ? "text-destructive" : undefined}>Due {fmtDate(m.deadline)} · {daysLeft! >= 0 ? `${daysLeft} days left` : `${-daysLeft!} days overdue`}</span> : "No deadline"}
                  </span>
                  {m.status === "ACTIVE" && !auto && (
                    <form action={setMissionProgress} className="flex items-center gap-1.5">
                      <input type="hidden" name="id" value={m.id} />
                      <Input name="progress" type="number" min={0} max={100} defaultValue={m.progress} className="h-7 w-16 text-xs" aria-label="Progress percent" />
                      <SubmitButton size="sm" variant="secondary" className="h-7">Update</SubmitButton>
                    </form>
                  )}
                </div>
                <Disclosure className="mt-3" summary={<span className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Edit</span>}>
                  <MissionForm m={m} categories={cats.includes(m.category) ? cats : [...cats, m.category]} />
                </Disclosure>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
