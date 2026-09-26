"use server";

import { revalidatePath } from "next/cache";
import type { ShiftType } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUserId, getSettings, taxOptions } from "@/lib/session";
import { calculateShiftPay, superCents } from "@/lib/pay";
import { recalcWeekTax } from "@/lib/shifts";
import { awardXp, revokeXp, syncProgress } from "@/lib/progress";
import { XP } from "@/lib/xp";
import { timeToMinutes } from "@/lib/dates";
import { str, optStr, int, date, cents, bool, required } from "@/lib/form";

const SHIFT_TYPES: ShiftType[] = ["STANDARD", "SATURDAY", "SUNDAY", "PUBLIC_HOLIDAY"];

function revalidateWork() {
  for (const p of ["/dashboard", "/work", "/payday", "/analytics", "/missions", "/rpg"]) revalidatePath(p);
}

async function buildShift(userId: string, fd: FormData) {
  const settings = await getSettings(userId);
  const payRateId = str(fd, "payRateId");
  const rate = await db.payRate.findFirst({ where: payRateId ? { id: payRateId, userId } : { userId, isDefault: true } });
  if (!rate) throw new Error("Create a pay profile first.");
  const shiftDate = required(date(fd, "date"), "Date");
  const typeRaw = str(fd, "shiftType") as ShiftType;
  // Auto-detect Sunday/Saturday when the user leaves it on Standard.
  let shiftType: ShiftType = SHIFT_TYPES.includes(typeRaw) ? typeRaw : "STANDARD";
  if (shiftType === "STANDARD" && shiftDate.getUTCDay() === 0) shiftType = "SUNDAY";

  const input = {
    startMinute: timeToMinutes(required(str(fd, "start"), "Start time")),
    endMinute: timeToMinutes(required(str(fd, "end"), "Finish time")),
    breakMinutes: int(fd, "breakMinutes", 0),
    shiftType,
  };
  const p = calculateShiftPay(input, rate);
  return {
    settings,
    data: {
      userId, payRateId: rate.id, date: shiftDate, ...input,
      location: optStr(fd, "location"), notes: optStr(fd, "notes"),
      ...p, superCents: superCents(p.ordinaryCents, settings.superRate),
      taxCents: 0, netCents: p.grossCents,
    },
  };
}

export async function createShift(fd: FormData) {
  const userId = await requireUserId();
  const { settings, data } = await buildShift(userId, fd);
  const shift = await db.shift.create({ data });
  await recalcWeekTax(userId, data.date, taxOptions(settings), settings.weekStartsOn);
  await awardXp(userId, "WORK", XP.shiftBase + Math.floor(data.totalMinutes / 60) * XP.shiftPerHour, `Shift on ${data.date.toISOString().slice(0, 10)}`, `shift:${shift.id}`);
  await syncProgress(userId);
  revalidateWork();
}

export async function updateShift(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const existing = await db.shift.findFirstOrThrow({ where: { id, userId } });
  const { settings, data } = await buildShift(userId, fd);
  await db.shift.update({ where: { id }, data });
  const opts = taxOptions(settings);
  await recalcWeekTax(userId, existing.date, opts, settings.weekStartsOn);
  await recalcWeekTax(userId, data.date, opts, settings.weekStartsOn);
  await revokeXp(userId, `shift:${id}`);
  await awardXp(userId, "WORK", XP.shiftBase + Math.floor(data.totalMinutes / 60) * XP.shiftPerHour, `Shift on ${data.date.toISOString().slice(0, 10)}`, `shift:${id}`);
  revalidateWork();
}

export async function deleteShift(fd: FormData) {
  const userId = await requireUserId();
  const shift = await db.shift.findFirstOrThrow({ where: { id: str(fd, "id"), userId } });
  const settings = await getSettings(userId);
  await db.shift.delete({ where: { id: shift.id } });
  await revokeXp(userId, `shift:${shift.id}`);
  await recalcWeekTax(userId, shift.date, taxOptions(settings), settings.weekStartsOn);
  revalidateWork();
}

export async function savePayRate(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const data = {
    name: required(str(fd, "name"), "Name"),
    employer: required(str(fd, "employer"), "Employer"),
    role: required(str(fd, "role"), "Role"),
    employmentType: (str(fd, "employmentType") || "CASUAL") as "CASUAL" | "PART_TIME" | "FULL_TIME" | "CONTRACT",
    baseRateCents: required(cents(fd, "base"), "Base rate"),
    saturdayRateCents: cents(fd, "saturday"),
    sundayRateCents: required(cents(fd, "sunday"), "Sunday rate"),
    publicHolidayRateCents: required(cents(fd, "publicHoliday"), "Public holiday rate"),
    overtime1RateCents: required(cents(fd, "ot1"), "Overtime rate"),
    overtime2RateCents: required(cents(fd, "ot2"), "Overtime rate"),
    overtimeAfterMinutes: Math.round((Number(str(fd, "otAfterHours")) || 7.6) * 60),
    overtimeTier1Minutes: Math.round((Number(str(fd, "otTier1Hours")) || 3) * 60),
    active: fd.has("active") ? bool(fd, "active") : true,
  };
  if (id) await db.payRate.update({ where: { id, userId }, data });
  else {
    const count = await db.payRate.count({ where: { userId } });
    await db.payRate.create({ data: { ...data, userId, isDefault: count === 0 } });
  }
  revalidatePath("/work/rates");
  revalidatePath("/work");
}

export async function setDefaultPayRate(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  await db.$transaction([
    db.payRate.updateMany({ where: { userId }, data: { isDefault: false } }),
    db.payRate.update({ where: { id, userId }, data: { isDefault: true, active: true } }),
  ]);
  revalidatePath("/work/rates");
  revalidatePath("/work");
}

export async function deletePayRate(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const used = await db.shift.count({ where: { payRateId: id } });
  if (used) await db.payRate.update({ where: { id, userId }, data: { active: false, isDefault: false } });
  else await db.payRate.delete({ where: { id, userId } });
  revalidatePath("/work/rates");
}
