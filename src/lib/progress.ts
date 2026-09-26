import "server-only";
import type { Mission, XpSource } from "@prisma/client";
import { db } from "./db";
import { getLifeStats, type LifeStats } from "./stats";
import { ACHIEVEMENTS } from "./achievements";
import { clamp } from "./utils";

export async function awardXp(userId: string, source: XpSource, amount: number, reason: string, refId?: string) {
  if (amount === 0) return;
  await db.xpEvent.create({ data: { userId, source, amount, reason, refId } });
}

/** Remove XP previously awarded for a record (e.g. a deleted shift). */
export async function revokeXp(userId: string, refId: string) {
  await db.xpEvent.deleteMany({ where: { userId, refId } });
}

export function missionProgress(m: Pick<Mission, "metric" | "metricTarget" | "progress" | "status">, s: LifeStats) {
  if (m.status === "COMPLETED") return 100;
  const t = m.metricTarget ?? 0;
  switch (m.metric) {
    case "SAVINGS_TOTAL": return t ? clamp((s.savings / t) * 100) : 0;
    case "HOURS_WORKED": return t ? clamp((s.lifetimeMinutes / 60 / t) * 100) : 0;
    case "SHIFTS_COUNT": return t ? clamp((s.shiftCount / t) * 100) : 0;
    case "DAYS_EMPLOYED": return t ? clamp((s.daysEmployed / t) * 100) : 0;
    case "UNI_STARTED": return s.uniStarted ? 100 : 0;
    default: return clamp(m.progress);
  }
}

/**
 * Completes auto-tracked missions and unlocks achievements based on live stats.
 * Idempotent — safe to call on every page load that shows progress.
 */
export async function syncProgress(userId: string) {
  const stats = await getLifeStats(userId);

  const active = await db.mission.findMany({ where: { userId, status: "ACTIVE", metric: { not: "MANUAL" } } });
  for (const m of active) {
    if (missionProgress(m, stats) >= 100) {
      await db.mission.update({ where: { id: m.id }, data: { status: "COMPLETED", completedAt: new Date(), progress: 100 } });
      await awardXp(userId, "MISSION", m.xpReward, `Mission complete: ${m.title}`, `mission:${m.id}`);
    }
  }

  const unlocked = new Set((await db.achievement.findMany({ where: { userId }, select: { key: true } })).map((a) => a.key));
  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.key) && a.test(stats)) {
      const created = await db.achievement.createMany({ data: [{ userId, key: a.key }], skipDuplicates: true });
      if (created.count) await awardXp(userId, "ACHIEVEMENT", a.xp, `Achievement: ${a.title}`, `ach:${a.key}`);
    }
  }
  return stats;
}
