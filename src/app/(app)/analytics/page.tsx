import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { syncProgress } from "@/lib/progress";
import { monthlySeries, habitStats } from "@/lib/queries";
import { netWorthSeries } from "@/lib/ledger";
import { programSummary } from "@/lib/education";
import { levelProgress, levelTitle } from "@/lib/xp";
import { today as todayFn, addDays, fmtDate, fmtShort, fromISO } from "@/lib/dates";
import { money, hours } from "@/lib/money";
import { PageHeader, Stat, StatGrid } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendChart } from "@/components/charts";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { userId, settings } = await getUser();
  const cur = settings.currency;
  const today = todayFn(settings.timezone);
  const stats = await syncProgress(userId);

  const [months, nw, missions, habits, bachelor, subjects, xpMonthly] = await Promise.all([
    monthlySeries(userId, today, 24),
    netWorthSeries(userId, addDays(today, -365), today),
    db.mission.groupBy({ by: ["status"], where: { userId }, _count: true }),
    db.habit.findMany({ where: { userId, archived: false }, include: { logs: { where: { date: { gte: addDays(today, -60) } }, select: { date: true } } } }),
    db.universityProgram.findFirst({ where: { userId, kind: "BACHELOR" } }),
    db.subject.findMany({ where: { userId, semester: { program: { kind: "BACHELOR" } } }, select: { grade: true, units: true, status: true } }),
    db.xpEvent.findMany({ where: { userId, createdAt: { gte: addDays(today, -365) } }, select: { amount: true, createdAt: true } }),
  ]);

  const mCount = (s: string) => missions.find((m) => m.status === s)?._count ?? 0;
  const missionPct = mCount("ACTIVE") + mCount("COMPLETED") ? (mCount("COMPLETED") / (mCount("ACTIVE") + mCount("COMPLETED"))) * 100 : 0;
  const habitPct = habits.length ? habits.reduce((a, h) => a + habitStats(h.logs.map((l) => l.date), h.targetPerWeek, today, settings.weekStartsOn).consistency, 0) / habits.length : 0;
  const degree = bachelor ? programSummary(bachelor, subjects, today) : null;
  const lp = levelProgress(stats.xp);
  const savingsRate = stats.lifetimeNet ? ((stats.lifetimeNet - stats.lifetimeExpenses) / stats.lifetimeNet) * 100 : 0;
  const effectiveTax = stats.lifetimeGross ? (stats.lifetimeTax / stats.lifetimeGross) * 100 : 0;
  const avgRate = stats.lifetimeMinutes ? Math.round(stats.lifetimeGross / (stats.lifetimeMinutes / 60)) : 0;

  // Cumulative earnings over 24 months
  let run = 0;
  const cumulative = months.map((m) => ({ label: m.label, earned: (run += m.net), hours: m.hours }));
  const nwWeekly = nw.filter((_, i) => i % 7 === 0 || i === nw.length - 1).map((p) => ({ label: fmtShort(fromISO(p.date)), value: p.value / 100 }));

  // XP per month (12 months)
  const xpBuckets = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1));
    xpBuckets.set(d.toISOString().slice(0, 7), 0);
  }
  for (const e of xpMonthly) { const k = e.createdAt.toISOString().slice(0, 7); if (xpBuckets.has(k)) xpBuckets.set(k, xpBuckets.get(k)! + e.amount); }
  const xpSeries = [...xpBuckets].map(([k, v]) => ({ label: fmtDate(`${k}-01`, { month: "short", year: "2-digit" }), xp: v }));

  const bestMonth = months.reduce((b, m) => (m.gross > b.gross ? m : b), months[0]);

  return (
    <>
      <PageHeader title="Analytics" description={stats.firstShift ? `Lifetime numbers since your first shift on ${fmtDate(stats.firstShift)} — ${stats.daysEmployed.toLocaleString()} days ago.` : "Lifetime numbers. Log shifts and expenses and this page fills itself in."} />

      <h2 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Work</h2>
      <StatGrid className="mb-6">
        <Stat label="Lifetime hours" value={hours(stats.lifetimeMinutes, 0) + " h"} sub={`${stats.shiftCount.toLocaleString()} shifts`} />
        <Stat label="Lifetime earnings (gross)" value={money(stats.lifetimeGross, cur, { noCents: true })} sub={`${money(avgRate, cur)}/h average`} />
        <Stat label="Lifetime tax (est.)" value={money(stats.lifetimeTax, cur, { noCents: true })} sub={`${effectiveTax.toFixed(1)}% effective`} />
        <Stat label="Super earned" value={money(stats.lifetimeSuper, cur, { noCents: true })} />
        <Stat label="Average weekly earnings" value={money(stats.avgWeeklyGross, cur, { noCents: true })} />
        <Stat label="Average weekly hours" value={hours(stats.avgWeeklyMinutes) + " h"} />
        <Stat label="Take-home (lifetime)" value={money(stats.lifetimeNet, cur, { noCents: true })} />
        <Stat label="Best month" value={bestMonth && bestMonth.gross ? bestMonth.label : "—"} sub={bestMonth?.gross ? money(bestMonth.gross * 100, cur, { noCents: true }) : undefined} />
      </StatGrid>

      <h2 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Money</h2>
      <StatGrid className="mb-6">
        <Stat label="Net worth" value={money(stats.netWorth, cur, { noCents: true })} tone={stats.netWorth >= 0 ? "success" : "destructive"} />
        <Stat label="Savings" value={money(stats.savings, cur, { noCents: true })} />
        <Stat label="Lifetime expenses" value={money(stats.lifetimeExpenses, cur, { noCents: true })} />
        <Stat label="Savings rate" value={`${savingsRate.toFixed(0)}%`} sub="of take-home not spent" tone={savingsRate >= 30 ? "success" : undefined} />
      </StatGrid>

      <h2 className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Life</h2>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Mission completion", missionPct, `${mCount("COMPLETED")} of ${mCount("ACTIVE") + mCount("COMPLETED")}`],
          ["Habit completion (28d)", habitPct, `${habits.length} habits`],
          ["Degree progress", degree?.progress ?? 0, degree ? `${degree.passed} / ${bachelor!.totalUnits} units` : "Not started"],
          [`Level ${lp.level} · ${levelTitle(lp.level)}`, lp.percent, `${stats.xp.toLocaleString()} XP total`],
        ].map(([label, v, sub], i) => (
          <div key={label as string} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`mt-1 text-lg font-semibold tabular sm:text-xl ${i === 3 ? "text-xp" : ""}`}>{Math.round(v as number)}%</p>
            <Progress value={v as number} tone={i === 3 ? "xp" : "primary"} className="my-2" />
            <p className="text-xs text-muted-foreground tabular">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader><div><CardTitle>Income vs spending</CardTitle><CardDescription>Monthly, last 24 months</CardDescription></div></CardHeader>
          <CardContent><TrendChart data={months} x="label" type="bar" height={260} series={[{ key: "net", label: "Take-home" }, { key: "tax", label: "Tax", color: "var(--chart-4)" }, { key: "expenses", label: "Expenses", color: "var(--chart-5)" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Net worth</CardTitle><CardDescription>Last 12 months</CardDescription></div></CardHeader>
          <CardContent><TrendChart data={nwWeekly} x="label" series={[{ key: "value", label: "Net worth", color: "var(--chart-1)" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Cumulative take-home</CardTitle><CardDescription>Last 24 months</CardDescription></div></CardHeader>
          <CardContent><TrendChart data={cumulative} x="label" series={[{ key: "earned", label: "Take-home", color: "var(--chart-2)" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Hours per month</CardTitle></div></CardHeader>
          <CardContent><TrendChart data={months} x="label" type="bar" kind="hours" series={[{ key: "hours", label: "Hours", color: "var(--chart-1)" }]} /></CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>XP per month</CardTitle></div></CardHeader>
          <CardContent><TrendChart data={xpSeries} x="label" type="bar" kind="number" series={[{ key: "xp", label: "XP", color: "var(--chart-3)" }]} /></CardContent>
        </Card>
      </div>
    </>
  );
}
