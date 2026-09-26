"use server";

import { revalidatePath } from "next/cache";
import type { ApplicationStatus, AssessmentKind, ProgramStatus, SubjectStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { awardXp, revokeXp, syncProgress } from "@/lib/progress";
import { XP } from "@/lib/xp";
import { str, optStr, num, int, date, cents, required } from "@/lib/form";

function revalidateEdu() {
  for (const p of ["/university", "/medicine", "/dashboard", "/analytics", "/rpg", "/missions"]) revalidatePath(p);
}

export async function saveProgram(fd: FormData) {
  const userId = await requireUserId();
  await db.universityProgram.update({
    where: { id: str(fd, "id"), userId },
    data: {
      name: required(str(fd, "name"), "Name"),
      institution: required(str(fd, "institution"), "Institution"),
      startDate: required(date(fd, "startDate"), "Start date"),
      durationYears: required(num(fd, "durationYears"), "Duration"),
      annualCostCents: required(cents(fd, "annualCost"), "Annual cost"),
      totalUnits: required(num(fd, "totalUnits"), "Total units"),
      status: (str(fd, "status") || "PLANNED") as ProgramStatus,
      notes: optStr(fd, "notes"),
    },
  });
  await syncProgress(userId);
  revalidateEdu();
}

export async function createSemester(fd: FormData) {
  const userId = await requireUserId();
  const programId = str(fd, "programId");
  await db.universityProgram.findFirstOrThrow({ where: { id: programId, userId } });
  const year = int(fd, "year", new Date().getFullYear());
  const term = int(fd, "term", 1);
  await db.semester.create({
    data: { userId, programId, year, term, name: str(fd, "name") || `${year} Semester ${term}`, startDate: date(fd, "startDate"), endDate: date(fd, "endDate") },
  });
  revalidateEdu();
}

export async function toggleSemesterComplete(fd: FormData) {
  const userId = await requireUserId();
  const s = await db.semester.findFirstOrThrow({ where: { id: str(fd, "id"), userId } });
  await db.semester.update({ where: { id: s.id }, data: { completed: !s.completed } });
  if (!s.completed) await awardXp(userId, "UNIVERSITY", XP.semester, `Completed ${s.name}`, `sem:${s.id}`);
  else await revokeXp(userId, `sem:${s.id}`);
  await syncProgress(userId);
  revalidateEdu();
}

export async function deleteSemester(fd: FormData) {
  const userId = await requireUserId();
  await db.semester.delete({ where: { id: str(fd, "id"), userId } });
  revalidateEdu();
}

export async function saveSubject(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const grade = str(fd, "grade") || null;
  let status = (str(fd, "status") || "ENROLLED") as SubjectStatus;
  if (grade && status === "ENROLLED") status = grade === "F" ? "FAILED" : "PASSED";
  const data = {
    code: required(str(fd, "code"), "Code").toUpperCase(),
    name: required(str(fd, "name"), "Name"),
    units: num(fd, "units") ?? 4.5,
    grade, mark: num(fd, "mark"), status,
  };
  let subjectId = id;
  if (id) await db.subject.update({ where: { id, userId }, data });
  else {
    const semesterId = str(fd, "semesterId");
    await db.semester.findFirstOrThrow({ where: { id: semesterId, userId } });
    subjectId = (await db.subject.create({ data: { ...data, userId, semesterId } })).id;
  }
  await revokeXp(userId, `subj:${subjectId}`);
  if (status === "PASSED") await awardXp(userId, "UNIVERSITY", XP.subjectPassed, `Passed ${data.code}`, `subj:${subjectId}`);
  revalidateEdu();
}

export async function deleteSubject(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  await db.subject.delete({ where: { id, userId } });
  await revokeXp(userId, `subj:${id}`);
  revalidateEdu();
}

export async function saveAssessment(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const data = {
    title: required(str(fd, "title"), "Title"),
    kind: (str(fd, "kind") || "ASSIGNMENT") as AssessmentKind,
    dueDate: date(fd, "dueDate"),
    weight: num(fd, "weight"),
    mark: num(fd, "mark"),
    maxMark: num(fd, "maxMark"),
  };
  if (id) await db.assessment.update({ where: { id, userId }, data });
  else {
    const subjectId = str(fd, "subjectId");
    await db.subject.findFirstOrThrow({ where: { id: subjectId, userId } });
    await db.assessment.create({ data: { ...data, userId, subjectId } });
  }
  revalidateEdu();
}

export async function toggleAssessment(fd: FormData) {
  const userId = await requireUserId();
  const a = await db.assessment.findFirstOrThrow({ where: { id: str(fd, "id"), userId } });
  await db.assessment.update({ where: { id: a.id }, data: { completed: !a.completed } });
  if (!a.completed) await awardXp(userId, "STUDY", XP.assessment, `Submitted ${a.title}`, `asmt:${a.id}`);
  else await revokeXp(userId, `asmt:${a.id}`);
  revalidateEdu();
}

export async function deleteAssessment(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  await db.assessment.delete({ where: { id, userId } });
  await revokeXp(userId, `asmt:${id}`);
  revalidateEdu();
}

// ─── Medicine ───

export async function saveGamsat(fd: FormData) {
  const userId = await requireUserId();
  const s1 = num(fd, "section1"), s2 = num(fd, "section2"), s3 = num(fd, "section3");
  const overall = s1 !== null && s2 !== null && s3 !== null ? Math.round(((s1 + s2 + 2 * s3) / 4) * 10) / 10 : null;
  const a = await db.gamsatAttempt.create({
    data: { userId, sitting: required(date(fd, "sitting"), "Sitting date"), section1: s1, section2: s2, section3: s3, overall, notes: optStr(fd, "notes") },
  });
  await awardXp(userId, "STUDY", XP.gamsat, "GAMSAT sitting", `gamsat:${a.id}`);
  await syncProgress(userId);
  revalidateEdu();
}

export async function deleteGamsat(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  await db.gamsatAttempt.delete({ where: { id, userId } });
  await revokeXp(userId, `gamsat:${id}`);
  revalidateEdu();
}

export async function saveApplication(fd: FormData) {
  const userId = await requireUserId();
  const id = str(fd, "id");
  const data = {
    university: required(str(fd, "university"), "University"),
    program: str(fd, "program") || "Doctor of Medicine",
    cycleYear: int(fd, "cycleYear", new Date().getFullYear()),
    status: (str(fd, "status") || "RESEARCHING") as ApplicationStatus,
    submittedAt: date(fd, "submittedAt"),
    interviewDate: date(fd, "interviewDate"),
    interviewType: optStr(fd, "interviewType"),
    notes: optStr(fd, "notes"),
  };
  if (id) await db.medApplication.update({ where: { id, userId }, data });
  else await db.medApplication.create({ data: { ...data, userId } });
  revalidateEdu();
}

export async function deleteApplication(fd: FormData) {
  const userId = await requireUserId();
  await db.medApplication.delete({ where: { id: str(fd, "id"), userId } });
  revalidateEdu();
}

export async function saveRequirement(fd: FormData) {
  const userId = await requireUserId();
  await db.entryRequirement.create({
    data: { userId, title: required(str(fd, "title"), "Requirement"), detail: optStr(fd, "detail"), order: await db.entryRequirement.count({ where: { userId } }) },
  });
  revalidateEdu();
}

export async function toggleRequirement(fd: FormData) {
  const userId = await requireUserId();
  const r = await db.entryRequirement.findFirstOrThrow({ where: { id: str(fd, "id"), userId } });
  await db.entryRequirement.update({ where: { id: r.id }, data: { met: !r.met } });
  revalidateEdu();
}

export async function deleteRequirement(fd: FormData) {
  const userId = await requireUserId();
  await db.entryRequirement.delete({ where: { id: str(fd, "id"), userId } });
  revalidateEdu();
}

