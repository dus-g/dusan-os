import "server-only";
import { db } from "./db";
import { addDays, startOfWeek } from "./dates";
import { weeklyTaxCents, type TaxOptions } from "./tax";

/**
 * Tax is estimated per pay week (PAYG is withheld on the week's total),
 * then apportioned to each shift by its share of gross.
 */
export async function recalcWeekTax(userId: string, anyDateInWeek: Date, opts: TaxOptions, weekStartsOn = 1) {
  const start = startOfWeek(anyDateInWeek, weekStartsOn);
  const end = addDays(start, 6);
  const shifts = await db.shift.findMany({ where: { userId, date: { gte: start, lte: end } } });
  const gross = shifts.reduce((s, x) => s + x.grossCents, 0);
  const weekTax = weeklyTaxCents(gross, opts);
  let allocated = 0;
  await db.$transaction(
    shifts.map((s, i) => {
      const tax = i === shifts.length - 1 ? weekTax - allocated : Math.round((weekTax * s.grossCents) / (gross || 1));
      allocated += tax;
      return db.shift.update({ where: { id: s.id }, data: { taxCents: tax, netCents: s.grossCents - tax } });
    }),
  );
}
