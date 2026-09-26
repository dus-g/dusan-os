import type { Prisma, PrismaClient } from "@prisma/client";
import { fromISO } from "./dates";

type Tx = Prisma.TransactionClient | PrismaClient;

export const DEFAULT_CATEGORIES: [string, string][] = [
  ["Groceries", "#6CC38A"],
  ["Eating Out", "#E2A93B"],
  ["Food", "#D9C26A"],
  ["Transport", "#6C9BD2"],
  ["Scooter Charging", "#5EB1BF"],
  ["Scooter Maintenance", "#4A8FA0"],
  ["Phone", "#A38BD6"],
  ["Internet", "#8C7BC2"],
  ["Gym", "#E06C75"],
  ["Clothing", "#D98BB5"],
  ["Entertainment", "#F0A36B"],
  ["Hobbies", "#C9A66B"],
  ["Work Gear", "#9AA7B8"],
  ["Education", "#4FB3B0"],
  ["Medical", "#E88E8E"],
  ["Miscellaneous", "#8C95A8"],
];

/** [category, cents, period] */
export const DEFAULT_BUDGET: [string, number, "WEEKLY" | "MONTHLY"][] = [
  ["Groceries", 12000, "WEEKLY"],
  ["Eating Out", 3000, "WEEKLY"],
  ["Phone", 4000, "MONTHLY"],
  ["Scooter Charging", 200, "WEEKLY"],
  ["Scooter Maintenance", 500, "WEEKLY"],
  ["Gym", 700, "WEEKLY"],
  ["Entertainment", 2000, "WEEKLY"],
  ["Hobbies", 2000, "WEEKLY"],
  ["Clothing", 2000, "WEEKLY"],
  ["Work Gear", 1500, "WEEKLY"],
  ["Miscellaneous", 3000, "WEEKLY"],
];

const ACCOUNTS = [
  { name: "Everyday", type: "EVERYDAY", countsAsSavings: false, color: "#8C95A8" },
  { name: "Savings", type: "SAVINGS", countsAsSavings: true, color: "#4FB3B0" },
  { name: "Emergency Fund", type: "EMERGENCY", countsAsSavings: true, color: "#E06C75" },
  { name: "University Fund", type: "UNIVERSITY", countsAsSavings: true, color: "#6C9BD2" },
  { name: "Investments", type: "INVESTMENT", countsAsSavings: true, color: "#A38BD6" },
  { name: "Home Deposit", type: "HOME_DEPOSIT", countsAsSavings: true, color: "#E2A93B" },
] as const;

const GOALS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];

type MissionSeed = Omit<Prisma.MissionCreateManyInput, "userId">;
const MISSIONS: MissionSeed[] = [
  { title: "Save first $1,000", category: "Money", priority: "HIGH", difficulty: "EASY", xpReward: 100, metric: "SAVINGS_TOTAL", metricTarget: 100_000 },
  { title: "Save first $5,000", category: "Money", priority: "HIGH", difficulty: "MEDIUM", xpReward: 300, metric: "SAVINGS_TOTAL", metricTarget: 500_000 },
  { title: "Save first $10,000", category: "Money", priority: "HIGH", difficulty: "HARD", xpReward: 600, metric: "SAVINGS_TOTAL", metricTarget: 1_000_000, deadline: fromISO("2027-02-28") },
  { title: "Maintain employment", category: "Work", priority: "HIGH", difficulty: "MEDIUM", xpReward: 200, metric: "SHIFTS_COUNT", metricTarget: 50 },
  { title: "Complete 3 months of employment", category: "Work", priority: "MEDIUM", difficulty: "MEDIUM", xpReward: 250, metric: "DAYS_EMPLOYED", metricTarget: 91 },
  { title: "Start university", category: "Education", priority: "CRITICAL", difficulty: "MEDIUM", xpReward: 500, metric: "UNI_STARTED", metricTarget: 1, deadline: fromISO("2027-03-02") },
  { title: "Maintain health", category: "Health", priority: "HIGH", difficulty: "MEDIUM", xpReward: 200 },
  { title: "Learn guitar", category: "Personal", priority: "LOW", difficulty: "HARD", xpReward: 400 },
  { title: "Improve Macedonian", category: "Personal", priority: "MEDIUM", difficulty: "HARD", xpReward: 400 },
  { title: "Exercise consistently", category: "Health", priority: "HIGH", difficulty: "MEDIUM", xpReward: 250 },
  { title: "Graduate Public Health", category: "Education", priority: "CRITICAL", difficulty: "EPIC", xpReward: 3000, deadline: fromISO("2029-12-31") },
  { title: "Prepare for GAMSAT", category: "Career", priority: "HIGH", difficulty: "HARD", xpReward: 800 },
  { title: "Enter Medicine", category: "Career", priority: "CRITICAL", difficulty: "EPIC", xpReward: 5000 },
  { title: "Graduate Medicine", category: "Career", priority: "CRITICAL", difficulty: "EPIC", xpReward: 10000 },
];

const HABITS: [string, string, number, string | null, string][] = [
  ["Work", "Work", 5, null, "#9AA7B8"],
  ["Study", "Education", 5, "min", "#4FB3B0"],
  ["Gym", "Health", 4, null, "#E06C75"],
  ["Reading", "Personal", 5, "pages", "#C9A66B"],
  ["Sleep 7h+", "Health", 7, null, "#6C9BD2"],
  ["Water 2L", "Health", 7, null, "#5EB1BF"],
  ["Guitar", "Personal", 4, "min", "#E2A93B"],
  ["Macedonian", "Personal", 5, "min", "#A38BD6"],
  ["Meditation", "Health", 5, "min", "#6CC38A"],
];

const ROADMAP: [number, string, string][] = [
  [2026, "Work as much as possible", "Work"],
  [2026, "Save money", "Money"],
  [2026, "Build discipline", "Personal"],
  [2026, "Prepare for university", "Education"],
  [2027, "Start Bachelor of Public Health", "Education"],
  [2027, "Continue working", "Work"],
  [2028, "Continue degree", "Education"],
  [2028, "Build savings", "Money"],
  [2029, "Sit GAMSAT", "Career"],
  [2029, "Complete Public Health degree", "Education"],
  [2029, "Prepare for the next step", "Career"],
  [2030, "Start Doctor of Medicine", "Career"],
  [2033, "Graduate Medicine", "Career"],
];

const REQUIREMENTS: [string, string][] = [
  ["Completed bachelor degree", "Any discipline; must be completed before MD start."],
  ["Competitive GPA", "Check each school's minimum and weighting (often last 3 years)."],
  ["GAMSAT score", "Most GEMSAS schools require a minimum per section and overall."],
  ["Interview (MMI)", "Multiple mini-interviews at most Australian schools."],
  ["Working with Children Check", "Needed for clinical placements."],
  ["Immunisation record", "Required before placements begin."],
];

export async function bootstrapUser(tx: Tx, userId: string, opts: { dateOfBirth?: Date } = {}) {
  await tx.settings.create({
    data: {
      userId,
      dateOfBirth: opts.dateOfBirth ?? fromISO("2003-12-09"),
      universityStartDate: fromISO("2027-03-02"),
    },
  });

  await tx.payRate.create({
    data: {
      userId,
      name: "White Marquee — Casual",
      employer: "White Marquee Event Hire",
      role: "Casual Labourer",
      employmentType: "CASUAL",
      baseRateCents: 3218,
      sundayRateCents: 4505,
      publicHolidayRateCents: 7079,
      overtime1RateCents: 3861,
      overtime2RateCents: 5148,
      isDefault: true,
    },
  });

  await tx.account.createMany({ data: ACCOUNTS.map((a, i) => ({ ...a, userId, order: i })) });

  await tx.category.createMany({ data: DEFAULT_CATEGORIES.map(([name, color]) => ({ userId, name, color, isDefault: true })) });
  const cats = await tx.category.findMany({ where: { userId } });
  const byName = new Map(cats.map((c) => [c.name, c.id]));
  await tx.budget.createMany({
    data: DEFAULT_BUDGET.map(([name, amountCents, period]) => ({ userId, categoryId: byName.get(name)!, amountCents, period })),
  });

  await tx.goal.createMany({
    data: GOALS.map((g, i) => ({ userId, name: `First $${g.toLocaleString("en-AU")}`, targetCents: g * 100, trackTotalSavings: true, order: i })),
  });

  await tx.mission.createMany({ data: MISSIONS.map((m, i) => ({ ...m, userId, order: i })) });

  await tx.habit.createMany({
    data: HABITS.map(([name, category, targetPerWeek, unit, color], i) => ({ userId, name, category, targetPerWeek, unit, color, order: i })),
  });

  await tx.lifeEvent.createMany({ data: ROADMAP.map(([year, title, category], i) => ({ userId, year, title, category, order: i })) });

  await tx.universityProgram.createMany({
    data: [
      {
        userId, kind: "BACHELOR", name: "Bachelor of Public Health", institution: "Flinders University",
        startDate: fromISO("2027-03-02"), durationYears: 3, annualCostCents: 1_248_500, totalUnits: 108, status: "PLANNED",
      },
      {
        userId, kind: "MEDICINE", name: "Doctor of Medicine", institution: "Flinders University",
        startDate: fromISO("2030-01-20"), durationYears: 4, annualCostCents: 1_355_800, totalUnits: 144, status: "PLANNED",
      },
    ],
  });

  await tx.entryRequirement.createMany({ data: REQUIREMENTS.map(([title, detail], i) => ({ userId, title, detail, order: i })) });
}
