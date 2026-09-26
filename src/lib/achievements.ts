import type { LifeStats } from "./stats";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  xp: number;
  group: "Work" | "Money" | "Education" | "Medicine" | "Habits";
  test: (s: LifeStats) => boolean;
}

const h = (n: number) => (s: LifeStats) => s.lifetimeMinutes >= n * 60;
const saved = (n: number) => (s: LifeStats) => s.savings >= n * 100;

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first-shift", title: "First shift", description: "Log your first shift.", xp: 50, group: "Work", test: (s) => s.shiftCount >= 1 },
  { key: "shifts-10", title: "10 shifts", description: "Complete ten shifts.", xp: 100, group: "Work", test: (s) => s.shiftCount >= 10 },
  { key: "shifts-100", title: "100 shifts", description: "Complete a hundred shifts.", xp: 500, group: "Work", test: (s) => s.shiftCount >= 100 },
  { key: "hours-100", title: "100 hours", description: "Work 100 hours in total.", xp: 150, group: "Work", test: h(100) },
  { key: "hours-500", title: "500 hours", description: "Work 500 hours in total.", xp: 400, group: "Work", test: h(500) },
  { key: "hours-1000", title: "1,000 hours", description: "Work 1,000 hours in total.", xp: 800, group: "Work", test: h(1000) },
  { key: "hours-2000", title: "2,000 hours", description: "A full-time year's worth of work.", xp: 1500, group: "Work", test: h(2000) },
  { key: "first-payday", title: "First payday", description: "Record your first pay.", xp: 50, group: "Money", test: (s) => s.paydayCount >= 1 },
  { key: "saved-1k", title: "First $1,000 saved", description: "Reach $1,000 in savings.", xp: 150, group: "Money", test: saved(1_000) },
  { key: "saved-5k", title: "First $5,000 saved", description: "Reach $5,000 in savings.", xp: 400, group: "Money", test: saved(5_000) },
  { key: "saved-10k", title: "First $10,000 saved", description: "Reach $10,000 in savings.", xp: 800, group: "Money", test: saved(10_000) },
  { key: "saved-25k", title: "First $25,000 saved", description: "Reach $25,000 in savings.", xp: 1500, group: "Money", test: saved(25_000) },
  { key: "saved-50k", title: "First $50,000 saved", description: "Reach $50,000 in savings.", xp: 2500, group: "Money", test: saved(50_000) },
  { key: "saved-100k", title: "First $100,000 saved", description: "Six figures in savings.", xp: 5000, group: "Money", test: saved(100_000) },
  { key: "uni-start", title: "Start university", description: "Begin the Bachelor of Public Health.", xp: 500, group: "Education", test: (s) => s.uniStarted },
  { key: "semester-1", title: "Complete a semester", description: "Finish your first semester.", xp: 300, group: "Education", test: (s) => s.semestersCompleted >= 1 },
  { key: "degree-complete", title: "Complete degree", description: "Graduate Public Health.", xp: 3000, group: "Education", test: (s) => s.bachelorCompleted },
  { key: "gamsat", title: "Sit GAMSAT", description: "Record a GAMSAT sitting.", xp: 500, group: "Medicine", test: (s) => s.gamsatSat },
  { key: "enter-medicine", title: "Enter Medicine", description: "Start the Doctor of Medicine.", xp: 5000, group: "Medicine", test: (s) => s.medicineStarted },
  { key: "graduate-medicine", title: "Graduate Medicine", description: "Become Dr Dusan.", xp: 10000, group: "Medicine", test: (s) => s.medicineCompleted },
  { key: "streak-7", title: "7-day streak", description: "Keep any habit for a week straight.", xp: 70, group: "Habits", test: (s) => s.bestHabitStreak >= 7 },
  { key: "streak-30", title: "30-day streak", description: "Keep any habit for 30 days straight.", xp: 300, group: "Habits", test: (s) => s.bestHabitStreak >= 30 },
  { key: "streak-100", title: "100-day streak", description: "Keep any habit for 100 days straight.", xp: 1000, group: "Habits", test: (s) => s.bestHabitStreak >= 100 },
  { key: "journal-30", title: "30 journal entries", description: "Reflect thirty times.", xp: 200, group: "Habits", test: (s) => s.journalCount >= 30 },
];
