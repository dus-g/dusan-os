import type { Assessment, Semester, Subject, UniversityProgram } from "@prisma/client";
import { Check } from "lucide-react";
import { programSummary, GRADES } from "@/lib/education";
import { money, centsToInput } from "@/lib/money";
import { fmtDate, toISO } from "@/lib/dates";
import {
  saveProgram, createSemester, toggleSemesterComplete, deleteSemester, saveSubject, deleteSubject,
  saveAssessment, toggleAssessment, deleteAssessment,
} from "@/actions/education";
import { Stat, StatGrid, Disclosure, Empty } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/delete-button";

type FullSemester = Semester & { subjects: (Subject & { assessments: Assessment[] })[] };

export function ProgramOverview({ program, semesters, today, currency }: { program: UniversityProgram; semesters: FullSemester[]; today: Date; currency: string }) {
  const subjects = semesters.flatMap((s) => s.subjects);
  const s = programSummary(program, subjects, today);
  return (
    <>
      <StatGrid>
        <Stat label="Degree progress" value={`${Math.round(s.progress)}%`} sub={`${s.passed} of ${program.totalUnits} units passed`} />
        <Stat label="GPA" value={s.gpa !== null ? s.gpa.toFixed(2) : "—"} sub="7-point scale" tone="success" />
        <Stat label={s.daysToStart > 0 ? "Starts in" : "Years remaining"} value={s.daysToStart > 0 ? `${s.daysToStart} days` : `${s.yearsRemaining.toFixed(1)} yrs`} sub={`Finishes around ${fmtDate(s.end, { month: "short", year: "numeric" })}`} />
        <Stat label="Est. HECS so far" value={money(s.hecsToDate, currency, { noCents: true })} sub={`${money(s.hecsTotal, currency, { noCents: true })} for the full degree`} />
      </StatGrid>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-base">{program.name}</CardTitle>
            <CardDescription>{program.institution}, from {fmtDate(program.startDate, { month: "long", year: "numeric" })}, {program.durationYears} years at {money(program.annualCostCents, currency)} a year (CSP)</CardDescription>
          </div>
          <Badge tone={program.status === "ACTIVE" ? "primary" : program.status === "COMPLETED" ? "success" : "outline"}>{program.status.toLowerCase()}</Badge>
        </CardHeader>
        <CardContent>
          <Progress value={s.progress} />
          <Disclosure className="mt-3" summary={<span className="text-sm text-primary">Edit program details</span>}>
            <form action={saveProgram} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <input type="hidden" name="id" value={program.id} />
              <Field label="Program" className="col-span-2"><Input name="name" defaultValue={program.name} /></Field>
              <Field label="Institution"><Input name="institution" defaultValue={program.institution} /></Field>
              <Field label="Status">
                <Select name="status" defaultValue={program.status}>
                  <option value="PLANNED">Planned</option><option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option><option value="DEFERRED">Deferred</option>
                </Select>
              </Field>
              <Field label="Start date"><Input type="date" name="startDate" defaultValue={toISO(program.startDate)} /></Field>
              <Field label="Duration (years)"><Input name="durationYears" inputMode="decimal" defaultValue={program.durationYears} /></Field>
              <Field label="Annual cost"><Input name="annualCost" inputMode="decimal" defaultValue={centsToInput(program.annualCostCents)} /></Field>
              <Field label="Total units" hint="Flinders: 36 units per full-time year"><Input name="totalUnits" inputMode="decimal" defaultValue={program.totalUnits} /></Field>
              <Field label="Notes" className="col-span-2 sm:col-span-4"><Textarea name="notes" defaultValue={program.notes ?? ""} /></Field>
              <div className="col-span-2 flex justify-end sm:col-span-4"><SubmitButton size="sm">Save program</SubmitButton></div>
            </form>
          </Disclosure>
        </CardContent>
      </Card>
    </>
  );
}

function SubjectForm({ subject, semesterId }: { subject?: Subject; semesterId?: string }) {
  return (
    <form action={saveSubject} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      {subject && <input type="hidden" name="id" value={subject.id} />}
      {semesterId && <input type="hidden" name="semesterId" value={semesterId} />}
      <Field label="Code"><Input name="code" defaultValue={subject?.code} placeholder="PHCA1001" required /></Field>
      <Field label="Name" className="sm:col-span-2"><Input name="name" defaultValue={subject?.name} required /></Field>
      <Field label="Units"><Input name="units" inputMode="decimal" defaultValue={subject?.units ?? 4.5} /></Field>
      <Field label="Grade">
        <Select name="grade" defaultValue={subject?.grade ?? ""}>
          <option value="">—</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
      </Field>
      <Field label="Mark %"><Input name="mark" inputMode="decimal" defaultValue={subject?.mark ?? ""} /></Field>
      {subject && (
        <Field label="Status">
          <Select name="status" defaultValue={subject.status}>
            <option value="ENROLLED">Enrolled</option><option value="PASSED">Passed</option>
            <option value="FAILED">Failed</option><option value="WITHDRAWN">Withdrawn</option>
          </Select>
        </Field>
      )}
      <div className="col-span-2 flex items-end justify-end sm:col-span-6"><SubmitButton size="sm" variant="secondary">{subject ? "Save topic" : "Add topic"}</SubmitButton></div>
    </form>
  );
}

function AssessmentForm({ subjectId, a }: { subjectId: string; a?: Assessment }) {
  return (
    <form action={saveAssessment} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
      {a ? <input type="hidden" name="id" value={a.id} /> : <input type="hidden" name="subjectId" value={subjectId} />}
      <Field label="Title" className="sm:col-span-2"><Input name="title" defaultValue={a?.title} required /></Field>
      <Field label="Type">
        <Select name="kind" defaultValue={a?.kind ?? "ASSIGNMENT"}>
          <option value="ASSIGNMENT">Assignment</option><option value="EXAM">Exam</option><option value="QUIZ">Quiz</option>
          <option value="PRACTICAL">Practical</option><option value="PRESENTATION">Presentation</option><option value="OTHER">Other</option>
        </Select>
      </Field>
      <Field label="Due"><Input type="date" name="dueDate" defaultValue={a?.dueDate ? toISO(a.dueDate) : ""} /></Field>
      <Field label="Weight %"><Input name="weight" inputMode="decimal" defaultValue={a?.weight ?? ""} /></Field>
      <Field label="Mark / max">
        <div className="flex gap-1"><Input name="mark" inputMode="decimal" defaultValue={a?.mark ?? ""} /><Input name="maxMark" inputMode="decimal" defaultValue={a?.maxMark ?? ""} /></div>
      </Field>
      <div className="col-span-2 flex justify-end sm:col-span-6"><SubmitButton size="sm" variant="secondary">{a ? "Save" : "Add assessment"}</SubmitButton></div>
    </form>
  );
}

export function Semesters({ program, semesters, today }: { program: UniversityProgram; semesters: FullSemester[]; today: Date }) {
  const year = Math.max(program.startDate.getUTCFullYear(), today.getUTCFullYear());
  return (
    <section className="space-y-4">
      {semesters.length === 0 && <Empty title="No semesters yet">Add your first semester once you've enrolled in topics.</Empty>}
      {semesters.map((sem) => {
        const semUnits = sem.subjects.reduce((a, s) => a + s.units, 0);
        return (
          <Card key={sem.id}>
            <CardHeader>
              <div>
                <CardTitle>{sem.name}</CardTitle>
                <CardDescription>{sem.subjects.length} topics, {semUnits} units{sem.startDate && `, ${fmtDate(sem.startDate)}`}{sem.endDate && ` to ${fmtDate(sem.endDate)}`}</CardDescription>
              </div>
              <div className="flex items-center gap-1">
                <form action={toggleSemesterComplete}>
                  <input type="hidden" name="id" value={sem.id} />
                  <button className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${sem.completed ? "bg-success/15 text-success" : "border hover:bg-secondary"}`}>
                    {sem.completed && <Check className="size-3" />}{sem.completed ? "Completed" : "Mark complete"}
                  </button>
                </form>
                <DeleteButton action={deleteSemester} id={sem.id} confirmText="Delete this semester and its topics?" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {sem.subjects.map((sub) => (
                <div key={sub.id} className="rounded-lg border p-3">
                  <Disclosure
                    summary={
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{sub.code} <span className="font-normal text-muted-foreground">{sub.name}</span></p>
                          <p className="text-xs text-muted-foreground">{sub.units} units, {sub.assessments.filter((a) => a.completed).length}/{sub.assessments.length} assessments done</p>
                        </div>
                        {sub.grade ? <Badge tone={sub.grade === "F" ? "destructive" : "success"}>{sub.grade}{sub.mark !== null && ` ${sub.mark}`}</Badge> : <Badge tone="outline">{sub.status.toLowerCase()}</Badge>}
                      </div>
                    }
                  >
                    <div className="space-y-3">
                      <ul className="divide-y rounded-md border">
                        {sub.assessments.map((a) => (
                          <li key={a.id} className="flex items-center gap-2 px-3 py-2">
                            <form action={toggleAssessment}>
                              <input type="hidden" name="id" value={a.id} />
                              <button aria-label={a.completed ? "Mark not done" : "Mark done"} className={`grid size-5 place-items-center rounded border ${a.completed ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                                {a.completed && <Check className="size-3" />}
                              </button>
                            </form>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-sm ${a.completed ? "text-muted-foreground line-through" : ""}`}>{a.title}</p>
                              <p className="text-xs text-muted-foreground">{a.kind.toLowerCase()}{a.weight !== null && `, ${a.weight}%`}{a.dueDate && `, due ${fmtDate(a.dueDate, { day: "numeric", month: "short" })}`}{a.mark !== null && `, ${a.mark}/${a.maxMark ?? "?"}`}</p>
                            </div>
                            <DeleteButton action={deleteAssessment} id={a.id} />
                          </li>
                        ))}
                      </ul>
                      <AssessmentForm subjectId={sub.id} />
                      <p className="pt-2 text-xs font-medium text-muted-foreground">Topic details</p>
                      <SubjectForm subject={sub} />
                      <div className="flex justify-end"><DeleteButton action={deleteSubject} id={sub.id} confirmText="Delete this topic?" /></div>
                    </div>
                  </Disclosure>
                </div>
              ))}
              <Disclosure summary={<span className="text-sm text-primary">Add topic</span>}><SubjectForm semesterId={sem.id} /></Disclosure>
            </CardContent>
          </Card>
        );
      })}
      <Card>
        <CardHeader><CardTitle>Add semester</CardTitle></CardHeader>
        <CardContent>
          <form action={createSemester} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <input type="hidden" name="programId" value={program.id} />
            <Field label="Year"><Input type="number" name="year" defaultValue={year} /></Field>
            <Field label="Semester">
              <Select name="term" defaultValue="1"><option value="1">Semester 1</option><option value="2">Semester 2</option><option value="3">Summer</option></Select>
            </Field>
            <Field label="Starts"><Input type="date" name="startDate" /></Field>
            <Field label="Ends"><Input type="date" name="endDate" /></Field>
            <div className="flex items-end"><SubmitButton className="w-full">Add semester</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
