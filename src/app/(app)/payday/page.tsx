import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { monthlySeries } from "@/lib/queries";
import { today as todayFn, nextWeekday, addDays, toISO, fmtDate, fmtShort, financialYearLabel } from "@/lib/dates";
import { money, hours, centsToInput } from "@/lib/money";
import { createPayday, deletePayday } from "@/actions/finance";
import { PageHeader, Stat, StatGrid, Empty } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/delete-button";
import { TrendChart } from "@/components/charts";

export const metadata = { title: "Payday" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function PaydayPage() {
  const { settings, userId } = await getUser();
  const cur = settings.currency;
  const today = todayFn(settings.timezone);
  const payDate = nextWeekday(today, settings.paydayWeekday);
  // Pay covers the Monday–Sunday week ending the Sunday before payday.
  const periodEnd = addDays(payDate, -(payDate.getUTCDay() === 0 ? 7 : payDate.getUTCDay()));
  const periodStart = addDays(periodEnd, -6);

  const [unpaid, paydays, accounts, monthly] = await Promise.all([
    db.shift.findMany({ where: { userId, paydayId: null, date: { gte: periodStart, lte: periodEnd } } }),
    db.payday.findMany({ where: { userId }, orderBy: { payDate: "asc" } }),
    db.account.findMany({ where: { userId, archived: false, type: { not: "LIABILITY" } }, orderBy: { order: "asc" } }),
    monthlySeries(userId, today, 12),
  ]);
  const est = unpaid.reduce((a, s) => ({ m: a.m + s.totalMinutes, g: a.g + s.grossCents, t: a.t + s.taxCents, n: a.n + s.netCents }), { m: 0, g: 0, t: 0, n: 0 });

  let running = 0;
  const withRunning = paydays.map((p) => ({ ...p, running: (running += p.netCents) }));
  const byFy = new Map<string, number>();
  for (const p of paydays) byFy.set(financialYearLabel(p.payDate), (byFy.get(financialYearLabel(p.payDate)) ?? 0) + p.grossCents / 100);
  const everyday = accounts.find((a) => a.type === "EVERYDAY");
  const savings = accounts.find((a) => a.type === "SAVINGS");
  const totals = paydays.reduce((a, p) => ({ g: a.g + p.grossCents, n: a.n + p.netCents, s: a.s + p.savedCents }), { g: 0, n: 0, s: 0 });

  return (
    <div className="space-y-6">
      <PageHeader title="Payday" description={`You're paid every ${WEEKDAYS[settings.paydayWeekday]}. Record each pay to move money into your accounts and track what you save.`} />

      <StatGrid>
        <Stat label="Next payday" value={fmtDate(payDate, { weekday: "short", day: "numeric", month: "short" })} sub={`Covers ${fmtShort(periodStart)} to ${fmtShort(periodEnd)}`} />
        <Stat label="Expected take-home" value={money(est.n, cur)} sub={`${hours(est.m)}h, ${money(est.g, cur)} gross`} tone="success" />
        <Stat label="Paid to date" value={money(totals.n, cur)} sub={`${paydays.length} pays, ${money(totals.g, cur)} gross`} />
        <Stat label="Saved from pay" value={money(totals.s, cur)} sub={totals.n ? `${Math.round((totals.s / totals.n) * 100)}% of take-home` : "—"} />
      </StatGrid>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Record a pay</CardTitle>
            <CardDescription>Pre-filled from your unpaid shifts. Enter your payslip figures to override the estimate.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form action={createPayday} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Pay date"><Input type="date" name="payDate" defaultValue={toISO(payDate)} required /></Field>
            <Field label="Period start"><Input type="date" name="periodStart" defaultValue={toISO(periodStart)} required /></Field>
            <Field label="Period end"><Input type="date" name="periodEnd" defaultValue={toISO(periodEnd)} required /></Field>
            <Field label="Gross (payslip)"><Input name="gross" inputMode="decimal" placeholder={centsToInput(est.g)} /></Field>
            <Field label="Tax withheld"><Input name="tax" inputMode="decimal" placeholder={centsToInput(est.t)} /></Field>
            <Field label="Net pay"><Input name="net" inputMode="decimal" placeholder={centsToInput(est.n)} /></Field>
            <Field label="Deposit into">
              <Select name="depositAccountId" defaultValue={everyday?.id ?? ""}>
                <option value="">Don't record a deposit</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Amount to save"><Input name="saved" inputMode="decimal" placeholder="0.00" /></Field>
            <Field label="Save into">
              <Select name="savingsAccountId" defaultValue={savings?.id ?? ""}>
                <option value="">—</option>
                {accounts.filter((a) => a.countsAsSavings).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Notes" className="col-span-2"><Textarea name="notes" rows={1} className="min-h-9" /></Field>
            <div className="flex items-end"><SubmitButton className="w-full">Record pay</SubmitButton></div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Weekly pay</CardTitle></CardHeader>
          <CardContent>
            <TrendChart type="bar" x="label" data={withRunning.slice(-26).map((p) => ({ label: fmtShort(p.payDate), net: p.netCents / 100, saved: p.savedCents / 100 }))}
              series={[{ key: "net", label: "Take-home" }, { key: "saved", label: "Saved", color: "var(--chart-3)" }]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Monthly earnings</CardTitle></CardHeader>
          <CardContent><TrendChart type="bar" x="label" data={monthly} series={[{ key: "gross", label: "Gross" }, { key: "net", label: "Take-home" }]} /></CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Yearly earnings (financial year)</CardTitle></CardHeader>
          <CardContent><TrendChart type="bar" x="fy" height={180} data={[...byFy.entries()].map(([fy, gross]) => ({ fy, gross }))} series={[{ key: "gross", label: "Gross" }]} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Pay history</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0 sm:p-0">
          {paydays.length === 0 ? <div className="p-4"><Empty title="No pays recorded yet">Record your first pay above.</Empty></div> : (
            <table className="w-full min-w-[640px] text-sm tabular">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">{["Pay date", "Hours", "Gross", "Tax", "Take-home", "Saved", "Running total", ""].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {[...withRunning].reverse().map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2">{fmtDate(p.payDate)}</td>
                    <td className="px-4 py-2">{hours(p.minutes)}h</td>
                    <td className="px-4 py-2">{money(p.grossCents, cur)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{money(p.taxCents, cur)}</td>
                    <td className="px-4 py-2 font-medium">{money(p.netCents, cur)}</td>
                    <td className="px-4 py-2 text-success">{money(p.savedCents, cur)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{money(p.running, cur)}</td>
                    <td className="px-2 py-1"><DeleteButton action={deletePayday} id={p.id} confirmText="Delete this pay? Its deposits are reversed and shifts marked unpaid." /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
