import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getLifeStats } from "@/lib/stats";
import { today as todayFn, addDays, toISO, fmtDate, fmtShort } from "@/lib/dates";
import { money, centsToInput } from "@/lib/money";
import { pct } from "@/lib/utils";
import { saveGoal, deleteGoal, contributeToGoal, markGoalAchieved } from "@/actions/finance";
import { PageHeader, Stat, StatGrid, Disclosure } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/delete-button";
import { TrendChart } from "@/components/charts";
import type { Account, Goal } from "@prisma/client";

export const metadata = { title: "Savings goals" };

function GoalForm({ g, accounts }: { g?: Goal; accounts: Account[] }) {
  const mode = !g ? "total" : g.trackTotalSavings ? "total" : g.accountId ? "account" : "manual";
  return (
    <form action={saveGoal} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {g && <input type="hidden" name="id" value={g.id} />}
      <Field label="Goal name"><Input name="name" defaultValue={g?.name} placeholder="e.g. New laptop" required /></Field>
      <Field label="Target"><Input name="target" inputMode="decimal" defaultValue={centsToInput(g?.targetCents)} required /></Field>
      <Field label="Track progress by">
        <Select name="mode" defaultValue={mode}>
          <option value="total">All savings</option>
          <option value="account">One account</option>
          <option value="manual">Manual contributions</option>
        </Select>
      </Field>
      <Field label="Account (if one account)">
        <Select name="accountId" defaultValue={g?.accountId ?? ""}>
          <option value="">—</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </Field>
      <Field label="Deadline"><Input type="date" name="deadline" defaultValue={g?.deadline ? toISO(g.deadline) : ""} /></Field>
      <div className="col-span-2 flex justify-end sm:col-span-5"><SubmitButton size="sm">{g ? "Save goal" : "Add goal"}</SubmitButton></div>
    </form>
  );
}

export default async function SavingsPage() {
  const { userId, settings } = await getUser();
  const cur = settings.currency;
  const today = todayFn(settings.timezone);
  const since = addDays(today, -84);
  const [goals, accounts, stats, savingsTx] = await Promise.all([
    db.goal.findMany({ where: { userId }, orderBy: [{ achievedAt: "asc" }, { order: "asc" }], include: { account: true, contributions: { orderBy: { date: "desc" } } } }),
    db.account.findMany({ where: { userId, archived: false, type: { not: "LIABILITY" } }, orderBy: { order: "asc" } }),
    getLifeStats(userId),
    db.transaction.findMany({ where: { userId, date: { gt: since }, account: { countsAsSavings: true } }, select: { date: true, amountCents: true, accountId: true } }),
  ]);
  const weeklyRate = Math.round(savingsTx.reduce((s, t) => s + t.amountCents, 0) / 12);
  const accountRate = (id: string) => Math.round(savingsTx.filter((t) => t.accountId === id).reduce((s, t) => s + t.amountCents, 0) / 12);

  // Weekly deposits chart
  const buckets = Array.from({ length: 12 }, (_, i) => ({ label: fmtShort(addDays(since, i * 7 + 1)), saved: 0 }));
  for (const t of savingsTx) {
    const i = Math.min(11, Math.floor((t.date.getTime() - since.getTime() - 1) / (7 * 86_400_000)));
    if (buckets[i]) buckets[i].saved += t.amountCents / 100;
  }

  const view = goals.map((g) => {
    const current = g.trackTotalSavings ? stats.savings : g.account ? g.account.balanceCents : g.contributions.reduce((s, c) => s + c.amountCents, 0);
    const rate = g.trackTotalSavings ? weeklyRate : g.accountId ? accountRate(g.accountId) : Math.round(g.contributions.filter((c) => c.date > since).reduce((s, c) => s + c.amountCents, 0) / 12);
    const remaining = Math.max(0, g.targetCents - current);
    const eta = remaining === 0 ? today : rate > 0 ? addDays(today, Math.ceil(remaining / rate) * 7) : null;
    return { g, current, remaining, rate, eta, progress: pct(current, g.targetCents) };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Savings goals" description="Milestones track your total savings automatically. Custom goals can follow one account or manual contributions." />
      <StatGrid>
        <Stat label="Total savings" value={money(stats.savings, cur)} tone="success" />
        <Stat label="Saving per week" value={money(weeklyRate, cur)} sub="Average, last 12 weeks" />
        <Stat label="Goals reached" value={`${view.filter((v) => v.progress >= 100).length} of ${view.length}`} />
        <Stat label="Next milestone" value={view.find((v) => v.progress < 100)?.g.name ?? "All done"} sub={view.find((v) => v.progress < 100) ? `${money(view.find((v) => v.progress < 100)!.remaining, cur)} to go` : undefined} />
      </StatGrid>

      <Card>
        <CardHeader><div><CardTitle>Contribution history</CardTitle><CardDescription>Money added to savings accounts each week</CardDescription></div></CardHeader>
        <CardContent><TrendChart type="bar" x="label" data={buckets} series={[{ key: "saved", label: "Saved" }]} height={200} /></CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {view.map(({ g, current, eta, progress, rate }) => (
          <Card key={g.id} className={progress >= 100 ? "border-success/40" : undefined}>
            <CardHeader>
              <div>
                <CardTitle className="text-base">{g.name}</CardTitle>
                <CardDescription>{g.trackTotalSavings ? "All savings" : g.account ? g.account.name : "Manual contributions"}{g.deadline && `, due ${fmtDate(g.deadline)}`}</CardDescription>
              </div>
              {progress >= 100 ? <Badge tone="success">Reached</Badge> : <Badge tone="outline">{Math.round(progress)}%</Badge>}
            </CardHeader>
            <CardContent>
              <Progress value={progress} tone={progress >= 100 ? "success" : "primary"} />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular">
                <span>{money(current, cur)} of {money(g.targetCents, cur, { noCents: true })}</span>
                <span>{progress >= 100 ? "Done" : eta ? `Est. ${fmtDate(eta, { month: "short", year: "numeric" })} at ${money(rate, cur, { noCents: true })}/wk` : "Save regularly to get an estimate"}</span>
              </div>
              {!g.trackTotalSavings && !g.accountId && (
                <Disclosure className="mt-3" summary={<span className="text-sm text-primary">Add contribution</span>}>
                  <form action={contributeToGoal} className="flex flex-wrap gap-2">
                    <input type="hidden" name="goalId" value={g.id} />
                    <Input name="amount" inputMode="decimal" placeholder="Amount" className="w-28" required />
                    <Input type="date" name="date" defaultValue={toISO(today)} className="w-40" />
                    <SubmitButton size="sm">Add</SubmitButton>
                  </form>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground tabular">
                    {g.contributions.slice(0, 5).map((c) => <li key={c.id}>{fmtDate(c.date)}: {money(c.amountCents, cur)}</li>)}
                  </ul>
                </Disclosure>
              )}
              <Disclosure className="mt-2" summary={<span className="text-sm text-muted-foreground">Edit goal</span>}>
                <GoalForm g={g} accounts={accounts} />
                <div className="mt-2 flex items-center justify-between">
                  <form action={markGoalAchieved}>
                    <input type="hidden" name="id" value={g.id} />
                    {g.achievedAt && <input type="hidden" name="undo" value="1" />}
                    <button className="text-xs text-muted-foreground hover:text-foreground">{g.achievedAt ? "Mark not achieved" : "Mark achieved"}</button>
                  </form>
                  <DeleteButton action={deleteGoal} id={g.id} confirmText="Delete this goal?" />
                </div>
              </Disclosure>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>New goal</CardTitle></CardHeader>
        <CardContent><GoalForm accounts={accounts} /></CardContent>
      </Card>
    </div>
  );
}
