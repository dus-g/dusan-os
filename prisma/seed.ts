/**
 * Seeds Dusan's account with every default: pay profile, accounts, categories,
 * budgets, savings goals, missions, habits, roadmap, programs and entry requirements.
 *
 *   npm run db:seed
 *
 * Idempotent: if the user already exists nothing is changed.
 * Set SEED_SAMPLE=1 to also add six weeks of example shifts.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { bootstrapUser } from "../src/lib/bootstrap";
import { calculateShiftPay, superCents } from "../src/lib/pay";
import { weeklyTaxCents } from "../src/lib/tax";
import { addDays, startOfWeek, today, fromISO } from "../src/lib/dates";
import { XP } from "../src/lib/xp";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SEED_EMAIL ?? "dusan@example.com").toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "change-me-please";
  if (password.length < 8) throw new Error("SEED_PASSWORD must be at least 8 characters.");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ ${email} already exists — nothing to do.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({ data: { name: "Dusan", email, passwordHash } });
    await bootstrapUser(tx, u.id, { dateOfBirth: fromISO("2003-12-09") });
    return u;
  }, { timeout: 60_000 });
  console.log(`✓ Created ${email} with all defaults.`);

  if (process.env.SEED_SAMPLE === "1") await sampleShifts(user.id);
}

/** Six weeks of realistic event-hire shifts (Thu–Sun heavy). */
async function sampleShifts(userId: string) {
  const [rate, settings] = await Promise.all([
    db.payRate.findFirstOrThrow({ where: { userId, isDefault: true } }),
    db.settings.findUniqueOrThrow({ where: { userId } }),
  ]);
  const opts = { mode: settings.taxMode, flatRate: settings.flatTaxRate, hasStudyLoan: settings.hasStudyLoan } as const;
  const pattern: [number, number, number, number][] = [
    // [dayOffsetFromMonday, start, end, break]
    [3, 7 * 60, 15 * 60 + 30, 30],
    [4, 6 * 60 + 30, 17 * 60, 30],
    [5, 7 * 60, 16 * 60, 30],
    [6, 8 * 60, 14 * 60, 30],
  ];
  const thisWeek = startOfWeek(today(), 1);
  let count = 0;
  for (let w = 6; w >= 1; w--) {
    const monday = addDays(thisWeek, -w * 7);
    const rows = pattern.map(([d, start, end, brk]) => {
      const date = addDays(monday, d);
      const shiftType = date.getUTCDay() === 0 ? ("SUNDAY" as const) : ("STANDARD" as const);
      const p = calculateShiftPay({ startMinute: start, endMinute: end, breakMinutes: brk, shiftType }, rate);
      return { date, start, end, brk, shiftType, p };
    });
    const weekGross = rows.reduce((s, r) => s + r.p.grossCents, 0);
    const weekTax = weeklyTaxCents(weekGross, opts);
    let allocated = 0;
    for (const [i, r] of rows.entries()) {
      const tax = i === rows.length - 1 ? weekTax - allocated : Math.round((weekTax * r.p.grossCents) / weekGross);
      allocated += tax;
      const shift = await db.shift.create({
        data: {
          userId, payRateId: rate.id, date: r.date, startMinute: r.start, endMinute: r.end, breakMinutes: r.brk,
          shiftType: r.shiftType, location: "Warehouse / site", ...r.p,
          superCents: superCents(r.p.ordinaryCents, settings.superRate), taxCents: tax, netCents: r.p.grossCents - tax,
        },
      });
      await db.xpEvent.create({
        data: { userId, source: "WORK", amount: XP.shiftBase + Math.floor(r.p.totalMinutes / 60) * XP.shiftPerHour, reason: `Shift on ${r.date.toISOString().slice(0, 10)}`, refId: `shift:${shift.id}` },
      });
      count++;
    }
  }
  console.log(`✓ Added ${count} sample shifts. Open the dashboard to unlock the first achievements.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
