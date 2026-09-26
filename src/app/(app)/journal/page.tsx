import type { JournalEntry, JournalType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { today as todayFn, startOfWeek, startOfMonth, startOfYear, toISO, fmtDate } from "@/lib/dates";
import { saveJournal, deleteJournal } from "@/actions/life";
import { PageHeader, Empty, Disclosure } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { DeleteButton } from "@/components/delete-button";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export const metadata = { title: "Journal" };

const TYPES: { key: JournalType; label: string; hint: string }[] = [
  { key: "DAILY", label: "Daily", hint: "Two minutes before bed." },
  { key: "WEEKLY", label: "Weekly review", hint: "Sunday evening: look back at the week." },
  { key: "MONTHLY", label: "Monthly review", hint: "Money, work, health, study — how did the month go?" },
  { key: "YEARLY", label: "Yearly review", hint: "The big picture. Read last year's first." },
];
const QUESTIONS = [
  ["wentWell", "What went well?"],
  ["learned", "What did I learn?"],
  ["improve", "What can I improve?"],
  ["tomorrowGoal", "What is tomorrow's goal?"],
] as const;
const MOODS = ["", "😞", "😕", "😐", "🙂", "😄"];

function periodStart(type: JournalType, d: Date, weekStartsOn: number) {
  if (type === "WEEKLY") return startOfWeek(d, weekStartsOn);
  if (type === "MONTHLY") return startOfMonth(d);
  if (type === "YEARLY") return startOfYear(d);
  return d;
}
function periodLabel(e: Pick<JournalEntry, "type" | "date">) {
  if (e.type === "WEEKLY") return `Week of ${fmtDate(e.date)}`;
  if (e.type === "MONTHLY") return fmtDate(e.date, { month: "long", year: "numeric", timeZone: "UTC" });
  if (e.type === "YEARLY") return String(e.date.getUTCFullYear());
  return fmtDate(e.date, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function Highlight({ text, q }: { text: string; q?: string }) {
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="rounded bg-xp/30 px-0.5 text-foreground">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function EntryForm({ type, date, e }: { type: JournalType; date: string; e?: JournalEntry | null }) {
  const tomorrowLabel = type === "DAILY" ? "What is tomorrow's goal?" : `What is the goal for next ${type === "WEEKLY" ? "week" : type === "MONTHLY" ? "month" : "year"}?`;
  return (
    <form action={saveJournal} className="grid gap-3">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="date" value={date} />
      <div className="grid gap-3 sm:grid-cols-2">
        {QUESTIONS.map(([k, label]) => (
          <Field key={k} label={k === "tomorrowGoal" ? tomorrowLabel : label}>
            <Textarea name={k} defaultValue={e?.[k] ?? ""} rows={type === "DAILY" ? 2 : 4} />
          </Field>
        ))}
      </div>
      <Field label="Anything else"><Textarea name="body" defaultValue={e?.body ?? ""} rows={type === "DAILY" ? 2 : 5} /></Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <fieldset className="flex items-center gap-1" aria-label="Mood">
          <span className="mr-1 text-xs text-muted-foreground">Mood</span>
          {[1, 2, 3, 4, 5].map((m) => (
            <label key={m} className="cursor-pointer">
              <input type="radio" name="mood" value={m} defaultChecked={e?.mood === m} className="peer sr-only" />
              <span className="grid size-8 place-items-center rounded-md border text-base opacity-60 peer-checked:border-primary peer-checked:bg-accent peer-checked:opacity-100">{MOODS[m]}</span>
            </label>
          ))}
        </fieldset>
        <SubmitButton size="sm">{e ? "Update entry" : "Save entry"}</SubmitButton>
      </div>
    </form>
  );
}

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; date?: string }> }) {
  const sp = await searchParams;
  const type = (TYPES.find((t) => t.key === sp.type?.toUpperCase())?.key ?? "DAILY") as JournalType;
  const q = sp.q?.trim() || undefined;
  const { userId, settings } = await getUser();
  const today = todayFn(settings.timezone);
  const base = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? new Date(`${sp.date}T00:00:00Z`) : today;
  const period = periodStart(type, base, settings.weekStartsOn);
  const periodISO = toISO(period);

  const where: Prisma.JournalEntryWhereInput = { userId };
  if (q) {
    const c = { contains: q, mode: "insensitive" as const };
    where.OR = [{ wentWell: c }, { learned: c }, { improve: c }, { tomorrowGoal: c }, { body: c }];
  } else where.type = type;

  const [current, entries, counts] = await Promise.all([
    db.journalEntry.findUnique({ where: { userId_type_date: { userId, type, date: period } } }),
    db.journalEntry.findMany({ where, orderBy: { date: "desc" }, take: 50 }),
    db.journalEntry.groupBy({ by: ["type"], where: { userId }, _count: true }),
  ]);
  const count = (t: JournalType) => counts.find((c) => c.type === t)?._count ?? 0;
  const info = TYPES.find((t) => t.key === type)!;

  return (
    <>
      <PageHeader title="Journal" description="Four questions. Honest answers. Searchable forever." />

      <nav className="mb-4 flex flex-wrap gap-1 text-sm">
        {TYPES.map((t) => (
          <a key={t.key} href={`?type=${t.key.toLowerCase()}`} className={cn("rounded-md px-3 py-1.5", !q && type === t.key ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground")}>
            {t.label} <span className="tabular text-xs text-muted-foreground">{count(t.key)}</span>
          </a>
        ))}
      </nav>

      <Card className="mb-6">
        <CardHeader>
          <div><CardTitle>{periodLabel({ type, date: period })}</CardTitle><CardDescription>{info.hint}</CardDescription></div>
          <form method="get" className="flex items-center gap-1.5">
            <input type="hidden" name="type" value={type.toLowerCase()} />
            <Input type="date" name="date" defaultValue={periodISO} className="h-8 w-auto text-xs" aria-label="Pick a date" />
            <button className="h-8 rounded-md border px-2 text-xs hover:bg-secondary">Go</button>
          </form>
        </CardHeader>
        <CardContent><EntryForm key={`${type}-${periodISO}`} type={type} date={periodISO} e={current} /></CardContent>
      </Card>

      <form method="get" className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={q} placeholder="Search every entry…" className="h-10 pl-9" />
      </form>
      {q && <p className="mb-3 text-sm text-muted-foreground">{entries.length} result{entries.length === 1 ? "" : "s"} for “{q}” · <a href={`?type=${type.toLowerCase()}`} className="text-primary">clear</a></p>}

      {!entries.length ? <Empty title={q ? "No matches" : "No entries yet"}>{q ? "Try a different word." : "Your first entry will show up here."}</Empty> : (
        <div className="grid gap-3">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="pt-4 sm:pt-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{periodLabel(e)}</p>
                    {q && <Badge tone="outline">{e.type.toLowerCase()}</Badge>}
                    {e.mood && <span title={`Mood ${e.mood}/5`}>{MOODS[e.mood]}</span>}
                  </div>
                  <DeleteButton action={deleteJournal} id={e.id} confirmText="Delete this journal entry?" />
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {QUESTIONS.filter(([k]) => e[k]).map(([k, label]) => (
                    <div key={k}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap"><Highlight text={e[k]!} q={q} /></dd></div>
                  ))}
                </dl>
                {e.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground"><Highlight text={e.body} q={q} /></p>}
                <Disclosure className="mt-3" summary={<span className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Edit</span>}>
                  <EntryForm type={e.type} date={toISO(e.date)} e={e} />
                </Disclosure>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
