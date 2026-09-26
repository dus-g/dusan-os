import { auth } from "@/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Full JSON export of everything you own — keep regular backups. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;
  const where = { where: { userId } };
  const [settings, payRates, shifts, paydays, accounts, transactions, categories, expenses, budgets, goals, goalContributions, missions, xpEvents, achievements, habits, habitLogs, healthLogs, measurements, journalEntries, programs, semesters, subjects, assessments, gamsatAttempts, medApplications, requirements, lifeEvents] =
    await Promise.all([
      db.settings.findUnique(where), db.payRate.findMany(where), db.shift.findMany(where), db.payday.findMany(where),
      db.account.findMany(where), db.transaction.findMany(where), db.category.findMany(where), db.expense.findMany(where),
      db.budget.findMany(where), db.goal.findMany(where), db.goalContribution.findMany(where), db.mission.findMany(where),
      db.xpEvent.findMany(where), db.achievement.findMany(where), db.habit.findMany(where), db.habitLog.findMany(where),
      db.healthLog.findMany(where), db.measurement.findMany(where), db.journalEntry.findMany(where),
      db.universityProgram.findMany(where), db.semester.findMany(where), db.subject.findMany(where), db.assessment.findMany(where),
      db.gamsatAttempt.findMany(where), db.medApplication.findMany(where), db.entryRequirement.findMany(where), db.lifeEvent.findMany(where),
    ]);
  const body = JSON.stringify({
    exportedAt: new Date().toISOString(), version: 1,
    settings, payRates, shifts, paydays, accounts, transactions, categories, expenses, budgets, goals, goalContributions, missions,
    xpEvents, achievements, habits, habitLogs, healthLogs, measurements, journalEntries, programs, semesters, subjects, assessments,
    gamsatAttempts, medApplications, requirements, lifeEvents,
  }, null, 2);
  return new Response(body, {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="dusan-os-${new Date().toISOString().slice(0, 10)}.json"` },
  });
}
