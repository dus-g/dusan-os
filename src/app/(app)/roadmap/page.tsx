import type { LifeEvent } from "@prisma/client";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { today as todayFn, ageOn } from "@/lib/dates";
import { saveLifeEvent, toggleLifeEvent, deleteLifeEvent } from "@/actions/life";
import { PageHeader, Disclosure, Empty } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/delete-button";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export const metadata = { title: "Life roadmap" };

const CATS = ["Work", "Money", "Education", "Medicine", "Health", "Personal"];

function EventForm({ e, year }: { e?: LifeEvent; year: number }) {
  return (
    <form action={saveLifeEvent} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
      {e && <input type="hidden" name="id" value={e.id} />}
      <Field label="Year"><Input name="year" type="number" min={2000} max={2100} defaultValue={e?.year ?? year} required /></Field>
      <Field label="Milestone" className="sm:col-span-2"><Input name="title" defaultValue={e?.title} required /></Field>
      <Field label="Category"><Select name="category" defaultValue={e?.category ?? "Personal"}>{[...new Set([...CATS, e?.category ?? "Personal"])].map((c) => <option key={c}>{c}</option>)}</Select></Field>
      <Field label="Detail" className="col-span-2 sm:col-span-1"><Input name="description" defaultValue={e?.description ?? ""} /></Field>
      <div className="col-span-2 flex items-end justify-end sm:col-span-1"><SubmitButton size="sm">{e ? "Save" : "Add"}</SubmitButton></div>
    </form>
  );
}

export default async function RoadmapPage() {
  const { userId, settings } = await getUser();
  const today = todayFn(settings.timezone);
  const thisYear = today.getUTCFullYear();
  const events = await db.lifeEvent.findMany({ where: { userId }, orderBy: [{ year: "asc" }, { order: "asc" }] });
  const years = [...new Set(events.map((e) => e.year))].sort((a, b) => a - b);
  const done = events.filter((e) => e.done).length;

  return (
    <>
      <PageHeader title="Life roadmap" description="The long game, year by year. Tick milestones off as they happen and rewrite the plan whenever life changes it." />

      <Card className="mb-8">
        <CardContent className="grid gap-4 pt-4 sm:grid-cols-[1fr_auto] sm:items-center sm:pt-5">
          <div>
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground tabular"><span>{done} of {events.length} milestones reached</span><span>{events.length ? Math.round((done / events.length) * 100) : 0}%</span></div>
            <Progress value={events.length ? (done / events.length) * 100 : 0} />
          </div>
          <Disclosure summary={<span className="cursor-pointer text-sm font-medium text-primary">+ Add milestone</span>}><EventForm year={thisYear} /></Disclosure>
        </CardContent>
      </Card>

      {!events.length && <Empty title="Your roadmap is empty">Add a milestone to begin.</Empty>}

      <ol className="relative ml-3 border-l">
        {years.map((y) => {
          const items = events.filter((e) => e.year === y);
          const isNow = y === thisYear, past = y < thisYear;
          const age = ageOn(settings.dateOfBirth, new Date(Date.UTC(y, 11, 31)));
          const isLast = y === years[years.length - 1];
          return (
            <li key={y} className="mb-10 pl-6 last:mb-0">
              <span className={cn("absolute -left-[7px] mt-1.5 size-3.5 rounded-full border-2 bg-background", isNow ? "border-primary bg-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_25%,transparent)]" : past ? "border-muted-foreground bg-muted-foreground" : "border-muted-foreground")} />
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className={cn("font-serif text-4xl leading-none tabular", !isNow && "text-muted-foreground")}>{y}{isLast && y >= 2030 ? "+" : ""}</h2>
                <span className="text-xs text-muted-foreground">age {age}</span>
                {isNow && <Badge tone="primary">You are here</Badge>}
              </div>
              <ul className="grid gap-2">
                {items.map((e) => (
                  <li key={e.id} className={cn("rounded-lg border bg-card px-3 py-2.5", e.done && "opacity-70")}>
                    <div className="flex items-start gap-3">
                      <form action={toggleLifeEvent} className="pt-0.5">
                        <input type="hidden" name="id" value={e.id} />
                        <button aria-label={e.done ? "Mark not done" : "Mark done"} aria-pressed={e.done}
                          className={cn("grid size-5 place-items-center rounded-full border", e.done ? "border-success bg-success text-white" : "hover:border-primary")}>
                          {e.done && <Check className="size-3" />}
                        </button>
                      </form>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium", e.done && "line-through decoration-muted-foreground")}>{e.title}</p>
                        {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                        <Disclosure className="mt-1" summary={<span className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">Edit</span>}><EventForm e={e} year={y} /></Disclosure>
                      </div>
                      <Badge tone="outline">{e.category}</Badge>
                      <DeleteButton action={deleteLifeEvent} id={e.id} confirmText="Delete this milestone?" />
                    </div>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </>
  );
}
