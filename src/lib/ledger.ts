import "server-only";
import type { Prisma, TransactionType } from "@prisma/client";
import { db } from "./db";

/** Post a signed amount to an account and keep its balance in sync (atomic). */
export async function post(
  tx: Prisma.TransactionClient,
  data: { userId: string; accountId: string; date: Date; type: TransactionType; amountCents: number; description: string; transferGroupId?: string; expenseId?: string; paydayId?: string },
) {
  const account = await tx.account.findFirst({ where: { id: data.accountId, userId: data.userId } });
  if (!account) throw new Error("Account not found");
  const t = await tx.transaction.create({ data });
  await tx.account.update({ where: { id: account.id }, data: { balanceCents: { increment: data.amountCents } } });
  return t;
}

/** Reverse and delete transactions matching a filter. */
export async function unpost(tx: Prisma.TransactionClient, where: Prisma.TransactionWhereInput) {
  const txs = await tx.transaction.findMany({ where });
  for (const t of txs) {
    await tx.account.update({ where: { id: t.accountId }, data: { balanceCents: { decrement: t.amountCents } } });
  }
  await tx.transaction.deleteMany({ where: { id: { in: txs.map((t) => t.id) } } });
}

/** Rebuild a daily net-worth series from the transaction log. */
export async function netWorthSeries(userId: string, from: Date, to: Date) {
  const accounts = await db.account.findMany({ where: { userId, archived: false }, select: { id: true, type: true, balanceCents: true } });
  const sign = new Map(accounts.map((a) => [a.id, a.type === "LIABILITY" ? -1 : 1]));
  let current = accounts.reduce((s, a) => s + a.balanceCents * (sign.get(a.id) ?? 1), 0);
  const txs = await db.transaction.findMany({
    where: { userId, date: { gt: from }, accountId: { in: accounts.map((a) => a.id) } },
    select: { date: true, amountCents: true, accountId: true },
    orderBy: { date: "desc" },
  });
  // Walk backwards from today's balance.
  const byDay = new Map<string, number>();
  for (const t of txs) {
    const k = t.date.toISOString().slice(0, 10);
    byDay.set(k, (byDay.get(k) ?? 0) + t.amountCents * (sign.get(t.accountId) ?? 1));
  }
  const out: { date: string; value: number }[] = [];
  for (let d = new Date(to); d >= from; d = new Date(d.getTime() - 86_400_000)) {
    const k = d.toISOString().slice(0, 10);
    out.push({ date: k, value: current });
    current -= byDay.get(k) ?? 0;
  }
  return out.reverse();
}
