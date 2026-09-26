"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import type { AccountType, BudgetPeriod } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { post, unpost } from "@/lib/ledger";
import { awardXp, syncProgress } from "@/lib/progress";
import { XP } from "@/lib/xp";
import { str, optStr, date, cents, bool, required } from "@/lib/form";
import { today } from "@/lib/dates";

function revalidateMoney() {
  for (const p of ["/dashboard", "/finances", "/expenses", "/budget", "/savings", "/payday", "/analytics", "/missions", "/rpg"]) revalidatePath(p);
}

/** Award savings XP when money lands in a savings account. */
async function savingsXp(userId: string, accountId: string, amountCents: number, refId: string) {
  if (amountCents <= 0) return;
  const a = await db.account.findUnique({ where: { id: accountId } });
  if (!a?.countsAsSavings) return;
  const xp = Math.floor(amountCents / 10_000) * XP.savingsPer100;
  if (xp > 0) await awardXp(userId, "SAVINGS", xp, `Saved $${(amountCents / 100).toFixed(0)} to ${a.name}`, refId);
}

// ─── Paydays ───

export async function createPayday(fd: FormData) {
  const userId = await requireUserId();
  const payDate = required(date(fd, "payDate"), "Pay date");
  const periodStart = required(date(fd, "periodStart"), "Period start");
  const periodEnd = required(date(fd, "periodEnd"), "Period end");
  const shifts = await db.shift.findMany({ where: { userId, paydayId: null, date: { gte: periodStart, lte: periodEnd } } });

  const sum = (k: "totalMinutes" | "grossCents" | "taxCents" | "netCents" | "superCents") => shifts.reduce((s, x) => s + x[k], 0);
  // Payslip figures override the estimate when entered.
  const grossCents = cents(fd, "gross") ?? sum("grossCents");
  const taxCents = cents(fd, "tax") ?? sum("taxCents");
  const netCents = cents(fd, "net") ?? grossCents - taxCents;
  const savedCents = cents(fd, "saved") ?? 0;
  const depositAccountId = optStr(fd, "depositAccountId");
  const savingsAccountId = optStr(fd, "savingsAccountId");

  await db.$transaction(async (tx) => {
    const payday = await tx.payday.create({
      data: {
        userId, payDate, periodStart, periodEnd, minutes: sum("totalMinutes"), grossCents, taxCents, netCents,
        superCents: sum("superCents"), savedCents, notes: optStr(fd, "notes"),
      },
    });
    await tx.shift.updateMany({ where: { id: { in: shifts.map((s) => s.id) } }, data: { paydayId: payday.id } });
    if (depositAccountId) {
      await post(tx, { userId, accountId: depositAccountId, date: payDate, type: "INCOME", amountCents: netCents, description: "Pay — White Marquee", paydayId: payday.id });
    }
    if (savingsAccountId && savedCents > 0) {
      const group = crypto.randomUUID();
      if (depositAccountId) {
        await post(tx, { userId, accountId: depositAccountId, date: payDate, type: "TRANSFER_OUT", amountCents: -savedCents, description: "Payday savings", transferGroupId: group, paydayId: payday.id });
      }
      await post(tx, { userId, accountId: savingsAccountId, date: payDate, type: depositAccountId ? "TRANSFER_IN" : "DEPOSIT", amountCents: savedCents, description: "Payday savings", transferGroupId: group, paydayId: payday.id });
    }
  });
  if (savingsAccountId) await savingsXp(userId, savingsAccountId, savedCents, `payday:${payDate.toISOString()}`);
  await syncProgress(userId);
  revalidateMoney();
}

export async function deletePayday(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  await db.$transaction(async (tx) => {
    await unpost(tx, { userId, paydayId: id });
    await tx.payday.delete({ where: { id, userId } });
  });
  revalidateMoney();
}

// ─── Accounts ───

export async function createAccount(fd: FormData) {
  const userId = await requireUserId();
  const type = (str(fd, "type") || "OTHER") as AccountType;
  const opening = cents(fd, "opening") ?? 0;
  await db.$transaction(async (tx) => {
    const a = await tx.account.create({
      data: {
        userId, name: required(str(fd, "name"), "Name"), type, institution: optStr(fd, "institution"),
        countsAsSavings: type !== "EVERYDAY" && type !== "LIABILITY" && bool(fd, "countsAsSavings"),
        color: str(fd, "color") || "#4FB3B0", order: await tx.account.count({ where: { userId } }),
      },
    });
    if (opening) await post(tx, { userId, accountId: a.id, date: today(), type: "OPENING", amountCents: opening, description: "Opening balance" });
  });
  revalidateMoney();
}

export async function updateAccount(fd: FormData) {
  const userId = await requireUserId();
  await db.account.update({
    where: { id: str(fd, "id"), userId },
    data: { name: required(str(fd, "name"), "Name"), institution: optStr(fd, "institution"), countsAsSavings: bool(fd, "countsAsSavings"), archived: bool(fd, "archived") },
  });
  revalidateMoney();
}

/** kind: deposit | withdraw | set (set the real balance; posts the difference) */
export async function moveMoney(fd: FormData) {
  const userId = await requireUserId();
  const accountId = str(fd, "accountId");
  const kind = str(fd, "kind");
  const amount = required(cents(fd, "amount"), "Amount");
  const d = date(fd, "date") ?? today();
  const description = str(fd, "description") || (kind === "deposit" ? "Deposit" : kind === "withdraw" ? "Withdrawal" : "Balance update");
  let posted = 0;
  await db.$transaction(async (tx) => {
    if (kind === "set") {
      const a = await tx.account.findFirstOrThrow({ where: { id: accountId, userId } });
      posted = amount - a.balanceCents;
      if (posted) await post(tx, { userId, accountId, date: d, type: "ADJUSTMENT", amountCents: posted, description });
    } else {
      posted = kind === "withdraw" ? -Math.abs(amount) : Math.abs(amount);
      await post(tx, { userId, accountId, date: d, type: kind === "withdraw" ? "WITHDRAWAL" : "DEPOSIT", amountCents: posted, description });
    }
  });
  await savingsXp(userId, accountId, posted, `dep:${crypto.randomUUID()}`);
  await syncProgress(userId);
  revalidateMoney();
}

export async function transfer(fd: FormData) {
  const userId = await requireUserId();
  const from = str(fd, "from"), to = str(fd, "to");
  if (!from || !to || from === to) throw new Error("Choose two different accounts.");
  const amount = Math.abs(required(cents(fd, "amount"), "Amount"));
  const d = date(fd, "date") ?? today();
  const group = crypto.randomUUID();
  await db.$transaction(async (tx) => {
    await post(tx, { userId, accountId: from, date: d, type: "TRANSFER_OUT", amountCents: -amount, description: str(fd, "description") || "Transfer", transferGroupId: group });
    await post(tx, { userId, accountId: to, date: d, type: "TRANSFER_IN", amountCents: amount, description: str(fd, "description") || "Transfer", transferGroupId: group });
  });
  await savingsXp(userId, to, amount, `xfer:${group}`);
  await syncProgress(userId);
  revalidateMoney();
}

export async function deleteTransaction(fd: FormData) {
  const userId = await requireUserId();
  const t = await db.transaction.findFirstOrThrow({ where: { id: str(fd, "id"), userId } });
  await db.$transaction(async (tx) => {
    await unpost(tx, t.transferGroupId ? { userId, transferGroupId: t.transferGroupId } : { id: t.id });
    if (t.expenseId) await tx.expense.delete({ where: { id: t.expenseId } });
  });
  revalidateMoney();
}

// ─── Expenses & categories ───

export async function createExpense(fd: FormData) {
  const userId = await requireUserId();
  const amount = Math.abs(required(cents(fd, "amount"), "Amount"));
  const accountId = optStr(fd, "accountId");
  const d = date(fd, "date") ?? today();
  await db.$transaction(async (tx) => {
    const e = await tx.expense.create({
      data: {
        userId, categoryId: required(str(fd, "categoryId"), "Category"), accountId, date: d,
        description: str(fd, "description") || "Expense", amountCents: amount, notes: optStr(fd, "notes"),
      },
    });
    if (accountId) await post(tx, { userId, accountId, date: d, type: "EXPENSE", amountCents: -amount, description: e.description, expenseId: e.id });
  });
  revalidateMoney();
}

export async function deleteExpense(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  await db.$transaction(async (tx) => {
    await unpost(tx, { userId, expenseId: id });
    await tx.expense.delete({ where: { id, userId } });
  });
  revalidateMoney();
}

export async function createCategory(fd: FormData) {
  const userId = await requireUserId();
  const name = required(str(fd, "name"), "Name");
  await db.category.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name, color: str(fd, "color") || "#8C95A8" },
    update: { archived: false },
  });
  revalidateMoney();
  revalidatePath("/settings");
}

export async function archiveCategory(fd: FormData) {
  const userId = await requireUserId();
  await db.category.update({ where: { id: str(fd, "id"), userId }, data: { archived: true } });
  revalidateMoney();
  revalidatePath("/settings");
}

export async function saveBudget(fd: FormData) {
  const userId = await requireUserId();
  const categoryId = str(fd, "categoryId");
  const amount = cents(fd, "amount");
  const period = (str(fd, "period") || "WEEKLY") as BudgetPeriod;
  await db.category.findFirstOrThrow({ where: { id: categoryId, userId } });
  if (!amount) await db.budget.deleteMany({ where: { userId, categoryId } });
  else await db.budget.upsert({ where: { categoryId }, create: { userId, categoryId, amountCents: amount, period }, update: { amountCents: amount, period } });
  revalidatePath("/budget");
  revalidatePath("/dashboard");
}

// ─── Goals ───

export async function saveGoal(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const mode = str(fd, "mode"); // total | account | manual
  const data = {
    name: required(str(fd, "name"), "Name"),
    targetCents: required(cents(fd, "target"), "Target"),
    trackTotalSavings: mode === "total",
    accountId: mode === "account" ? optStr(fd, "accountId") : null,
    deadline: date(fd, "deadline"),
  };
  if (id) await db.goal.update({ where: { id, userId }, data });
  else await db.goal.create({ data: { ...data, userId, order: await db.goal.count({ where: { userId } }) } });
  revalidateMoney();
}

export async function deleteGoal(fd: FormData) {
  const userId = await requireUserId();
  await db.goal.delete({ where: { id: str(fd, "id"), userId } });
  revalidateMoney();
}

export async function contributeToGoal(fd: FormData) {
  const userId = await requireUserId();
  const goalId = str(fd, "goalId");
  const amount = required(cents(fd, "amount"), "Amount");
  await db.goal.findFirstOrThrow({ where: { id: goalId, userId } });
  const c = await db.goalContribution.create({ data: { userId, goalId, date: date(fd, "date") ?? today(), amountCents: amount, note: optStr(fd, "note") } });
  if (amount > 0) await awardXp(userId, "SAVINGS", Math.max(1, Math.floor(amount / 10_000)) * XP.savingsPer100, "Goal contribution", `goalc:${c.id}`);
  revalidateMoney();
}

export async function markGoalAchieved(fd: FormData) {
  const userId = await requireUserId();
  await db.goal.update({ where: { id: str(fd, "id"), userId }, data: { achievedAt: bool(fd, "undo") ? null : new Date() } });
  revalidateMoney();
}

