/**
 * Date helpers. Calendar days are handled as UTC-midnight Date objects
 * (matching Postgres @db.Date), and "today" is resolved in the user's time zone.
 */

export const TZ = "Australia/Adelaide";
const DAY = 86_400_000;

export function todayISO(tz = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function today(tz = TZ) {
  return fromISO(todayISO(tz));
}

export function fromISO(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, n: number) {
  return new Date(d.getTime() + n * DAY);
}

export function diffDays(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / DAY);
}

/** Start of week (default Monday) for a UTC-midnight date. */
export function startOfWeek(d: Date, weekStartsOn = 1) {
  const dow = d.getUTCDay();
  const delta = (dow - weekStartsOn + 7) % 7;
  return addDays(d, -delta);
}

export function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

export function startOfYear(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

/** Australian financial year starts 1 July. */
export function startOfFinancialYear(d: Date) {
  const y = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return new Date(Date.UTC(y, 6, 1));
}

export function financialYearLabel(d: Date) {
  const s = startOfFinancialYear(d).getUTCFullYear();
  return `FY${String(s + 1).slice(2)}`;
}

export function ageOn(dob: Date, on: Date) {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const m = on.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function daysUntilBirthday(dob: Date, on: Date) {
  let next = new Date(Date.UTC(on.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()));
  if (next < on) next = new Date(Date.UTC(on.getUTCFullYear() + 1, dob.getUTCMonth(), dob.getUTCDate()));
  return diffDays(next, on);
}

/** Next occurrence of weekday (0=Sun) on or after d. */
export function nextWeekday(d: Date, weekday: number) {
  return addDays(d, (weekday - d.getUTCDay() + 7) % 7);
}

export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  const date = typeof d === "string" ? fromISO(d) : d;
  return new Intl.DateTimeFormat("en-AU", { ...opts, timeZone: "UTC" }).format(date);
}

export function fmtShort(d: Date) {
  return fmtDate(d, { day: "numeric", month: "short" });
}

export function weekdayName(d: Date) {
  return fmtDate(d, { weekday: "short" });
}

export function minutesToTime(m: number) {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}

export function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}
