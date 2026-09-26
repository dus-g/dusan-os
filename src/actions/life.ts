"use server";

import { revalidatePath } from "next/cache";
import type { Difficulty, JournalType, MissionMetric, Priority } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { awardXp, revokeXp, syncProgress } from "@/lib/progress";
import { DIFFICULTY_XP, XP } from "@/lib/xp";
import { today } from "@/lib/dates";
import { str, optStr, num, int, date, bool, required, cents } from "@/lib/form";

// ─── Missions ───

export async function saveMission(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const difficulty = (str(fd, "difficulty") || "MEDIUM") as Difficulty;
  const metric = (str(fd, "metric") || "MANUAL") as MissionMetric;
  let metricTarget = num(fd, "metricTarget");
  if (metric === "SAVINGS_TOTAL") metricTarget = cents(fd, "metricTarget");
  const data = {
    title: required(str(fd, "title"), "Title"),
    description: optStr(fd, "description"),
    category: str(fd, "category") || "Personal",
    priority: (str(fd, "priority") || "MEDIUM") as Priority,
    difficulty,
    xpReward: int(fd, "xpReward", DIFFICULTY_XP[difficulty]),
    deadline: date(fd, "deadline"),
    metric,
    metricTarget,
    progress: Math.min(100, Math.max(0, int(fd, "progress", 0))),
  };
  if (id) await db.mission.update({ where: { id, userId }, data });
  else await db.mission.create({ data: { ...data, userId, order: await db.mission.count({ where: { userId } }) } });
  await syncProgress(userId);
  revalidatePath("/missions");
  revalidatePath("/dashboard");
}

export async function setMissionProgress(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const progress = Math.min(100, Math.max(0, int(fd, "progress", 0)));
  const m = await db.mission.update({ where: { id, userId }, data: { progress } });
  if (progress === 100 && m.status === "ACTIVE") await completeMissionInternal(userId, id);
  revalidatePath("/missions");
  revalidatePath("/dashboard");
}

async function completeMissionInternal(userId: string, id: string) {
  const m = await db.mission.update({ where: { id, userId }, data: { status: "COMPLETED", completedAt: new Date(), progress: 100 } });
  await awardXp(userId, "MISSION", m.xpReward, `Mission complete: ${m.title}`, `mission:${m.id}`);
  await syncProgress(userId);
}

export async function completeMission(fd: FormData) {
  const userId = await requireUserId();
  await completeMissionInternal(userId, str(fd, "id"));
  revalidatePath("/missions");
  revalidatePath("/dashboard");
  revalidatePath("/rpg");
}

export async function reopenMission(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  await db.mission.update({ where: { id, userId }, data: { status: "ACTIVE", completedAt: null } });
  await revokeXp(userId, `mission:${id}`);
  revalidatePath("/missions");
}

export async function archiveMission(fd: FormData) {
  const userId = await requireUserId();
  await db.mission.update({ where: { id: str(fd, "id"), userId }, data: { status: "ARCHIVED" } });
  revalidatePath("/missions");
}

export async function setMainMission(fd: FormData) {
  const userId = await requireUserId();
  await db.settings.update({ where: { userId }, data: { mainMissionId: str(fd, "id") || null } });
  revalidatePath("/missions");
  revalidatePath("/dashboard");
}

// ─── Habits ───

export async function saveHabit(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const data = {
    name: required(str(fd, "name"), "Name"),
    category: str(fd, "category") || "Personal",
    targetPerWeek: Math.min(7, Math.max(1, int(fd, "targetPerWeek", 7))),
    unit: optStr(fd, "unit"),
    color: str(fd, "color") || "#4FB3B0",
  };
  if (id) await db.habit.update({ where: { id, userId }, data });
  else await db.habit.create({ data: { ...data, userId, order: await db.habit.count({ where: { userId } }) } });
  revalidatePath("/habits");
}

export async function archiveHabit(fd: FormData) {
  const userId = await requireUserId();
  await db.habit.update({ where: { id: str(fd, "id"), userId }, data: { archived: true } });
  revalidatePath("/habits");
}

export async function toggleHabit(fd: FormData) {
  const userId = await requireUserId();
  const habitId = str(fd, "habitId");
  const d = required(date(fd, "date"), "Date");
  await db.habit.findFirstOrThrow({ where: { id: habitId, userId } });
  const existing = await db.habitLog.findUnique({ where: { habitId_date: { habitId, date: d } } });
  const ref = `habit:${habitId}:${d.toISOString().slice(0, 10)}`;
  if (existing) {
    await db.habitLog.delete({ where: { id: existing.id } });
    await revokeXp(userId, ref);
  } else {
    await db.habitLog.create({ data: { userId, habitId, date: d, value: num(fd, "value") ?? 1 } });
    await awardXp(userId, "HABIT", XP.habit, "Habit logged", ref);
    await syncProgress(userId);
  }
  revalidatePath("/habits");
  revalidatePath("/dashboard");
}

// ─── Health ───

export async function saveHealthLog(fd: FormData) {
  const userId = await requireUserId();
  const d = date(fd, "date") ?? today();
  const data = {
    weightKg: num(fd, "weightKg"),
    sleepHours: num(fd, "sleepHours"),
    waterMl: num(fd, "waterL") !== null ? Math.round(num(fd, "waterL")! * 1000) : null,
    steps: num(fd, "steps") !== null ? Math.round(num(fd, "steps")!) : null,
    gymSession: bool(fd, "gymSession"),
    notes: optStr(fd, "notes"),
  };
  const existed = await db.healthLog.findUnique({ where: { userId_date: { userId, date: d } } });
  await db.healthLog.upsert({ where: { userId_date: { userId, date: d } }, create: { userId, date: d, ...data }, update: data });
  const key = d.toISOString().slice(0, 10);
  if (!existed) await awardXp(userId, "HEALTH", XP.healthLog, "Health check-in", `health:${key}`);
  if (data.gymSession && !existed?.gymSession) await awardXp(userId, "HEALTH", XP.gym, "Gym session", `gym:${key}`);
  if (!data.gymSession && existed?.gymSession) await revokeXp(userId, `gym:${key}`);
  revalidatePath("/health");
  revalidatePath("/dashboard");
}

export async function addMeasurement(fd: FormData) {
  const userId = await requireUserId();
  await db.measurement.create({
    data: { userId, date: date(fd, "date") ?? today(), kind: required(str(fd, "kind"), "Measurement"), value: required(num(fd, "value"), "Value"), unit: str(fd, "unit") || "cm" },
  });
  revalidatePath("/health");
}

export async function deleteMeasurement(fd: FormData) {
  const userId = await requireUserId();
  await db.measurement.delete({ where: { id: str(fd, "id"), userId } });
  revalidatePath("/health");
}

// ─── Journal ───

export async function saveJournal(fd: FormData) {
  const userId = await requireUserId();
  const type = (str(fd, "type") || "DAILY") as JournalType;
  const d = date(fd, "date") ?? today();
  const data = {
    mood: num(fd, "mood"),
    wentWell: optStr(fd, "wentWell"),
    learned: optStr(fd, "learned"),
    improve: optStr(fd, "improve"),
    tomorrowGoal: optStr(fd, "tomorrowGoal"),
    body: optStr(fd, "body"),
  };
  const existed = await db.journalEntry.findUnique({ where: { userId_type_date: { userId, type, date: d } } });
  const e = await db.journalEntry.upsert({ where: { userId_type_date: { userId, type, date: d } }, create: { userId, type, date: d, ...data }, update: data });
  if (!existed) {
    await awardXp(userId, "JOURNAL", XP.journal * (type === "DAILY" ? 1 : type === "WEEKLY" ? 3 : type === "MONTHLY" ? 6 : 20), `${type.toLowerCase()} journal`, `journal:${e.id}`);
    await syncProgress(userId);
  }
  revalidatePath("/journal");
}

export async function deleteJournal(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  await db.journalEntry.delete({ where: { id, userId } });
  await revokeXp(userId, `journal:${id}`);
  revalidatePath("/journal");
}

// ─── Roadmap ───

export async function saveLifeEvent(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const data = {
    year: required(num(fd, "year"), "Year"),
    title: required(str(fd, "title"), "Title"),
    description: optStr(fd, "description"),
    category: str(fd, "category") || "Personal",
  };
  if (id) await db.lifeEvent.update({ where: { id, userId }, data });
  else await db.lifeEvent.create({ data: { ...data, userId, order: await db.lifeEvent.count({ where: { userId } }) } });
  revalidatePath("/roadmap");
}

export async function toggleLifeEvent(fd: FormData) {
  const userId = await requireUserId();
  const e = await db.lifeEvent.findFirstOrThrow({ where: { id: str(fd, "id"), userId } });
  await db.lifeEvent.update({ where: { id: e.id }, data: { done: !e.done } });
  revalidatePath("/roadmap");
}

export async function deleteLifeEvent(fd: FormData) {
  const userId = await requireUserId();
  await db.lifeEvent.delete({ where: { id: str(fd, "id"), userId } });
  revalidatePath("/roadmap");
}

// ─── Settings ───

export async function savePreferences(fd: FormData) {
  const userId = await requireUserId();
  const cats = str(fd, "missionCategories").split(",").map((s) => s.trim()).filter(Boolean);
  await db.settings.update({
    where: { userId },
    data: {
      currency: str(fd, "currency") || "AUD",
      theme: str(fd, "theme") || "dark",
      taxMode: str(fd, "taxMode") === "FLAT" ? "FLAT" : "ATO_RESIDENT",
      flatTaxRate: (num(fd, "flatTaxRate") ?? 19) / 100,
      superRate: (num(fd, "superRate") ?? 12) / 100,
      hasStudyLoan: bool(fd, "hasStudyLoan"),
      paydayWeekday: int(fd, "paydayWeekday", 4),
      universityStartDate: date(fd, "universityStartDate") ?? undefined,
      ...(cats.length ? { missionCategories: cats } : {}),
    },
  });
  revalidatePath("/", "layout");
}
