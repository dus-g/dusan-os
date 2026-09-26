import { Check } from "lucide-react";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { today as todayFn, fmtDate, toISO } from "@/lib/dates";
import {
  saveGamsat, deleteGamsat, saveApplication, deleteApplication, saveRequirement, toggleRequirement, deleteRequirement,
} from "@/actions/education";
import { PageHeader, Empty, Disclosure } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/delete-button";
import { ProgramOverview, Semesters } from "@/components/education/program";
import type { MedApplication } from "@prisma/client";

export const metadata = { title: "Medicine" };

const STATUSES = ["RESEARCHING", "PREPARING", "SUBMITTED", "INTERVIEW", "OFFER", "ACCEPTED", "REJECTED", "WAITLISTED"] as const;
const tone = (s: string) => (s === "ACCEPTED" || s === "OFFER" ? "success" : s === "REJECTED" ? "destructive" : s === "INTERVIEW" ? "xp" : "outline") as "success" | "destructive" | "xp" | "outline";

function AppForm({ a, year }: { a?: MedApplication; year: number }) {
  return (
    <form action={saveApplication} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {a && <input type="hidden" name="id" value={a.id} />}
      <Field label="University"><Input name="university" defaultValue={a?.university} placeholder="Flinders University" required /></Field>
      <Field label="Intake year"><Input type="number" name="cycleYear" defaultValue={a?.cycleYear ?? year} /></Field>
      <Field label="Status"><Select name="status" defaultValue={a?.status ?? "RESEARCHING"}>{STATUSES.map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}</Select></Field>
      <Field label="Submitted"><Input type="date" name="submittedAt" defaultValue={a?.submittedAt ? toISO(a.submittedAt) : ""} /></Field>
      <Field label="Interview date"><Input type="date" name="interviewDate" defaultValue={a?.interviewDate ? toISO(a.interviewDate) : ""} /></Field>
      <Field label="Interview type"><Input name="interviewType" defaultValue={a?.interviewType ?? ""} placeholder="MMI" /></Field>
      <Field label="Notes" className="col-span-2"><Textarea name="notes" rows={1} className="min-h-9" defaultValue={a?.notes ?? ""} /></Field>
      <div className="col-span-2 flex justify-end sm:col-span-4"><SubmitButton size="sm" variant="secondary">{a ? "Save" : "Add application"}</SubmitButton></div>
    </form>
  );
}

export default async function MedicinePage() {
  const { userId, settings } = await getUser();
  const today = todayFn(settings.timezone);
  const [program, gamsat, apps, reqs] = await Promise.all([
    db.universityProgram.findFirst({
      where: { userId, kind: "MEDICINE" },
      include: { semesters: { orderBy: [{ year: "asc" }, { term: "asc" }], include: { subjects: { include: { assessments: true } } } } },
    }),
    db.gamsatAttempt.findMany({ where: { userId }, orderBy: { sitting: "desc" } }),
    db.medApplication.findMany({ where: { userId }, orderBy: [{ cycleYear: "desc" }, { university: "asc" }] }),
    db.entryRequirement.findMany({ where: { userId }, orderBy: { order: "asc" } }),
  ]);
  const met = reqs.filter((r) => r.met).length;
  const best = gamsat.reduce<number | null>((b, g) => (g.overall !== null && (b === null || g.overall > b) ? g.overall : b), null);

  return (
    <div className="space-y-6">
      <PageHeader title="Medicine" description="GAMSAT, applications, entry requirements, and the Doctor of Medicine itself." />
      {program && <ProgramOverview program={program} semesters={program.semesters} today={today} currency={settings.currency} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div><CardTitle>Entry requirements</CardTitle><CardDescription>{met} of {reqs.length} met</CardDescription></div>
          </CardHeader>
          <CardContent>
            <Progress value={reqs.length ? (met / reqs.length) * 100 : 0} tone="success" />
            <ul className="mt-3 divide-y">
              {reqs.map((r) => (
                <li key={r.id} className="flex items-start gap-3 py-2">
                  <form action={toggleRequirement}>
                    <input type="hidden" name="id" value={r.id} />
                    <button aria-label={r.met ? "Mark not met" : "Mark met"} className={`mt-0.5 grid size-5 place-items-center rounded border ${r.met ? "border-success bg-success text-white" : ""}`}>{r.met && <Check className="size-3" />}</button>
                  </form>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{r.title}</p>
                    {r.detail && <p className="text-xs text-muted-foreground">{r.detail}</p>}
                  </div>
                  <DeleteButton action={deleteRequirement} id={r.id} />
                </li>
              ))}
            </ul>
            <form action={saveRequirement} className="mt-2 flex gap-2">
              <Input name="title" placeholder="Add a requirement" required />
              <SubmitButton size="sm" variant="secondary">Add</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div><CardTitle>GAMSAT</CardTitle><CardDescription>{best !== null ? `Best overall ${best}` : "Overall = (S1 + S2 + 2 × S3) ÷ 4"}</CardDescription></div>
          </CardHeader>
          <CardContent>
            {gamsat.length === 0 ? <p className="text-sm text-muted-foreground">No sittings recorded yet.</p> : (
              <table className="w-full text-sm tabular">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 font-medium">Sitting</th><th className="font-medium">S1</th><th className="font-medium">S2</th><th className="font-medium">S3</th><th className="font-medium">Overall</th><th /></tr></thead>
                <tbody className="divide-y">
                  {gamsat.map((g) => (
                    <tr key={g.id}>
                      <td className="py-2">{fmtDate(g.sitting, { month: "short", year: "numeric" })}</td>
                      <td>{g.section1 ?? "—"}</td><td>{g.section2 ?? "—"}</td><td>{g.section3 ?? "—"}</td>
                      <td className="font-medium">{g.overall ?? "—"}</td>
                      <td className="text-right"><DeleteButton action={deleteGamsat} id={g.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Disclosure className="mt-3" summary={<span className="text-sm text-primary">Record a sitting</span>}>
              <form action={saveGamsat} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Sitting date" className="col-span-2 sm:col-span-4"><Input type="date" name="sitting" required /></Field>
                <Field label="Section 1"><Input type="number" name="section1" min={0} max={100} /></Field>
                <Field label="Section 2"><Input type="number" name="section2" min={0} max={100} /></Field>
                <Field label="Section 3"><Input type="number" name="section3" min={0} max={100} /></Field>
                <div className="flex items-end"><SubmitButton size="sm" className="w-full">Save</SubmitButton></div>
              </form>
            </Disclosure>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div><CardTitle>Applications and interviews</CardTitle><CardDescription>Track each school through GEMSAS or direct entry.</CardDescription></div></CardHeader>
        <CardContent className="space-y-3">
          {apps.length === 0 && <Empty title="No applications yet">Add schools as you research them.</Empty>}
          {apps.map((a) => (
            <div key={a.id} className="rounded-lg border p-3">
              <Disclosure
                summary={
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.university} <span className="font-normal text-muted-foreground">{a.cycleYear} intake</span></p>
                      <p className="text-xs text-muted-foreground">{a.interviewDate ? `Interview ${fmtDate(a.interviewDate)}${a.interviewType ? ` (${a.interviewType})` : ""}` : a.submittedAt ? `Submitted ${fmtDate(a.submittedAt)}` : a.program}</p>
                    </div>
                    <Badge tone={tone(a.status)}>{a.status.toLowerCase()}</Badge>
                  </div>
                }
              >
                <AppForm a={a} year={today.getUTCFullYear()} />
                <div className="mt-2 flex justify-end"><DeleteButton action={deleteApplication} id={a.id} /></div>
              </Disclosure>
            </div>
          ))}
          <Disclosure summary={<span className="text-sm text-primary">Add application</span>}><AppForm year={today.getUTCFullYear() + 1} /></Disclosure>
        </CardContent>
      </Card>

      {program && (program.status === "ACTIVE" || program.semesters.length > 0) && <Semesters program={program} semesters={program.semesters} today={today} />}
    </div>
  );
}
