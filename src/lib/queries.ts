import "server-only";
import { db } from "./db";
import { addDays, fromISO, monthKey, startOfMonth, startOfWeek, toISO, fmtShort } from "./dates";

export async function shiftTotals(userId: string, from: Date, to: Date) {
  const a = await db.shift.aggregate({
    where: { userId, date: { gte: from, lte: to } },
    _sum: { totalMinutes: true, grossCents: true, taxCents: true, netCents: true, superCents: true, overtimeMinutes: true },
    _count: true,
  });
  return {
    shifts: a._count,
    minutes: a._sum.totalMinutes ?? 0,
    overtime: a._sum.overtimeMinutes ?? 0,
    gross: a._sum.grossCents ?? 0,
    tax: a._sum.taxCents ?? 0,
    net: a._sum.netCents ?? 0,
    super: a._sum.superCents ?? 0,
  };
}

/** Weekly buckets for the last `weeks` weeks (inclusive of current). */
export async function weeklySeries(userId: string, today: Date, weeks = 12, weekStartsOn = 1) {
  const first = addDays(startOfWeek(today, weekStartsOn), -(weeks - 1) * 7);
  const [shifts, expenses] = await Promise.all([
    db.shift.findMany({ where: { userId, date: { gte: first } }, select: { date: true, grossCents: true, netCents: true, totalMinutes: true } }),
    db.expense.findMany({ where: { userId, date: { gte: first } }, select: { date: true, amountCents: true } }),
  ]);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const s = addDays(first, i * 7);
    return { key: toISO(s), label: fmtShort(s), gross: 0, net: 0, hours: 0, expenses: 0 };
  });
  const idx = (d: Date) => Math.floor((d.getTime() - first.getTime()) / (7 * 86_400_000));
  for (const s of shifts) {
    const b = buckets[idx(s.date)];
    if (b) { b.gross += s.grossCents / 100; b.net += s.netCents / 100; b.hours += s.totalMinutes / 60; }
  }
  for (const e of expenses) {
    const b = buckets[idx(e.date)];
    if (b) b.expenses += e.amountCents / 100;
  }
  return buckets.map((b) => ({ ...b, gross: round(b.gross), net: round(b.net), hours: round(b.hours), expenses: round(b.expenses) }));
}

export async function monthlySeries(userId: string, today: Date, months = 12) {
  const first = startOfMonth(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1), 1)));
  const [shifts, expenses] = await Promise.all([
    db.shift.findMany({ where: { userId, date: { gte: first } }, select: { date: true, grossCents: true, netCents: true, taxCents: true, totalMinutes: true } }),
    db.expense.findMany({ where: { userId, date: { gte: first } }, select: { date: true, amountCents: true } }),
  ]);
  const map = new Map<string, { label: string; gross: number; net: number; tax: number; hours: number; expenses: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + i, 1));
    map.set(monthKey(d), { label: d.toLocaleString("en-AU", { month: "short", year: "2-digit", timeZone: "UTC" }), gross: 0, net: 0, tax: 0, hours: 0, expenses: 0 });
  }
  for (const s of shifts) {
    const b = map.get(monthKey(s.date));
    if (b) { b.gross += s.grossCents / 100; b.net += s.netCents / 100; b.tax += s.taxCents / 100; b.hours += s.totalMinutes / 60; }
  }
  for (const e of expenses) {
    const b = map.get(monthKey(e.date));
    if (b) b.expenses += e.amountCents / 100;
  }
  return [...map.values()].map((b) => ({ ...b, gross: round(b.gross), net: round(b.net), tax: round(b.tax), hours: round(b.hours), expenses: round(b.expenses), saved: round(b.net - b.expenses) }));
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Habit stats computed from logs. */
export function habitStats(logDates: Date[], targetPerWeek: number, today: Date, weekStartsOn = 1) {
  const set = new Set(logDates.map(toISO));
  let streak = 0;
  let d = set.has(toISO(today)) ? today : addDays(today, -1);
  while (set.has(toISO(d))) { streak++; d = addDays(d, -1); }
  const count = (days: number) => { let c = 0; for (let i = 0; i < days; i++) if (set.has(toISO(addDays(today, -i)))) c++; return c; };
  const weekStart = startOfWeek(today, weekStartsOn);
  let thisWeek = 0;
  for (let i = 0; i < 7; i++) if (set.has(toISO(addDays(weekStart, i)))) thisWeek++;
  const last28 = count(28);
  return {
    streak,
    thisWeek,
    weekly: Math.min(100, (thisWeek / targetPerWeek) * 100),
    monthly: Math.min(100, (count(30) / ((targetPerWeek / 7) * 30)) * 100),
    consistency: Math.min(100, (last28 / (targetPerWeek * 4)) * 100),
    doneToday: set.has(toISO(today)),
  };
}

export { fromISO };
