import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { gpa } from "@/lib/education";
import { today as todayFn, fmtDate } from "@/lib/dates";
import { PageHeader, Empty } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ProgramOverview, Semesters } from "@/components/education/program";
import { TrendChart } from "@/components/charts";

export const metadata = { title: "Public Health" };

export default async function UniversityPage() {
  const { userId, settings } = await getUser();
  const today = todayFn(settings.timezone);
  const program = await db.universityProgram.findFirst({
    where: { userId, kind: "BACHELOR" },
    include: { semesters: { orderBy: [{ year: "asc" }, { term: "asc" }], include: { subjects: { orderBy: { code: "asc" }, include: { assessments: { orderBy: { dueDate: "asc" } } } } } } },
  });
  if (!program) return <Empty title="No bachelor program set up" />;

  const upcoming = program.semesters.flatMap((s) => s.subjects.flatMap((sub) => sub.assessments.filter((a) => !a.completed && a.dueDate && a.dueDate >= today).map((a) => ({ ...a, code: sub.code }))))
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime()).slice(0, 6);
  const gpaSeries = program.semesters.filter((s) => s.subjects.some((x) => x.grade)).map((s) => ({ name: s.name.replace(" Semester ", " S"), gpa: Number((gpa(s.subjects) ?? 0).toFixed(2)) }));

  return (
    <div className="space-y-6">
      <PageHeader title="Public Health" description="Topics, assessments, grades, and what the degree costs you." />
      <ProgramOverview program={program} semesters={program.semesters} today={today} currency={settings.currency} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Coming up</CardTitle><CardDescription>Unfinished assessments by due date</CardDescription></div></CardHeader>
          <CardContent>
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due. Add assessments to your topics below.</p> : (
              <ul className="divide-y">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex justify-between py-2 text-sm">
                    <span><span className="text-muted-foreground">{a.code}</span> {a.title}</span>
                    <span className="text-muted-foreground tabular">{fmtDate(a.dueDate!, { day: "numeric", month: "short" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Semester results</CardTitle><CardDescription>GPA per semester</CardDescription></div></CardHeader>
          <CardContent><TrendChart type="bar" x="name" kind="number" data={gpaSeries} series={[{ key: "gpa", label: "GPA" }]} height={180} /></CardContent>
        </Card>
      </div>
      <Semesters program={program} semesters={program.semesters} today={today} />
    </div>
  );
}
