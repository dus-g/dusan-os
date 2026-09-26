import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { shiftTotals } from "@/lib/queries";
import { today as todayFn, startOfWeek, addDays, fmtDate, minutesToTime, toISO, fmtShort } from "@/lib/dates";
import { money, hours } from "@/lib/money";
import { SHIFT_TYPE_LABEL } from "@/lib/pay";
import { createShift, updateShift, deleteShift } from "@/actions/work";
import { PageHeader, Stat, StatGrid, Empty, Disclosure } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";
import { ShiftForm } from "@/components/work/shift-form";

export const metadata = { title: "Shifts" };

export default async function WorkPage({ searchParams }: { searchParams: Promise<{ weeks?: string }> }) {
  const { settings, userId } = await getUser();
  const cur = settings.currency;
  const today = todayFn(settings.timezone);
  const weeksShown = Math.min(104, Number((await searchParams).weeks) || 8);
  const weekStart = startOfWeek(today, settings.weekStartsOn);
  const from = addDays(weekStart, -(weeksShown - 1) * 7);

  const [rates, shifts, week, defaultRate] = await Promise.all([
    db.payRate.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    db.shift.findMany({ where: { userId, date: { gte: from } }, orderBy: [{ date: "desc" }, { startMinute: "desc" }], include: { payRate: { select: { name: true } } } }),
    shiftTotals(userId, weekStart, addDays(weekStart, 6)),
    db.payRate.findFirst({ where: { userId, isDefault: true } }),
  ]);

  const groups = new Map<string, typeof shifts>();
  for (const s of shifts) {
    const k = toISO(startOfWeek(s.date, settings.weekStartsOn));
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shifts"
        description={defaultRate ? `${defaultRate.role} at ${defaultRate.employer}, ${money(defaultRate.baseRateCents, cur)}/h base.` : "Add a pay profile to start logging shifts."}
        actions={<Button asChild variant="outline" size="sm"><Link href="/work/rates">Pay profiles</Link></Button>}
      />

      <StatGrid>
        <Stat label="Hours this week" value={`${hours(week.minutes)}h`} sub={`${week.shifts} shifts, ${hours(week.overtime)}h overtime`} />
        <Stat label="Gross this week" value={money(week.gross, cur)} />
        <Stat label="Est. tax" value={money(week.tax, cur)} sub="PAYG estimate" />
        <Stat label="Take-home" value={money(week.net, cur)} sub={`+ ${money(week.super, cur)} super`} tone="success" />
      </StatGrid>

      <Card id="log">
        <CardHeader>
          <div>
            <CardTitle>Log a shift</CardTitle>
            <CardDescription>Hours, overtime, tax, and super are calculated for you.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {rates.length ? <ShiftForm action={createShift} rates={rates} today={today} /> : <Empty title="No pay profile yet"><Link className="text-primary" href="/work/rates">Create one</Link> to start logging.</Empty>}
        </CardContent>
      </Card>

      <section className="space-y-4">
        {groups.size === 0 && <Empty title="No shifts in this period">Log your first shift above to earn the “First shift” achievement.</Empty>}
        {[...groups.entries()].map(([wk, list]) => {
          const t = list.reduce((a, s) => ({ m: a.m + s.totalMinutes, g: a.g + s.grossCents, n: a.n + s.netCents }), { m: 0, g: 0, n: 0 });
          return (
            <Card key={wk}>
              <CardHeader className="pb-1">
                <CardTitle>Week of {fmtShort(new Date(wk))}</CardTitle>
                <p className="text-xs text-muted-foreground tabular">{hours(t.m)}h, {money(t.g, cur)} gross, {money(t.n, cur)} net</p>
              </CardHeader>
              <CardContent className="divide-y p-0 sm:p-0">
                {list.map((s) => (
                  <Disclosure
                    key={s.id}
                    className="px-4 py-3 sm:px-5"
                    summary={
                      <div className="flex items-center gap-3">
                        <div className="w-20 shrink-0">
                          <p className="text-sm font-medium">{fmtDate(s.date, { weekday: "short", day: "numeric" })}</p>
                          <p className="text-xs text-muted-foreground tabular">{minutesToTime(s.startMinute)}–{minutesToTime(s.endMinute)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{s.location || s.payRate.name}</p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {s.shiftType !== "STANDARD" && <Badge tone="primary">{SHIFT_TYPE_LABEL[s.shiftType]}</Badge>}
                            {s.overtimeMinutes > 0 && <Badge tone="xp">{hours(s.overtimeMinutes)}h OT</Badge>}
                            {s.paydayId && <Badge tone="success">Paid</Badge>}
                          </div>
                        </div>
                        <div className="text-right tabular">
                          <p className="text-sm font-medium">{money(s.grossCents, cur)}</p>
                          <p className="text-xs text-muted-foreground">{hours(s.totalMinutes, 2)}h, net {money(s.netCents, cur)}</p>
                        </div>
                      </div>
                    }
                  >
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground tabular">
                        Regular {hours(s.regularMinutes, 2)}h, overtime {hours(s.overtimeMinutes, 2)}h, tax {money(s.taxCents, cur)}, super {money(s.superCents, cur)}{s.notes && `. ${s.notes}`}
                      </p>
                      <ShiftForm action={updateShift} rates={rates} shift={s} today={today} submit="Save changes" />
                      <div className="flex justify-end"><DeleteButton action={deleteShift} id={s.id} label="Delete shift" confirmText="Delete this shift? Its XP is removed too." /></div>
                    </div>
                  </Disclosure>
                ))}
              </CardContent>
            </Card>
          );
        })}
        {shifts.length > 0 && (
          <div className="text-center">
            <Link href={`/work?weeks=${weeksShown + 8}`} className="text-sm text-primary hover:underline">Show 8 more weeks</Link>
          </div>
        )}
      </section>
    </div>
  );
}
