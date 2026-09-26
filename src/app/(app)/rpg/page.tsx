import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { syncProgress } from "@/lib/progress";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { levelProgress, levelTitle, xpForLevel, XP } from "@/lib/xp";
import { fmtDate } from "@/lib/dates";
import { PageHeader, Stat, StatGrid, Empty } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Lock, Trophy } from "lucide-react";

export const metadata = { title: "Level & achievements" };

const SOURCE_LABEL: Record<string, string> = {
  WORK: "Work", SAVINGS: "Savings", HEALTH: "Health", STUDY: "Study", UNIVERSITY: "University",
  MISSION: "Missions", HABIT: "Habits", JOURNAL: "Journal", ACHIEVEMENT: "Achievements",
};

const HOW_TO_EARN: [string, string][] = [
  ["Log a shift", `${XP.shiftBase} XP + ${XP.shiftPerHour}/hour`],
  ["Save money", `${XP.savingsPer100} XP per $100`],
  ["Tick a habit", `${XP.habit} XP`],
  ["Health check-in", `${XP.healthLog} XP (+${XP.gym} for gym)`],
  ["Journal", `${XP.journal}–${XP.journal * 20} XP`],
  ["Finish an assessment", `${XP.assessment} XP`],
  ["Pass a subject", `${XP.subjectPassed} XP`],
  ["Complete a semester", `${XP.semester} XP`],
  ["Complete a mission", "50–1,000+ XP"],
];

export default async function RpgPage() {
  const { userId } = await getUser();
  await syncProgress(userId);
  const [bySource, unlocked, recent, eventCount] = await Promise.all([
    db.xpEvent.groupBy({ by: ["source"], where: { userId }, _sum: { amount: true } }),
    db.achievement.findMany({ where: { userId } }),
    db.xpEvent.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.xpEvent.count({ where: { userId } }),
  ]);
  const total = bySource.reduce((s, r) => s + (r._sum.amount ?? 0), 0);
  const lp = levelProgress(total);
  const unlockedAt = new Map(unlocked.map((a) => [a.key, a.unlockedAt]));
  const groups = [...new Set(ACHIEVEMENTS.map((a) => a.group))];
  const sources = bySource.map((r) => ({ source: r.source, amount: r._sum.amount ?? 0 })).sort((a, b) => b.amount - a.amount);
  const maxSource = Math.max(1, ...sources.map((s) => s.amount));

  return (
    <>
      <PageHeader title="Level & achievements" description="Everything you do earns XP. Levels get steadily harder — level L needs 50·L·(L−1) total XP." />

      <Card className="mb-6 overflow-hidden">
        <CardContent className="grid gap-6 pt-5 sm:grid-cols-[auto_1fr] sm:items-center sm:pt-6">
          <div className="flex items-center gap-4">
            <div className="grid size-20 place-items-center rounded-2xl border border-xp/40 bg-xp/10">
              <span className="font-serif text-5xl leading-none text-xp tabular">{lp.level}</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Level {lp.level}</p>
              <p className="text-lg font-semibold">{levelTitle(lp.level)}</p>
              <p className="text-sm text-muted-foreground tabular">{total.toLocaleString()} XP total</p>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground tabular">
              <span>{lp.intoLevel.toLocaleString()} / {lp.needed.toLocaleString()} XP</span>
              <span>{lp.toNext.toLocaleString()} XP to level {lp.level + 1}</span>
            </div>
            <Progress value={lp.percent} tone="xp" className="h-2.5" />
            <p className="mt-2 text-xs text-muted-foreground">Level {lp.level + 5} at {xpForLevel(lp.level + 5).toLocaleString()} XP · Level 50 at {xpForLevel(50).toLocaleString()} XP</p>
          </div>
        </CardContent>
      </Card>

      <StatGrid className="mb-6">
        <Stat label="Achievements" value={`${unlocked.length} / ${ACHIEVEMENTS.length}`} tone="xp" />
        <Stat label="Top XP source" value={sources[0] ? SOURCE_LABEL[sources[0].source] : "—"} sub={sources[0] ? `${sources[0].amount.toLocaleString()} XP` : undefined} />
        <Stat label="XP events" value={eventCount.toLocaleString()} />
        <Stat label="Next title" value={levelTitle(lp.level + 5) === levelTitle(lp.level) ? "Keep going" : levelTitle(lp.level + 5)} />
      </StatGrid>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>XP by area</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {!sources.length && <Empty title="No XP yet">Log a shift or tick a habit to start.</Empty>}
            {sources.map((s) => (
              <div key={s.source}>
                <div className="mb-1 flex justify-between text-sm"><span>{SOURCE_LABEL[s.source]}</span><span className="tabular text-muted-foreground">{s.amount.toLocaleString()} XP</span></div>
                <Progress value={(s.amount / maxSource) * 100} tone="xp" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>How to earn XP</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {HOW_TO_EARN.map(([a, b]) => <li key={a} className="flex justify-between py-2"><span>{a}</span><span className="tabular text-xp">{b}</span></li>)}
            </ul>
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 text-sm font-semibold">Achievements</h2>
      <div className="mb-6 grid gap-6">
        {groups.map((g) => (
          <section key={g}>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{g}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {ACHIEVEMENTS.filter((a) => a.group === g).map((a) => {
                const at = unlockedAt.get(a.key);
                return (
                  <div key={a.key} className={cn("rounded-xl border p-3", at ? "border-xp/40 bg-xp/5" : "opacity-60")}>
                    <div className="flex items-center justify-between">
                      {at ? <Trophy className="size-4 text-xp" /> : <Lock className="size-4 text-muted-foreground" />}
                      <Badge tone={at ? "xp" : "outline"}>{a.xp} XP</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{at ? `Unlocked ${fmtDate(at)}` : a.description}</p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <Card>
        <CardHeader><div><CardTitle>Recent XP</CardTitle><CardDescription>Last 25 events</CardDescription></div></CardHeader>
        <CardContent>
          {!recent.length ? <Empty title="No XP yet" /> : (
            <ul className="divide-y text-sm">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0"><p className="truncate">{e.reason}</p><p className="text-xs text-muted-foreground">{SOURCE_LABEL[e.source]} · {fmtDate(e.createdAt)}</p></div>
                  <span className={cn("shrink-0 tabular", e.amount >= 0 ? "text-xp" : "text-destructive")}>{e.amount >= 0 ? "+" : ""}{e.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
