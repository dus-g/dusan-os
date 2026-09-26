import type { ShiftType } from "@prisma/client";

export interface RateCard {
  baseRateCents: number;
  saturdayRateCents: number | null;
  sundayRateCents: number;
  publicHolidayRateCents: number;
  overtime1RateCents: number;
  overtime2RateCents: number;
  overtimeAfterMinutes: number;
  overtimeTier1Minutes: number;
}

export interface ShiftInput {
  startMinute: number;
  endMinute: number;
  breakMinutes: number;
  shiftType: ShiftType;
}

export interface ShiftPay {
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  grossCents: number;
  ordinaryCents: number;
}

export const DEFAULT_RATE_CARD: RateCard = {
  baseRateCents: 3218,
  saturdayRateCents: null,
  sundayRateCents: 4505,
  publicHolidayRateCents: 7079,
  overtime1RateCents: 3861,
  overtime2RateCents: 5148,
  overtimeAfterMinutes: 456,
  overtimeTier1Minutes: 180,
};

export function workedMinutes(s: Pick<ShiftInput, "startMinute" | "endMinute" | "breakMinutes">) {
  let span = s.endMinute - s.startMinute;
  if (span <= 0) span += 1440; // overnight shift
  return Math.max(0, span - s.breakMinutes);
}

const pay = (minutes: number, rateCents: number) => Math.round((minutes * rateCents) / 60);

/**
 * Standard & Saturday shifts: ordinary hours up to the daily threshold, then
 * tier-1 overtime, then tier-2 overtime. Sunday and public-holiday shifts are
 * paid entirely at their penalty rate.
 */
export function calculateShiftPay(input: ShiftInput, rate: RateCard): ShiftPay {
  const total = workedMinutes(input);

  if (input.shiftType === "SUNDAY" || input.shiftType === "PUBLIC_HOLIDAY") {
    const r = input.shiftType === "SUNDAY" ? rate.sundayRateCents : rate.publicHolidayRateCents;
    const gross = pay(total, r);
    return { totalMinutes: total, regularMinutes: total, overtimeMinutes: 0, grossCents: gross, ordinaryCents: gross };
  }

  const ordinaryRate = input.shiftType === "SATURDAY" ? rate.saturdayRateCents ?? rate.baseRateCents : rate.baseRateCents;
  const regular = Math.min(total, rate.overtimeAfterMinutes);
  const ot = Math.max(0, total - rate.overtimeAfterMinutes);
  const ot1 = Math.min(ot, rate.overtimeTier1Minutes);
  const ot2 = ot - ot1;

  const ordinary = pay(regular, ordinaryRate);
  const gross = ordinary + pay(ot1, rate.overtime1RateCents) + pay(ot2, rate.overtime2RateCents);
  return { totalMinutes: total, regularMinutes: regular, overtimeMinutes: ot, grossCents: gross, ordinaryCents: ordinary };
}

/** Superannuation Guarantee is paid on ordinary time earnings (excludes overtime). */
export function superCents(ordinaryCents: number, superRate: number) {
  return Math.round(ordinaryCents * superRate);
}

export const SHIFT_TYPE_LABEL: Record<ShiftType, string> = {
  STANDARD: "Standard",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
  PUBLIC_HOLIDAY: "Public holiday",
};
