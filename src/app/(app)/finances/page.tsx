import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { getLifeStats } from "@/lib/stats";
import { netWorthSeries } from "@/lib/ledger";
import { today as todayFn, addDays, toISO, fmtDate, fmtShort } from "@/lib/dates";
import { money, centsToInput } from "@/lib/money";
import { createAccount, updateAccount, moveMoney, transfer, deleteTransaction } from "@/actions/finance";
import { PageHeader, Stat, StatGrid, Disclosure, Empty } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Checkbox } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { DeleteButton } from "@/components/delete-button";
import { TrendChart } from "@/components/charts";

export const metadata = { title: "Accounts" };

const TYPE_LABEL: Record<string, string> = {
  EVERYDAY: "Everyday", SAVINGS: "Savings", EMERGENCY: "Emergency fund", UNIVERSITY: "University fund", INVESTMENT: "Investment",
  HOME_DEPOSIT: "Home deposit", OTHER: "Other", LIABILITY: "Debt",
};

export default async function FinancesPage() {
  const { userId, settings } = await getUser();
  const cur = settings.currency;
  const today = todayFn(settings.timezone);
  const [accounts, stats, series, recent] = await Promise.all([
    db.account.findMany({ where: { userId, archived: false }, orderBy: { order: "asc" } }),
    getLifeStats(userId),
    netWorthSeries(userId, addDays(today, -180), today),
    db.transaction.findMany({ where: { userId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 25, include: { account: { select: { name: true } } } }),
  ]);
  const weekly = series.filter((_, i) => i % 7 === (series.length - 1) % 7).map((p) => ({ label: fmtShort(new Date(p.date)), value: p.value / 100 }));

  return (
    <div className="space-y-6">
      <PageHeader title="Accounts" description="Every balance change is logged as a transaction, so your net worth history is always accurate." />
      <StatGrid>
        <Stat label="Net worth" value={money(stats.netWorth, cur)} />
        <Stat label="Savings" value={money(stats.savings, cur)} tone="success" />
        <Stat label="Everyday" value={money(stats.bank, cur)} />
        <Stat label="Debt" value={money(stats.liabilities, cur)} sub="HECS and other liabilities" tone={stats.liabilities ? "destructive" : undefined} />
      </StatGrid>

      <Card>
        <CardHeader><div><CardTitle>Net worth</CardTitle><CardDescription>Last 6 months, rebuilt from transactions</CardDescription></div></CardHeader>
        <CardContent><TrendChart data={weekly} x="label" series={[{ key: "value", label: "Net worth" }]} /></CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Card key={a.id}>
            <CardHeader className="pb-0">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full" style={{ background: a.color }} />
                <CardTitle>{a.name}</CardTitle>
              </div>
              <Badge tone={a.type === "LIABILITY" ? "destructive" : "outline"}>{TYPE_LABEL[a.type]}</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular">{money(a.balanceCents, cur)}</p>
              <Disclosure className="mt-3" summary={<span className="text-sm text-primary">Update balance</span>}>
                <form action={moveMoney} className="grid grid-cols-2 gap-2">
                  <input type="hidden" name="accountId" value={a.id} />
                  <Field label="Action">
                    <Select name="kind" defaultValue="deposit">
                      <option value="deposit">{a.type === "LIABILITY" ? "Add debt" : "Deposit"}</option>
                      <option value="withdraw">{a.type === "LIABILITY" ? "Repay" : "Withdraw"}</option>
                      <option value="set">Set exact balance</option>
                    </Select>
                  </Field>
                  <Field label="Amount"><Input name="amount" inputMode="decimal" placeholder={centsToInput(a.balanceCents)} required /></Field>
                  <Field label="Date"><Input type="date" name="date" defaultValue={toISO(today)} /></Field>
                  <Field label="Note"><Input name="description" /></Field>
                  <SubmitButton size="sm" className="col-span-2">Save</SubmitButton>
                </form>
              </Disclosure>
              <Disclosure summary={<span className="text-sm text-muted-foreground">Edit account</span>}>
                <form action={updateAccount} className="grid gap-2">
                  <input type="hidden" name="id" value={a.id} />
                  <Field label="Name"><Input name="name" defaultValue={a.name} /></Field>
                  <Field label="Bank"><Input name="institution" defaultValue={a.institution ?? ""} /></Field>
                  <Checkbox name="countsAsSavings" label="Counts toward savings" defaultChecked={a.countsAsSavings} />
                  <Checkbox name="archived" label="Archive account" />
                  <SubmitButton size="sm" variant="secondary">Save account</SubmitButton>
                </form>
              </Disclosure>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Transfer between accounts</CardTitle></CardHeader>
          <CardContent>
            <form action={transfer} className="grid grid-cols-2 gap-3">
              <Field label="From"><Select name="from">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
              <Field label="To"><Select name="to" defaultValue={accounts.find((a) => a.type === "SAVINGS")?.id}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
              <Field label="Amount"><Input name="amount" inputMode="decimal" required /></Field>
              <Field label="Date"><Input type="date" name="date" defaultValue={toISO(today)} /></Field>
              <SubmitButton className="col-span-2">Transfer</SubmitButton>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>New account</CardTitle></CardHeader>
          <CardContent>
            <form action={createAccount} className="grid grid-cols-2 gap-3">
              <Field label="Name"><Input name="name" required /></Field>
              <Field label="Type"><Select name="type">{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field label="Opening balance"><Input name="opening" inputMode="decimal" placeholder="0.00" /></Field>
              <Field label="Colour"><Input type="color" name="color" defaultValue="#4FB3B0" className="p-1" /></Field>
              <Checkbox name="countsAsSavings" label="Counts toward savings" defaultChecked />
              <SubmitButton>Add account</SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Recent transactions</CardTitle></CardHeader>
        <CardContent className="divide-y p-0 sm:p-0">
          {recent.length === 0 && <div className="p-4"><Empty title="No transactions yet">Set your real balances above to get started.</Empty></div>}
          {recent.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{t.description}</p>
                <p className="text-xs text-muted-foreground">{t.account.name}, {fmtDate(t.date)}</p>
              </div>
              <p className={`text-sm tabular ${t.amountCents >= 0 ? "text-success" : ""}`}>{t.amountCents >= 0 ? "+" : ""}{money(t.amountCents, cur)}</p>
              {!t.paydayId && <DeleteButton action={deleteTransaction} id={t.id} confirmText="Reverse this transaction?" />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
