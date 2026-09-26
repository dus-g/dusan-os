import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { today as todayFn, toISO, fmtDate, startOfMonth, endOfMonth, fromISO, monthKey } from "@/lib/dates";
import { money } from "@/lib/money";
import { createExpense, deleteExpense, createCategory } from "@/actions/finance";
import { PageHeader, Stat, StatGrid, Empty, Disclosure } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/delete-button";
import { TrendChart } from "@/components/charts";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ month?: string; category?: string }> }) {
  const { userId, settings } = await getUser();
  const cur = settings.currency;
  const today = todayFn(settings.timezone);
  const sp = await searchParams;
  const monthStart = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? fromISO(`${sp.month}-01`) : startOfMonth(today);
  const monthEnd = endOfMonth(monthStart);
  const prev = monthKey(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1)));
  const next = monthKey(new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)));

  const [categories, accounts, expenses] = await Promise.all([
    db.category.findMany({ where: { userId, archived: false }, orderBy: { name: "asc" } }),
    db.account.findMany({ where: { userId, archived: false, type: { not: "LIABILITY" } }, orderBy: { order: "asc" } }),
    db.expense.findMany({
      where: { userId, date: { gte: monthStart, lte: monthEnd }, ...(sp.category ? { categoryId: sp.category } : {}) },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { category: true, account: { select: { name: true } } },
    }),
  ]);
  const total = expenses.reduce((s, e) => s + e.amountCents, 0);
  const byCat = new Map<string, { name: string; color: string; total: number }>();
  for (const e of expenses) {
    const c = byCat.get(e.categoryId) ?? { name: e.category.name, color: e.category.color, total: 0 };
    c.total += e.amountCents;
    byCat.set(e.categoryId, c);
  }
  const catData = [...byCat.values()].sort((a, b) => b.total - a.total).map((c) => ({ name: c.name, amount: c.total / 100 }));
  const days = Math.max(1, Math.min(today.getTime(), monthEnd.getTime()) - monthStart.getTime()) / 86_400_000 + 1;
  const everyday = accounts.find((a) => a.type === "EVERYDAY");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description={fmtDate(monthStart, { month: "long", year: "numeric" })}
        actions={
          <div className="flex gap-1 text-sm">
            <Link className="rounded-md border px-3 py-1.5 hover:bg-secondary" href={`/expenses?month=${prev}`}>Previous</Link>
            <Link className="rounded-md border px-3 py-1.5 hover:bg-secondary" href={`/expenses?month=${next}`}>Next</Link>
          </div>
        }
      />
      <StatGrid>
        <Stat label="Spent this month" value={money(total, cur)} />
        <Stat label="Per day" value={money(Math.round(total / days), cur)} />
        <Stat label="Transactions" value={expenses.length} />
        <Stat label="Top category" value={catData[0]?.name ?? "—"} sub={catData[0] ? money(catData[0].amount * 100, cur) : undefined} />
      </StatGrid>

      <Card id="add">
        <CardHeader><CardTitle>Add expense</CardTitle></CardHeader>
        <CardContent>
          <form action={createExpense} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Field label="Amount"><Input name="amount" inputMode="decimal" placeholder="0.00" required autoFocus={false} /></Field>
            <Field label="Category">
              <Select name="categoryId" required defaultValue={categories.find((c) => c.name === "Groceries")?.id}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Description" className="col-span-2"><Input name="description" placeholder="e.g. Coles weekly shop" /></Field>
            <Field label="Date"><Input type="date" name="date" defaultValue={toISO(today)} /></Field>
            <Field label="Paid from">
              <Select name="accountId" defaultValue={everyday?.id ?? ""}>
                <option value="">Don't deduct</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="Notes" className="col-span-2 sm:col-span-5"><Textarea name="notes" rows={1} className="min-h-9" /></Field>
            <div className="col-span-2 flex items-end sm:col-span-1"><SubmitButton className="w-full">Add</SubmitButton></div>
          </form>
          <Disclosure className="mt-3" summary={<span className="text-sm text-muted-foreground">Add a custom category</span>}>
            <form action={createCategory} className="flex gap-2">
              <Input name="name" placeholder="Category name" required className="max-w-xs" />
              <Input type="color" name="color" defaultValue="#8C95A8" className="w-12 p-1" />
              <SubmitButton variant="secondary">Add category</SubmitButton>
            </form>
          </Disclosure>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>By category</CardTitle></CardHeader>
          <CardContent>
            <TrendChart type="bar" x="name" data={catData.slice(0, 8)} series={[{ key: "amount", label: "Spent" }]} height={240} />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {sp.category && <Link href={`/expenses?month=${monthKey(monthStart)}`} className="rounded-full border px-2 py-0.5 text-xs">All</Link>}
              {[...byCat.entries()].map(([id, c]) => (
                <Link key={id} href={`/expenses?month=${monthKey(monthStart)}&category=${id}`} className="rounded-full border px-2 py-0.5 text-xs hover:bg-secondary">
                  <span className="mr-1 inline-block size-2 rounded-full" style={{ background: c.color }} />{c.name}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
          <CardContent className="divide-y p-0 sm:p-0">
            {expenses.length === 0 && <div className="p-4"><Empty title="Nothing spent this month">Add expenses as they happen — it takes ten seconds.</Empty></div>}
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className="size-2 shrink-0 rounded-full" style={{ background: e.category.color }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{e.description}</p>
                  <p className="truncate text-xs text-muted-foreground">{e.category.name}, {fmtDate(e.date, { day: "numeric", month: "short" })}{e.account && `, ${e.account.name}`}</p>
                </div>
                <p className="text-sm tabular">{money(e.amountCents, cur)}</p>
                <DeleteButton action={deleteExpense} id={e.id} confirmText="Delete this expense? Its account deduction is reversed." />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
