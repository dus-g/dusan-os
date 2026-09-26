import Link from "next/link";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { toISO } from "@/lib/dates";
import { money } from "@/lib/money";
import { TAX_YEAR } from "@/lib/tax";
import { updateProfile, changePassword, deleteAccount, logout } from "@/actions/auth";
import { savePreferences } from "@/actions/life";
import { createCategory, archiveCategory } from "@/actions/finance";
import { PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { ActionForm } from "@/components/settings/action-form";
import { ThemeSelect } from "@/components/settings/theme-select";
import { ChevronRight, Download, LogOut, X } from "lucide-react";

export const metadata = { title: "Settings" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CURRENCIES = ["AUD", "NZD", "USD", "GBP", "EUR", "CAD", "SGD"];

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><div><CardTitle>{title}</CardTitle>{description && <CardDescription className="mt-0.5">{description}</CardDescription>}</div></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default async function SettingsPage() {
  const { user, settings, userId } = await getUser();
  const [categories, payRates, programs, budgets, goals] = await Promise.all([
    db.category.findMany({ where: { userId, archived: false }, orderBy: { name: "asc" } }),
    db.payRate.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
    db.universityProgram.findMany({ where: { userId }, orderBy: { startDate: "asc" } }),
    db.budget.count({ where: { userId } }),
    db.goal.count({ where: { userId } }),
  ]);
  const defaultRate = payRates.find((r) => r.isDefault) ?? payRates[0];

  const links = [
    { href: "/work/rates", label: "Pay profiles & hourly rates", sub: defaultRate ? `${defaultRate.name} · ${money(defaultRate.baseRateCents, settings.currency)}/h` : "Not set" },
    { href: "/budget", label: "Budget categories & limits", sub: `${budgets} budget lines` },
    { href: "/savings", label: "Savings goals", sub: `${goals} goals` },
    ...programs.map((p) => ({ href: p.kind === "MEDICINE" ? "/medicine" : "/university", label: `${p.name} costs`, sub: `${money(p.annualCostCents, settings.currency, { noCents: true })}/yr · ${p.durationYears} yrs` })),
    { href: "/missions", label: "Missions", sub: "Add, edit and archive" },
  ];

  return (
    <>
      <PageHeader title="Settings" actions={
        <form action={logout}><Button variant="outline" size="sm"><LogOut />Sign out</Button></form>
      } />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Profile">
          <ActionForm action={updateProfile} submit="Save profile" className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><Input name="name" defaultValue={user.name} required /></Field>
            <Field label="Email"><Input name="email" type="email" defaultValue={user.email} required autoComplete="email" /></Field>
            <Field label="Date of birth" hint="Drives age and birthday countdown."><Input name="dateOfBirth" type="date" defaultValue={toISO(settings.dateOfBirth)} /></Field>
          </ActionForm>
        </Section>

        <Section title="Password">
          <ActionForm action={changePassword} submit="Change password" className="grid gap-3 sm:grid-cols-2">
            <Field label="Current password"><Input name="current" type="password" required autoComplete="current-password" /></Field>
            <Field label="New password" hint="At least 8 characters."><Input name="next" type="password" required minLength={8} autoComplete="new-password" /></Field>
          </ActionForm>
        </Section>

        <Section title="Money, tax & time" description={`Tax estimates use ATO ${TAX_YEAR} resident rates, LITO and the Medicare levy. Changes apply to new shifts and recalculated weeks.`}>
          <form action={savePreferences} className="grid grid-cols-2 gap-3">
            <Field label="Tax method">
              <Select name="taxMode" defaultValue={settings.taxMode}>
                <option value="ATO_RESIDENT">ATO resident rates</option>
                <option value="FLAT">Flat percentage</option>
              </Select>
            </Field>
            <Field label="Flat tax rate (%)" hint="Only used with flat method."><Input name="flatTaxRate" inputMode="decimal" defaultValue={+(settings.flatTaxRate * 100).toFixed(2)} /></Field>
            <Field label="Super guarantee (%)"><Input name="superRate" inputMode="decimal" defaultValue={+(settings.superRate * 100).toFixed(2)} /></Field>
            <Field label="Payday">
              <Select name="paydayWeekday" defaultValue={settings.paydayWeekday}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</Select>
            </Field>
            <Field label="Currency">
              <Select name="currency" defaultValue={settings.currency}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
            </Field>
            <Field label="Theme" htmlFor="theme"><ThemeSelect defaultValue={settings.theme} /></Field>
            <Field label="University start date"><Input name="universityStartDate" type="date" defaultValue={toISO(settings.universityStartDate)} /></Field>
            <div className="flex items-end pb-2"><Checkbox name="hasStudyLoan" label="Withhold HELP repayments" defaultChecked={settings.hasStudyLoan} /></div>
            <Field label="Mission categories" hint="Comma separated." className="col-span-2"><Input name="missionCategories" defaultValue={settings.missionCategories.join(", ")} /></Field>
            <div className="col-span-2 flex justify-end"><SubmitButton size="sm">Save preferences</SubmitButton></div>
          </form>
        </Section>

        <Section title="Expense categories" description="Archiving hides a category from new expenses but keeps its history.">
          <ul className="mb-4 flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5 rounded-md border py-1 pl-2 pr-1 text-sm">
                <span className="size-2 rounded-full" style={{ background: c.color }} />{c.name}
                <form action={archiveCategory}><input type="hidden" name="id" value={c.id} /><button className="rounded p-0.5 text-muted-foreground hover:text-destructive" aria-label={`Archive ${c.name}`}><X className="size-3" /></button></form>
              </li>
            ))}
          </ul>
          <form action={createCategory} className="flex items-end gap-2">
            <Field label="New category" className="flex-1"><Input name="name" required placeholder="e.g. Textbooks" /></Field>
            <Field label="Colour"><Input name="color" type="color" defaultValue="#8C95A8" className="w-12 p-1" /></Field>
            <SubmitButton size="sm">Add</SubmitButton>
          </form>
        </Section>

        <Section title="Everything else" description="Editable where it lives, so it stays in context.">
          <ul className="divide-y">
            {links.map((l) => (
              <li key={l.href + l.label}>
                <Link href={l.href} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-primary">
                  <span>{l.label}<span className="block text-xs text-muted-foreground">{l.sub}</span></span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Your data" description="Export everything as JSON. Do this every few months and keep it somewhere safe.">
          <Button asChild variant="outline" size="sm"><a href="/api/export" download><Download />Download full export</a></Button>
          <div className="mt-6 rounded-lg border border-destructive/40 p-4">
            <p className="text-sm font-medium text-destructive">Delete account</p>
            <p className="mb-3 text-xs text-muted-foreground">Permanently erases your account and every record. This cannot be undone.</p>
            <ActionForm action={deleteAccount} submit="Delete forever" variant="destructive">
              <Field label='Type "DELETE" to confirm'><Input name="confirm" autoComplete="off" /></Field>
            </ActionForm>
          </div>
        </Section>
      </div>
    </>
  );
}
