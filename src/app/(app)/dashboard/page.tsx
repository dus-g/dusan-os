import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { syncProgress, missionProgress } from "@/lib/progress";
import { shiftTotals, weeklySeries, habitStats } from "@/lib/queries";
import {
  today as todayFn, ageOn, daysUntilBirthday, diffDays, startOfWeek, addDays, startOfMonth, endOfMonth,
  startOfFinancialYear, financialYearLabel, toISO, fmtDate,
} from "@/lib/dates";
import { money, hours } from "@/lib/money";
import { levelProgress, levelTitle } from "@/lib/xp";
import { pct } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stat, StatGrid } from "@/components/page";
import { TrendChart } from "@/components/charts";
import { LifeArc } from "@/components/life-arc";
import { toggleHabit } from "@/actions/life";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-AU", { hour: "numeric", hour12: false, timeZone: "Australia/Adelaide" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const { user, settings, userId } = await getUser();
  const today = todayFn(settings.timezone);
  const cur = settings.currency;
  const stats = await syncProgress(userId);

  const weekStart = startOfWeek(today, settings.weekStartsOn);
  const [week, month, fy, series, missions, goals, programs, habits] = await Promise.all([
    shiftTotals(userId, weekStart, addDays(weekStart, 6)),
    shiftTotals(userId, startOfMonth(today), endOfMonth(today)),
    shiftTotals(userId, startOfFinancialYear(today), today),
    weeklySeries(userId, today, 12, settings.weekStartsOn),
    db.mission.findMany({ where: { userId, status: "ACTIVE" }, orderBy: [{ order: "asc" }] }),
    db.goal.findMany({ where: { userId, achievedAt: null }, orderBy: { order: "asc" }, include: { account: true, contributions: { select: { amountCents: true } } } }),
    db.universityProgram.findMany({ where: { userId }, orderBy: { startDate: "asc" } }),
    db.habit.findMany({
      where: { userId, archived: false }, orderBy: { order: "asc" },
      include: { logs: { where: { date: { gte: addDays(today, -60) } }, select: { date: true } } },
    }),
  ]);

  const lp = levelProgress(stats.xp);
  const age = ageOn(settings.dateOfBirth, today);
  const birthday = daysUntilBirthday(settings.dateOfBirth, today);
  const uniDays = diffDays(settings.universityStartDate, today);
  const priorityRank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const main = missions.find((m) => m.id === settings.mainMissionId) ?? [...missions].sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])[0];

  const goalValue = (g: (typeof goals)[number]) =>
    g.trackTotalSavings ? stats.savings : g.account ? g.account.balanceCents : g.contributions.reduce((s, c) => s + c.amountCents, 0);
  const goal = goals.find((g) => goalValue(g) < g.targetCents) ?? goals[0];

  const bachelor = programs.find((p) => p.kind === "BACHELOR");
  const med = programs.find((p) => p.kind === "MEDICINE");
  const addYears = (d: Date, y: number) => new Date(Date.UTC(d.getUTCFullYear() + Math.floor(y), d.getUTCMonth() + Math.round((y % 1) * 12), d.getUTCDate()));
  const bachelorEnd = bachelor ? addYears(bachelor.startDate, bachelor.durationYears) : null;
  const medEnd = med ? addYears(med.startDate, med.durationYears) : null;
  const milestones = [
    bachelor && { label: "Public Health starts", date: toISO(bachelor.startDate), done: bachelor.startDate <= today },
    bachelorEnd && { label: "Graduate BPH", date: toISO(addDays(bachelorEnd, -90)), done: bachelor?.status === "COMPLETED" },
    med && { label: "Medicine starts", date: toISO(med.startDate), done: med.status === "ACTIVE" || med.status === "COMPLETED" },
    medEnd && { label: "Dr Dusan", date: toISO(addDays(medEnd, -60)), done: med?.status === "COMPLETED" },
  ].filter(Boolean) as { label: string; date: string; done: boolean }[];
  const arcStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const arcEnd = medEnd ? new Date(Date.UTC(medEnd.getUTCFullYear(), 11, 31)) : new Date(Date.UTC(today.getUTCFullYear() + 8, 11, 31));

  return (
    <div className="space-y-6">
      {/* Hero: where Dusan is on the long road */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{greeting()}, {user.name.split(" ")[0]}</p>
            <h1 className="mt-1 font-serif text-4xl leading-[1.05] sm:text-5xl">
              {uniDays > 0 ? <>{uniDays} days until Flinders</> : bachelor?.status === "COMPLETED" ? <>On the road to medicine</> : <>Year {Math.min(3, Math.floor(-uniDays / 365) + 1)} of Public Health</>}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground tabular">
              Age {age}. Birthday in {birthday} {birthday === 1 ? "day" : "days"}. {fmtDate(today, { weekday: "long", day: "numeric", month: "long" })}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild><Link href="/work#log"><Plus /> Log shift</Link></Button>
            <Button asChild variant="outline"><Link href="/expenses#add">Add expense</Link></Button>
          </div>
        </div>
        <LifeArc start={toISO(arcStart)} end={toISO(arcEnd)} today={toISO(today)} milestones={milestones} />
      </section>

      <StatGrid>
        <Stat label="Current savings" value={money(stats.savings, cur)} sub={`Net worth ${money(stats.netWorth, cur)}`} />
        <Stat label="Bank balance" value={money(stats.bank, cur)} sub="Everyday account" />
        <Stat label="This week" value={`${hours(week.minutes)}h`} sub={`${money(week.net, cur)} take-home`} />
        <Stat label="This month" value={`${hours(month.minutes)}h`} sub={`${money(month.gross, cur)} gross`} />
        <Stat label={`${financialYearLabel(today)} income`} value={money(fy.gross, cur, { noCents: true })} sub={`${money(fy.tax, cur, { noCents: true })} est. tax`} />
        <Stat label="Monthly income" value={money(month.net, cur)} sub="Take-home this month" />
        <Stat label="Avg weekly earnings" value={money(stats.avgWeeklyGross, cur)} sub={`${hours(stats.avgWeeklyMinutes)}h avg per week`} />
        <Stat label={`Level ${lp.level}`} value={`${stats.xp.toLocaleString("en-AU")} XP`} sub={`${lp.toNext.toLocaleString("en-AU")} XP to level ${lp.level + 1}`} tone="xp" />
      </StatGrid>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Weekly earnings</CardTitle>
              <CardDescription>Last 12 weeks, gross and take-home</CardDescription>
            </div>
            <Link href="/analytics" className="text-xs text-primary hover:underline">Analytics</Link>
          </CardHeader>
          <CardContent>
            <TrendChart data={series} x="label" type="bar" series={[{ key: "gross", label: "Gross" }, { key: "net", label: "Take-home" }]} />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <div>
                <CardDescription>{levelTitle(lp.level)}</CardDescription>
                <CardTitle className="text-base">Level {lp.level}</CardTitle>
              </div>
              <Link href="/rpg" className="text-xs text-primary hover:underline">Achievements</Link>
            </CardHeader>
            <CardContent>
              <Progress value={lp.percent} tone="xp" />
              <p className="mt-2 text-xs text-muted-foreground tabular">{lp.intoLevel.toLocaleString("en-AU")} / {lp.needed.toLocaleString("en-AU")} XP</p>
            </CardContent>
          </Card>

          {main && (
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Main mission</CardDescription>
                  <CardTitle className="text-base">{main.title}</CardTitle>
                </div>
                <Badge tone="xp">+{main.xpReward} XP</Badge>
              </CardHeader>
              <CardContent>
                <Progress value={missionProgress(main, stats)} />
                <p className="mt-2 text-xs text-muted-foreground tabular">{Math.round(missionProgress(main, stats))}% complete{main.deadline && `, due ${fmtDate(main.deadline)}`}</p>
              </CardContent>
            </Card>
          )}

          {goal && (
            <Card>
              <CardHeader>
                <div>
                  <CardDescription>Savings goal</CardDescription>
                  <CardTitle className="text-base">{goal.name}</CardTitle>
                </div>
                <Link href="/savings" className="text-xs text-primary hover:underline">All goals</Link>
              </CardHeader>
              <CardContent>
                <Progress value={pct(goalValue(goal), goal.targetCents)} tone="success" />
                <p className="mt-2 text-xs text-muted-foreground tabular">{money(goalValue(goal), cur)} of {money(goal.targetCents, cur, { noCents: true })}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Today's habits</CardTitle>
            <CardDescription>Tap to check off. Each one is worth 5 XP.</CardDescription>
          </div>
          <Link href="/habits" className="text-xs text-primary hover:underline">Habit tracker</Link>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {habits.map((h) => {
            const s = habitStats(h.logs.map((l) => l.date), h.targetPerWeek, today, settings.weekStartsOn);
            return (
              <form key={h.id} action={toggleHabit}>
                <input type="hidden" name="habitId" value={h.id} />
                <input type="hidden" name="date" value={toISO(today)} />
                <button
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${s.doneToday ? "border-transparent bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                  aria-pressed={s.doneToday}
                >
                  {h.name}
                  {s.streak > 1 && <span className="text-xs opacity-75 tabular">{s.streak}d</span>}
                </button>
              </form>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
