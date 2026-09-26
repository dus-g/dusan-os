import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { today as todayFn, addDays, toISO, fmtDate, fmtShort, startOfWeek } from "@/lib/dates";
import { saveHealthLog, addMeasurement, deleteMeasurement } from "@/actions/life";
import { PageHeader, Stat, StatGrid, Empty } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Checkbox, Select } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/delete-button";
import { TrendChart } from "@/components/charts";
import type { HealthLog } from "@prisma/client";

export const metadata = { title: "Health" };

const RANGES = { week: 7, month: 30, year: 365 } as const;
type Range = keyof typeof RANGES;
const MEASURES = ["Waist", "Chest", "Hips", "Arm", "Thigh", "Neck", "Body fat"];

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

/** Daily points for week/month, weekly averages for year. */
function buildSeries(logs: HealthLog[], range: Range, from: Date, today: Date, weekStartsOn: number) {
  const byDay = new Map(logs.map((l) => [toISO(l.date), l]));
  if (range !== "year") {
    return Array.from({ length: RANGES[range] }, (_, i) => {
      const d = addDays(from, i + 1);
      const l = byDay.get(toISO(d));
      return { label: fmtShort(d), weight: l?.weightKg ?? null, sleep: l?.sleepHours ?? null, water: l?.waterMl ? l.waterMl / 1000 : null, steps: l?.steps ?? null, gym: l?.gymSession ? 1 : 0 };
    });
  }
  const out: Record<string, string | number | null>[] = [];
  for (let w = startOfWeek(from, weekStartsOn); w <= today; w = addDays(w, 7)) {
    const wk = Array.from({ length: 7 }, (_, i) => byDay.get(toISO(addDays(w, i)))).filter(Boolean) as HealthLog[];
    out.push({
      label: fmtShort(w),
      weight: r1(avg(wk.map((l) => l.weightKg))),
      sleep: r1(avg(wk.map((l) => l.sleepHours))),
      water: r1(avg(wk.map((l) => (l.waterMl ? l.waterMl / 1000 : null)))),
      steps: avg(wk.map((l) => l.steps)) === null ? null : Math.round(avg(wk.map((l) => l.steps))!),
      gym: wk.filter((l) => l.gymSession).length,
    });
  }
  return out;
}

export default async function HealthPage({ searchParams }: { searchParams: Promise<{ range?: string; date?: string }> }) {
  const sp = await searchParams;
  const range: Range = sp.range === "month" || sp.range === "year" ? sp.range : "week";
  const { userId, settings } = await getUser();
  const today = todayFn(settings.timezone);
  const logDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : toISO(today);
  const from = addDays(today, -RANGES[range]);

  const [logs, entry, latestWeight, measurements, gymYear] = await Promise.all([
    db.healthLog.findMany({ where: { userId, date: { gt: from } }, orderBy: { date: "asc" } }),
    db.healthLog.findFirst({ where: { userId, date: new Date(`${logDate}T00:00:00Z`) } }),
    db.healthLog.findFirst({ where: { userId, weightKg: { not: null } }, orderBy: { date: "desc" } }),
    db.measurement.findMany({ where: { userId }, orderBy: [{ date: "desc" }], take: 60 }),
    db.healthLog.count({ where: { userId, gymSession: true, date: { gt: addDays(today, -365) } } }),
  ]);

  const series = buildSeries(logs, range, from, today, settings.weekStartsOn);
  const weights = logs.filter((l) => l.weightKg !== null);
  const weightChange = weights.length >= 2 ? weights[weights.length - 1].weightKg! - weights[0].weightKg! : null;
  const gymInRange = logs.filter((l) => l.gymSession).length;
  const latestByKind = new Map<string, (typeof measurements)[number]>();
  for (const m of measurements) if (!latestByKind.has(m.kind)) latestByKind.set(m.kind, m);

  const rangeLabel = { week: "7 days", month: "30 days", year: "12 months" }[range];

  return (
    <>
      <PageHeader title="Health" description="A 30-second daily check-in. Blank fields are simply skipped." actions={
        <nav className="flex gap-1 text-sm">
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <a key={r} href={`?range=${r}`} className={`rounded-md px-3 py-1.5 capitalize ${range === r ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground"}`}>{r}</a>
          ))}
        </nav>
      } />

      <Card className="mb-6">
        <CardHeader>
          <div><CardTitle>Check-in</CardTitle><CardDescription>{entry ? `Editing ${fmtDate(entry.date)}` : `New entry for ${fmtDate(new Date(`${logDate}T00:00:00Z`))}`}</CardDescription></div>
          <form method="get" className="flex items-center gap-1.5">
            <input type="hidden" name="range" value={range} />
            <Input type="date" name="date" defaultValue={logDate} max={toISO(today)} className="h-8 w-auto text-xs" aria-label="Load another day" />
            <button className="h-8 rounded-md border px-2 text-xs hover:bg-secondary">Load</button>
          </form>
        </CardHeader>
        <CardContent>
          <form action={saveHealthLog} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <input type="hidden" name="date" value={logDate} />
            <Field label="Weight (kg)"><Input name="weightKg" inputMode="decimal" defaultValue={entry?.weightKg ?? ""} placeholder={latestWeight?.weightKg?.toString() ?? "75.0"} /></Field>
            <Field label="Sleep (h)"><Input name="sleepHours" inputMode="decimal" defaultValue={entry?.sleepHours ?? ""} placeholder="8" /></Field>
            <Field label="Water (L)"><Input name="waterL" inputMode="decimal" defaultValue={entry?.waterMl ? entry.waterMl / 1000 : ""} placeholder="2.5" /></Field>
            <Field label="Steps"><Input name="steps" inputMode="numeric" defaultValue={entry?.steps ?? ""} placeholder="10000" /></Field>
            <div className="col-span-2 flex items-end pb-2 sm:col-span-1"><Checkbox name="gymSession" label="Gym session" defaultChecked={entry?.gymSession} /></div>
            <Field label="Notes" className="col-span-2 sm:col-span-5"><Input name="notes" defaultValue={entry?.notes ?? ""} placeholder="Optional" /></Field>
            <div className="col-span-2 flex items-end justify-end sm:col-span-1"><SubmitButton className="w-full">Save</SubmitButton></div>
          </form>
        </CardContent>
      </Card>

      <StatGrid className="mb-6">
        <Stat label="Current weight" value={latestWeight?.weightKg ? `${latestWeight.weightKg} kg` : "—"}
          sub={weightChange !== null ? `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg over ${rangeLabel}` : latestWeight ? fmtDate(latestWeight.date) : undefined} />
        <Stat label={`Avg sleep · ${rangeLabel}`} value={avg(logs.map((l) => l.sleepHours)) !== null ? `${r1(avg(logs.map((l) => l.sleepHours)))} h` : "—"} />
        <Stat label={`Avg steps · ${rangeLabel}`} value={avg(logs.map((l) => l.steps)) !== null ? Math.round(avg(logs.map((l) => l.steps))!).toLocaleString() : "—"}
          sub={`Water avg ${r1(avg(logs.map((l) => (l.waterMl ? l.waterMl / 1000 : null)))) ?? "—"} L`} />
        <Stat label={`Gym · ${rangeLabel}`} value={`${gymInRange} sessions`} sub={`${gymYear} in the last year`} />
      </StatGrid>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Weight</CardTitle></CardHeader><CardContent><TrendChart data={series} x="label" type="line" kind="number" series={[{ key: "weight", label: "kg" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Sleep</CardTitle></CardHeader><CardContent><TrendChart data={series} x="label" type="bar" kind="hours" series={[{ key: "sleep", label: "Sleep", color: "var(--chart-2)" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Steps</CardTitle></CardHeader><CardContent><TrendChart data={series} x="label" type="bar" kind="number" series={[{ key: "steps", label: "Steps", color: "var(--chart-5)" }]} /></CardContent></Card>
        <Card><CardHeader><CardTitle>{range === "year" ? "Water & gym per week" : "Water (L)"}</CardTitle></CardHeader><CardContent>
          <TrendChart data={series} x="label" type="bar" kind="number" series={range === "year" ? [{ key: "water", label: "Avg water (L)", color: "var(--chart-2)" }, { key: "gym", label: "Gym sessions", color: "var(--chart-3)" }] : [{ key: "water", label: "Water", color: "var(--chart-2)" }]} />
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><div><CardTitle>Measurements</CardTitle><CardDescription>Track once a fortnight or month — same time of day, same tape.</CardDescription></div></CardHeader>
        <CardContent className="grid gap-5">
          <form action={addMeasurement} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Date"><Input type="date" name="date" defaultValue={toISO(today)} /></Field>
            <Field label="Measurement"><Input name="kind" list="measure-kinds" required placeholder="Waist" /></Field>
            <datalist id="measure-kinds">{MEASURES.map((m) => <option key={m} value={m} />)}</datalist>
            <Field label="Value"><Input name="value" inputMode="decimal" required /></Field>
            <Field label="Unit"><Select name="unit" defaultValue="cm"><option>cm</option><option>%</option><option>kg</option><option>in</option></Select></Field>
            <div className="flex items-end justify-end"><SubmitButton size="sm">Add</SubmitButton></div>
          </form>
          {latestByKind.size > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...latestByKind.values()].map((m) => {
                const prev = measurements.find((x) => x.kind === m.kind && x.id !== m.id);
                const d = prev ? m.value - prev.value : null;
                return <Stat key={m.kind} label={m.kind} value={`${m.value} ${m.unit}`} sub={d !== null ? `${d > 0 ? "+" : ""}${r1(d)} since ${fmtShort(prev!.date)}` : fmtDate(m.date)} />;
              })}
            </div>
          )}
          {!measurements.length ? <Empty title="No measurements yet" /> : (
            <ul className="divide-y text-sm">
              {measurements.slice(0, 20).map((m) => (
                <li key={m.id} className="flex items-center justify-between py-1.5">
                  <span>{m.kind} <span className="text-muted-foreground">· {fmtDate(m.date)}</span></span>
                  <span className="flex items-center gap-2 tabular">{m.value} {m.unit}<DeleteButton action={deleteMeasurement} id={m.id} /></span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
