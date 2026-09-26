import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { weeklySeries } from "@/lib/queries";
import { today as todayFn, startOfWeek, addDays, startOfMonth, endOfMonth } from "@/lib/dates";
import { money, centsToInput } from "@/lib/money";
import { saveBudget } from "@/actions/finance";
import { PageHeader, Stat, StatGrid } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { SubmitButton } from "@/components/ui/submit-button";
import { TrendChart } from "@/components/charts";

export const metadata = { title: "Budget" };

/** Convert any budget period to a weekly amount. */
const toWeekly = (cents: number, p: string) => (p === "WEEKLY" ? cents : p === "MONTHLY" ? (cents * 12) / 52 : cents / 52);

export default async function BudgetPage() {
  const { userId, settings } = await getUser();
  const cur = settings.currency;
  const today = todayFn(settings.timezone);
  const ws = startOfWeek(today, settings.weekStartsOn);
  const [categories, weekExp, monthExp, series] = await Promise.all([
    db.category.findMany({ where: { userId, archived: false }, include: { budget: true }, orderBy: { name: "asc" } }),
    db.expense.groupBy({ by: ["categoryId"], where: { userId, date: { gte: ws, lte: addDays(ws, 6) } }, _sum: { amountCents: true } }),
    db.expense.groupBy({ by: ["categoryId"], where: { userId, date: { gte: startOfMonth(today), lte: endOfMonth(today) } }, _sum: { amountCents: true } }),
    weeklySeries(userId, today, 12, settings.weekStartsOn),
  ]);
  const spentWeek = new Map(weekExp.map((e) => [e.categoryId, e._sum.amountCents ?? 0]));
  const spentMonth = new Map(monthExp.map((e) => [e.categoryId, e._sum.amountCents ?? 0]));

  const weeklyBudget = Math.round(categories.reduce((s, c) => s + (c.budget ? toWeekly(c.budget.amountCents, c.budget.period) : 0), 0));
  const monthlyBudget = Math.round((weeklyBudget * 52) / 12);
  const weekSpent = [...spentWeek.values()].reduce((a, b) => a + b, 0);
  const last4 = series.slice(-5, -1); // last 4 complete weeks
  const avgIncome = Math.round((last4.reduce((s, w) => s + w.net, 0) / Math.max(1, last4.length)) * 100);
  const avgExpenses = Math.round((last4.reduce((s, w) => s + w.expenses, 0) / Math.max(1, last4.length)) * 100);
  const netSavings = avgIncome - avgExpenses;
  const savingsRate = avgIncome ? (netSavings / avgIncome) * 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Budget" description="Set weekly or monthly limits per category. Totals are converted so every view lines up." />
      <StatGrid>
        <Stat label="Weekly budget" value={money(weeklyBudget, cur)} sub={`${money(monthlyBudget, cur)}/month, ${money(weeklyBudget * 52, cur, { noCents: true })}/year`} />
        <Stat label="Left this week" value={money(weeklyBudget - weekSpent, cur)} tone={weeklyBudget - weekSpent < 0 ? "destructive" : "success"} sub={`${money(weekSpent, cur)} spent`} />
        <Stat label="Avg weekly income" value={money(avgIncome, cur)} sub={`${money(avgExpenses, cur)} avg expenses`} />
        <Stat label="Savings rate" value={`${Math.round(savingsRate)}%`} sub={`${money(netSavings, cur)}/week net`} tone={savingsRate >= 0 ? "success" : "destructive"} />
      </StatGrid>

      <Card>
        <CardHeader><div><CardTitle>Cash flow</CardTitle><CardDescription>Take-home pay against spending, by week</CardDescription></div></CardHeader>
        <CardContent>
          <TrendChart type="bar" x="label" data={series} series={[{ key: "net", label: "Income" }, { key: "expenses", label: "Expenses", color: "var(--chart-4)" }]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Categories</CardTitle><CardDescription>Clear an amount and save to remove a budget.</CardDescription></div></CardHeader>
        <CardContent className="divide-y p-0 sm:p-0">
          {categories.map((c) => {
            const b = c.budget;
            const spent = b?.period === "MONTHLY" ? spentMonth.get(c.id) ?? 0 : spentWeek.get(c.id) ?? 0;
            const limit = b?.amountCents ?? 0;
            const pctUsed = limit ? (spent / limit) * 100 : 0;
            return (
              <div key={c.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                <div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: c.color }} />{c.name}</span>
                    {b && <span className="text-xs text-muted-foreground tabular">{money(spent, cur)} of {money(limit, cur)} {b.period === "MONTHLY" ? "this month" : "this week"}</span>}
                  </div>
                  {b && <Progress className="mt-2" value={pctUsed} tone={pctUsed > 100 ? "destructive" : pctUsed > 85 ? "xp" : "primary"} />}
                </div>
                <form action={saveBudget} className="flex gap-2">
                  <input type="hidden" name="categoryId" value={c.id} />
                  <Input name="amount" inputMode="decimal" defaultValue={centsToInput(b?.amountCents)} placeholder="No limit" className="w-24" />
                  <Select name="period" defaultValue={b?.period ?? "WEEKLY"} className="w-28">
                    <option value="WEEKLY">/ week</option><option value="MONTHLY">/ month</option><option value="YEARLY">/ year</option>
                  </Select>
                  <SubmitButton size="sm" variant="secondary">Save</SubmitButton>
                </form>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
