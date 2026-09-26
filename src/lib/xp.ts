/**
 * Level L requires 50·L·(L−1) total XP.
 * L2 = 100, L5 = 1,000, L10 = 4,500, L20 = 19,000, L40 = 78,000.
 */
export function xpForLevel(level: number) {
  return 50 * level * (level - 1);
}

export function levelFromXp(xp: number) {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 50)) / 2));
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, xp, intoLevel: xp - floor, needed: next - floor, toNext: next - xp, percent: ((xp - floor) / (next - floor)) * 100 };
}

const TITLES: [number, string][] = [
  [1, "Beginner"],
  [5, "Apprentice"],
  [10, "Steady hand"],
  [15, "Scholar"],
  [20, "Practitioner"],
  [30, "Resident"],
  [40, "Registrar"],
  [50, "Consultant"],
];

export function levelTitle(level: number) {
  let t = TITLES[0][1];
  for (const [l, name] of TITLES) if (level >= l) t = name;
  return t;
}

/** XP rewards for everyday actions. */
export const XP = {
  shiftBase: 10,
  shiftPerHour: 2,
  habit: 5,
  journal: 10,
  healthLog: 5,
  gym: 10,
  savingsPer100: 5, // per $100 saved
  assessment: 15,
  subjectPassed: 60,
  semester: 250,
  gamsat: 300,
} as const;

export const DIFFICULTY_XP = { EASY: 50, MEDIUM: 150, HARD: 400, EPIC: 1000 } as const;
