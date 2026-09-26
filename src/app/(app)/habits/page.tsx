import type { Habit } from "@prisma/client";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { habitStats } from "@/lib/queries";
import { today as todayFn, addDays, toISO, startOfWeek } from "@/lib/dates";
import { saveHabit, archiveHabit, toggleHabit } from "@/actions/life";
import { PageHeader, Stat, StatGrid, Disclosure, Empty } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { Check, Flame, Archive } from "lucide-react";

export const metadata = { title: "Habits" };

const CATEGORIES = ["Work", "Study", "Health", "Mind", "Skills", "Personal"];

function HabitForm({ h }: { h?: Habit }) {
  return (
    <form action={saveHabit} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {h && <input type="hidden" name="id" value={h.id} />}
      <Field label="Name"><Input name="name" defaultValue={h?.name} required placeholder="e.g. Stretch" /></Field>
      <Field label="Category">
        <Select name="category" defaultValue={h?.category ?? "Personal"}>
          {[...new Set([...CATEGORIES, h?.category ?? "Personal"])].map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Field label="Target days / week"><Input name="targetPerWeek" type="number" min={1} max={7} defaultValue={h?.targetPerWeek ?? 7} /></Field>
      <Field label="Colour"><Input name="color" type="color" defaultValue={h?.color ?? "#4FB3B0"} className="p-1" /></Field>
      <div className="flex items-end justify-end"><SubmitButton size="sm">{h ? "Save" : "Add habit"}</SubmitButton></div>
    </form>
  );
}

export default async function HabitsPage() {
  const { userId, settings } = await getUser();
  const today = todayFn(settings.timezone);
  const since = addDays(today, -120);
  const habits = await db.habit.findMany({
    where: { userId, archived: false },
    orderBy: { order: "asc" },
    include: { logs: { where: { date: { gte: since } }, select: { date: true } } },
  });
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const rows = habits.map((h) => ({ h, s: habitStats(h.logs.map((l) => l.date), h.targetPerWeek, today, settings.weekStartsOn), done: new Set(h.logs.map((l) => toISO(l.date))) }));

  const doneToday = rows.filter((r) => r.s.doneToday).length;
  const avg = (k: "weekly" | "monthly" | "consistency") => (rows.length ? rows.reduce((a, r) => a + r.s[k], 0) / rows.length : 0);
  const bestStreak = Math.max(0, ...rows.map((r) => r.s.streak));

  // 12-week heatmap of total completions per day
  const heatStart = addDays(startOfWeek(today, settings.weekStartsOn), -11 * 7);
  const perDay = new Map<string, number>();
  for (const r of rows) for (const d of r.done) perDay.set(d, (perDay.get(d) ?? 0) + 1);
  const heat = Array.from({ length: 84 }, (_, i) => { const d = addDays(heatStart, i); return { iso: toISO(d), n: perDay.get(toISO(d)) ?? 0, future: d > today }; });

  return (
    <>
      <PageHeader title="Habits" description="Tap a day to tick it off. Each tick is worth 5 XP." />
      <StatGrid className="mb-6">
        <Stat label="Done today" value={`${doneToday} / ${rows.length}`} tone={doneToday === rows.length && rows.length ? "success" : undefined} />
        <Stat label="This week" value={`${Math.round(avg("weekly"))}%`} sub="of weekly targets" />
        <Stat label="30-day performance" value={`${Math.round(avg("monthly"))}%`} />
        <Stat label="Best current streak" value={`${bestStreak} days`} tone="xp" />
      </StatGrid>

      <Card className="mb-6">
        <CardContent className="overflow-x-auto pt-4 sm:pt-5">
          {!rows.length ? <Empty title="No habits yet">Add your first one below.</Empty> : (
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pb-2 text-left font-normal">Habit</th>
                  {days.map((d) => (
                    <th key={toISO(d)} className={cn("pb-2 font-normal", toISO(d) === toISO(today) && "text-foreground")}>
                      {d.toLocaleDateString("en-AU", { weekday: "narrow", timeZone: "UTC" })}<br /><span className="tabular">{d.getUTCDate()}</span>
                    </th>
                  ))}
                  <th className="pb-2 text-right font-normal">Streak</th>
                  <th className="pb-2 pl-3 text-right font-normal">28-day</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ h, s, done }) => (
                  <tr key={h.id} className="border-t">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2"><span className="size-2 shrink-0 rounded-full" style={{ background: h.color }} /><span className="font-medium">{h.name}</span></div>
                      <p className="pl-4 text-[11px] text-muted-foreground">{h.targetPerWeek}×/week · {s.thisWeek} this week</p>
                    </td>
                    {days.map((d) => {
                      const iso = toISO(d);
                      const on = done.has(iso);
                      return (
                        <td key={iso} className="py-2 text-center">
                          <form action={toggleHabit}>
                            <input type="hidden" name="habitId" value={h.id} />
                            <input type="hidden" name="date" value={iso} />
                            <button aria-label={`${h.name} ${iso}`} aria-pressed={on}
                              className={cn("mx-auto grid size-8 place-items-center rounded-lg border transition-colors", on ? "border-transparent text-white" : "hover:bg-secondary")}
                              style={on ? { background: h.color } : undefined}>
                              {on && <Check className="size-4" />}
                            </button>
                          </form>
                        </td>
                      );
                    })}
                    <td className="py-2 text-right tabular">{s.streak > 0 ? <span className="inline-flex items-center gap-1 text-xp"><Flame className="size-3.5" />{s.streak}</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="py-2 pl-3 text-right tabular text-muted-foreground">{Math.round(s.consistency)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto]">
        <Card>
          <CardContent className="grid gap-3 pt-4 sm:pt-5">
            <p className="text-sm font-semibold">Consistency (last 28 days)</p>
            {rows.map(({ h, s }) => (
              <div key={h.id}>
                <div className="mb-1 flex justify-between text-xs"><span>{h.name}</span><span className="tabular text-muted-foreground">week {Math.round(s.weekly)}% · month {Math.round(s.monthly)}% · 28d {Math.round(s.consistency)}%</span></div>
                <Progress value={s.consistency} tone={s.consistency >= 80 ? "success" : "primary"} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 sm:pt-5">
            <p className="mb-3 text-sm font-semibold">Last 12 weeks</p>
            <div className="grid grid-flow-col grid-rows-7 gap-1" aria-label="Habit heatmap">
              {heat.map((c) => {
                const ratio = rows.length ? c.n / rows.length : 0;
                return <div key={c.iso} title={`${c.iso}: ${c.n}`} className="size-3.5 rounded-[3px]"
                  style={{ background: c.future ? "transparent" : ratio === 0 ? "var(--secondary)" : `color-mix(in oklab, var(--primary) ${Math.round(25 + ratio * 75)}%, transparent)` }} />;
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-4 sm:pt-5">
          <Disclosure summary={<span className="cursor-pointer text-sm font-medium text-primary">+ New habit</span>}><HabitForm /></Disclosure>
          {rows.map(({ h }) => (
            <Disclosure key={h.id} summary={<span className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Edit {h.name}</span>}>
              <div className="grid gap-3">
                <HabitForm h={h} />
                <form action={archiveHabit}><input type="hidden" name="id" value={h.id} /><button className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"><Archive className="size-3.5" />Archive habit (history is kept)</button></form>
              </div>
            </Disclosure>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
