import "server-only";
import { db } from "./db";
import { diffDays, today as todayFn, fromISO } from "./dates";

export interface LifeStats {
  shiftCount: number;
  lifetimeMinutes: number;
  lifetimeGross: number;
  lifetimeTax: number;
  lifetimeNet: number;
  lifetimeSuper: number;
  lifetimeExpenses: number;
  savings: number;
  bank: number;
  netWorth: number;
  assets: number;
  liabilities: number;
  xp: number;
  firstShift: Date | null;
  daysEmployed: number;
  weeksWorking: number;
  avgWeeklyGross: number;
  avgWeeklyMinutes: number;
  uniStarted: boolean;
  paydayCount: number;
  journalCount: number;
  bestHabitStreak: number;
  gamsatSat: boolean;
  semestersCompleted: number;
  bachelorCompleted: boolean;
  medicineStarted: boolean;
  medicineCompleted: boolean;
}

export async function getLifeStats(userId: string): Promise<LifeStats> {
  const today = todayFn();
  const [shiftAgg, firstShift, accounts, expenseAgg, xpAgg, programs, paydayCount, journalCount, gamsat, semestersCompleted, habitLogs] =
    await Promise.all([
      db.shift.aggregate({ where: { userId }, _sum: { totalMinutes: true, grossCents: true, taxCents: true, netCents: true, superCents: true }, _count: true }),
      db.shift.findFirst({ where: { userId }, orderBy: { date: "asc" }, select: { date: true } }),
      db.account.findMany({ where: { userId, archived: false }, select: { type: true, balanceCents: true, countsAsSavings: true } }),
      db.expense.aggregate({ where: { userId }, _sum: { amountCents: true } }),
      db.xpEvent.aggregate({ where: { userId }, _sum: { amount: true } }),
      db.universityProgram.findMany({ where: { userId }, select: { kind: true, startDate: true, status: true } }),
      db.payday.count({ where: { userId } }),
      db.journalEntry.count({ where: { userId } }),
      db.gamsatAttempt.count({ where: { userId } }),
      db.semester.count({ where: { userId, completed: true } }),
      db.habitLog.findMany({ where: { userId, date: { gte: fromISO("2000-01-01") } }, select: { habitId: true, date: true }, orderBy: { date: "asc" } }),
    ]);

  let assets = 0, liabilities = 0, savings = 0, bank = 0;
  for (const a of accounts) {
    if (a.type === "LIABILITY") liabilities += a.balanceCents;
    else {
      assets += a.balanceCents;
      if (a.countsAsSavings) savings += a.balanceCents;
      if (a.type === "EVERYDAY") bank += a.balanceCents;
    }
  }

  const minutes = shiftAgg._sum.totalMinutes ?? 0;
  const gross = shiftAgg._sum.grossCents ?? 0;
  const daysEmployed = firstShift ? diffDays(today, firstShift.date) + 1 : 0;
  const weeks = Math.max(1, daysEmployed / 7);

  const bachelor = programs.find((p) => p.kind === "BACHELOR");
  const med = programs.find((p) => p.kind === "MEDICINE");

  return {
    shiftCount: shiftAgg._count,
    lifetimeMinutes: minutes,
    lifetimeGross: gross,
    lifetimeTax: shiftAgg._sum.taxCents ?? 0,
    lifetimeNet: shiftAgg._sum.netCents ?? 0,
    lifetimeSuper: shiftAgg._sum.superCents ?? 0,
    lifetimeExpenses: expenseAgg._sum.amountCents ?? 0,
    savings, bank, assets, liabilities,
    netWorth: assets - liabilities,
    xp: xpAgg._sum.amount ?? 0,
    firstShift: firstShift?.date ?? null,
    daysEmployed,
    weeksWorking: weeks,
    avgWeeklyGross: firstShift ? Math.round(gross / weeks) : 0,
    avgWeeklyMinutes: firstShift ? Math.round(minutes / weeks) : 0,
    uniStarted: !!bachelor && (bachelor.status === "ACTIVE" || bachelor.status === "COMPLETED" || bachelor.startDate <= today),
    paydayCount,
    journalCount,
    bestHabitStreak: bestStreak(habitLogs),
    gamsatSat: gamsat > 0,
    semestersCompleted,
    bachelorCompleted: bachelor?.status === "COMPLETED",
    medicineStarted: !!med && (med.status === "ACTIVE" || med.status === "COMPLETED"),
    medicineCompleted: med?.status === "COMPLETED",
  };
}

function bestStreak(logs: { habitId: string; date: Date }[]) {
  const byHabit = new Map<string, number[]>();
  for (const l of logs) {
    const arr = byHabit.get(l.habitId) ?? [];
    arr.push(Math.round(l.date.getTime() / 86_400_000));
    byHabit.set(l.habitId, arr);
  }
  let best = 0;
  for (const days of byHabit.values()) {
    let run = 0, prev = -Infinity;
    for (const d of days) {
      run = d === prev + 1 ? run + 1 : 1;
      prev = d;
      best = Math.max(best, run);
    }
  }
  return best;
}
