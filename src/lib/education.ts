import type { Subject, UniversityProgram } from "@prisma/client";
import { diffDays } from "./dates";

/** Flinders 7-point scale. Check your faculty handbook — edit here if it differs. */
export const GRADE_POINTS: Record<string, number> = { HD: 7, DN: 6, CR: 5, P: 4, NGP: 4, F: 0 };
export const GRADES = Object.keys(GRADE_POINTS);

export function gpa(subjects: Pick<Subject, "grade" | "units" | "status">[]) {
  let pts = 0, units = 0;
  for (const s of subjects) {
    if (!s.grade || !(s.grade in GRADE_POINTS) || s.status === "WITHDRAWN") continue;
    pts += GRADE_POINTS[s.grade] * s.units;
    units += s.units;
  }
  return units ? pts / units : null;
}

export function programSummary(p: UniversityProgram, subjects: Pick<Subject, "grade" | "units" | "status">[], today: Date) {
  const unitsPerYear = p.totalUnits / p.durationYears;
  const passed = subjects.filter((s) => s.status === "PASSED").reduce((a, s) => a + s.units, 0);
  const enrolled = subjects.filter((s) => s.status !== "WITHDRAWN").reduce((a, s) => a + s.units, 0);
  const progress = Math.min(100, (passed / p.totalUnits) * 100);
  const end = new Date(Date.UTC(p.startDate.getUTCFullYear() + Math.floor(p.durationYears), p.startDate.getUTCMonth() + Math.round((p.durationYears % 1) * 12) - 1, 28));
  const yearsRemaining = p.status === "COMPLETED" ? 0 : Math.max(0, Math.min(p.durationYears, (p.totalUnits - passed) / unitsPerYear));
  const daysToStart = diffDays(p.startDate, today);
  const hecsToDate = Math.round((enrolled / unitsPerYear) * p.annualCostCents);
  const hecsTotal = Math.round(p.annualCostCents * p.durationYears);
  return { unitsPerYear, passed, enrolled, progress, end, yearsRemaining, daysToStart, hecsToDate, hecsTotal, gpa: gpa(subjects) };
}
