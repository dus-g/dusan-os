/** All money in Dusan OS is integer cents. */

const formatters = new Map<string, Intl.NumberFormat>();

export function money(cents: number, currency = "AUD", opts: { compact?: boolean; noCents?: boolean } = {}) {
  const key = `${currency}-${opts.compact}-${opts.noCents}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: opts.noCents || opts.compact ? 0 : 2,
      minimumFractionDigits: opts.noCents || opts.compact ? 0 : 2,
    });
    formatters.set(key, f);
  }
  return f.format(cents / 100);
}

/** "1,234.5" | "$12" | "12.345" → cents. Returns NaN for junk. */
export function toCents(input: FormDataEntryValue | string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return NaN;
  if (typeof input === "number") return Math.round(input * 100);
  const clean = String(input).replace(/[$,\s]/g, "");
  const n = Number(clean);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function centsToInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

export function hours(minutes: number, digits = 1) {
  return (minutes / 60).toFixed(digits).replace(/\.0$/, "");
}
