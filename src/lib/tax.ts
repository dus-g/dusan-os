/**
 * Australian resident tax estimates, 2025–26 income year.
 *
 * These are ESTIMATES for planning. Actual PAYG withholding uses the ATO's
 * weekly Scale 2 formula, which differs slightly week to week; your end-of-year
 * return reconciles the difference. Update the constants each July.
 */

export const TAX_YEAR = "2025–26";

const BRACKETS: { threshold: number; rate: number; base: number }[] = [
  { threshold: 190_000, rate: 0.45, base: 51_638 },
  { threshold: 135_000, rate: 0.37, base: 31_288 },
  { threshold: 45_000, rate: 0.30, base: 4_288 },
  { threshold: 18_200, rate: 0.16, base: 0 },
];

const MEDICARE_RATE = 0.02;
const MEDICARE_LOW_THRESHOLD = 27_222; // singles; shade-in 10c per $ above

export function incomeTax(annual: number) {
  for (const b of BRACKETS) if (annual > b.threshold) return b.base + (annual - b.threshold) * b.rate;
  return 0;
}

/** Low Income Tax Offset */
export function lito(annual: number) {
  if (annual <= 37_500) return 700;
  if (annual <= 45_000) return 700 - (annual - 37_500) * 0.05;
  if (annual <= 66_667) return 325 - (annual - 45_000) * 0.015;
  return 0;
}

export function medicareLevy(annual: number) {
  if (annual <= MEDICARE_LOW_THRESHOLD) return 0;
  return Math.min(annual * MEDICARE_RATE, (annual - MEDICARE_LOW_THRESHOLD) * 0.1);
}

/** HELP/HECS compulsory repayment, 2025–26 marginal system. */
export function studyLoanRepayment(annual: number) {
  if (annual <= 67_000) return 0;
  if (annual <= 125_000) return (annual - 67_000) * 0.15;
  return 8_700 + (annual - 125_000) * 0.17;
}

export interface TaxOptions {
  mode: "ATO_RESIDENT" | "FLAT";
  flatRate?: number;
  hasStudyLoan?: boolean;
}

/** Annual tax in dollars. */
export function annualTax(annualIncome: number, opts: TaxOptions) {
  if (opts.mode === "FLAT") return annualIncome * (opts.flatRate ?? 0);
  const tax = Math.max(0, incomeTax(annualIncome) - lito(annualIncome)) + medicareLevy(annualIncome);
  const loan = opts.hasStudyLoan ? studyLoanRepayment(annualIncome) : 0;
  return tax + loan;
}

/** Estimated weekly withholding in cents from weekly gross cents. */
export function weeklyTaxCents(weeklyGrossCents: number, opts: TaxOptions) {
  if (weeklyGrossCents <= 0) return 0;
  const annual = (weeklyGrossCents / 100) * 52;
  return Math.round((annualTax(annual, opts) / 52) * 100);
}

export function breakdown(annualIncome: number, opts: TaxOptions) {
  if (opts.mode === "FLAT") {
    const t = annualIncome * (opts.flatRate ?? 0);
    return { incomeTax: t, lito: 0, medicare: 0, studyLoan: 0, total: t, net: annualIncome - t };
  }
  const it = incomeTax(annualIncome);
  const off = Math.min(it, lito(annualIncome));
  const med = medicareLevy(annualIncome);
  const loan = opts.hasStudyLoan ? studyLoanRepayment(annualIncome) : 0;
  const total = it - off + med + loan;
  return { incomeTax: it, lito: off, medicare: med, studyLoan: loan, total, net: annualIncome - total };
}
