import type { PayRate } from "@prisma/client";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { money, centsToInput } from "@/lib/money";
import { savePayRate, setDefaultPayRate, deletePayRate } from "@/actions/work";
import { PageHeader, Disclosure } from "@/components/page";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input, Select, Checkbox } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/delete-button";

export const metadata = { title: "Pay profiles" };

function RateForm({ r }: { r?: PayRate }) {
  return (
    <form action={savePayRate} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {r && <input type="hidden" name="id" value={r.id} />}
      <Field label="Profile name" className="col-span-2"><Input name="name" defaultValue={r?.name} placeholder="White Marquee — Casual" required /></Field>
      <Field label="Employer"><Input name="employer" defaultValue={r?.employer} required /></Field>
      <Field label="Role"><Input name="role" defaultValue={r?.role} required /></Field>
      <Field label="Employment">
        <Select name="employmentType" defaultValue={r?.employmentType ?? "CASUAL"}>
          <option value="CASUAL">Casual</option><option value="PART_TIME">Part time</option>
          <option value="FULL_TIME">Full time</option><option value="CONTRACT">Contract</option>
        </Select>
      </Field>
      <Field label="Base $/h"><Input name="base" inputMode="decimal" defaultValue={centsToInput(r?.baseRateCents)} required /></Field>
      <Field label="Saturday $/h" hint="Blank = base rate"><Input name="saturday" inputMode="decimal" defaultValue={centsToInput(r?.saturdayRateCents)} /></Field>
      <Field label="Sunday $/h"><Input name="sunday" inputMode="decimal" defaultValue={centsToInput(r?.sundayRateCents)} required /></Field>
      <Field label="Public holiday $/h"><Input name="publicHoliday" inputMode="decimal" defaultValue={centsToInput(r?.publicHolidayRateCents)} required /></Field>
      <Field label="Overtime tier 1 $/h"><Input name="ot1" inputMode="decimal" defaultValue={centsToInput(r?.overtime1RateCents)} required /></Field>
      <Field label="Overtime tier 2 $/h"><Input name="ot2" inputMode="decimal" defaultValue={centsToInput(r?.overtime2RateCents)} required /></Field>
      <Field label="Overtime after (h/day)"><Input name="otAfterHours" inputMode="decimal" defaultValue={r ? r.overtimeAfterMinutes / 60 : 7.6} /></Field>
      <Field label="Tier 1 length (h)"><Input name="otTier1Hours" inputMode="decimal" defaultValue={r ? r.overtimeTier1Minutes / 60 : 3} /></Field>
      {r && <Checkbox name="active" label="Active" defaultChecked={r.active} className="col-span-2 self-end" />}
      <div className="col-span-2 flex items-end justify-end sm:col-span-4"><SubmitButton>{r ? "Save profile" : "Add profile"}</SubmitButton></div>
    </form>
  );
}

export default async function RatesPage() {
  const { userId, settings } = await getUser();
  const rates = await db.payRate.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { active: "desc" }, { name: "asc" }] });
  const cur = settings.currency;
  return (
    <div className="space-y-6">
      <PageHeader title="Pay profiles" description="Rates are snapshotted onto each shift, so editing a profile never changes past pay. Add a new profile when you change jobs." />
      {rates.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">{r.name} {r.isDefault && <Badge tone="primary">Default</Badge>} {!r.active && <Badge>Inactive</Badge>}</CardTitle>
              <CardDescription>{r.role}, {r.employer}</CardDescription>
            </div>
            <div className="flex items-center gap-1">
              {!r.isDefault && (
                <form action={setDefaultPayRate}><input type="hidden" name="id" value={r.id} /><Button size="sm" variant="ghost">Make default</Button></form>
              )}
              <DeleteButton action={deletePayRate} id={r.id} confirmText="Delete this profile? Profiles with shifts are deactivated instead." />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 tabular">
              <div className="flex justify-between"><dt className="text-muted-foreground">Base</dt><dd>{money(r.baseRateCents, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Sunday</dt><dd>{money(r.sundayRateCents, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Public holiday</dt><dd>{money(r.publicHolidayRateCents, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">OT first {r.overtimeTier1Minutes / 60}h</dt><dd>{money(r.overtime1RateCents, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">OT after</dt><dd>{money(r.overtime2RateCents, cur)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">OT starts</dt><dd>{r.overtimeAfterMinutes / 60}h/day</dd></div>
            </dl>
            <Disclosure className="mt-3" summary={<span className="text-sm text-primary">Edit profile</span>}><RateForm r={r} /></Disclosure>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader><CardTitle>New pay profile</CardTitle></CardHeader>
        <CardContent><RateForm /></CardContent>
      </Card>
    </div>
  );
}
