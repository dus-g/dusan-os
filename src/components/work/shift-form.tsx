import type { PayRate, Shift } from "@prisma/client";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { minutesToTime, toISO } from "@/lib/dates";

export function ShiftForm({ action, rates, shift, today, submit = "Save shift" }: {
  action: (fd: FormData) => Promise<void>; rates: PayRate[]; shift?: Shift; today: Date; submit?: string;
}) {
  return (
    <form action={action} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {shift && <input type="hidden" name="id" value={shift.id} />}
      <Field label="Date"><Input type="date" name="date" defaultValue={toISO(shift?.date ?? today)} required /></Field>
      <Field label="Start"><Input type="time" name="start" defaultValue={shift ? minutesToTime(shift.startMinute) : "07:00"} required /></Field>
      <Field label="Finish"><Input type="time" name="end" defaultValue={shift ? minutesToTime(shift.endMinute) : "15:30"} required /></Field>
      <Field label="Break (min)"><Input type="number" name="breakMinutes" min={0} step={5} defaultValue={shift?.breakMinutes ?? 30} /></Field>
      <Field label="Shift type" hint="Sundays are detected automatically.">
        <Select name="shiftType" defaultValue={shift?.shiftType ?? "STANDARD"}>
          <option value="STANDARD">Standard</option>
          <option value="SATURDAY">Saturday</option>
          <option value="SUNDAY">Sunday</option>
          <option value="PUBLIC_HOLIDAY">Public holiday</option>
        </Select>
      </Field>
      <Field label="Pay profile">
        <Select name="payRateId" defaultValue={shift?.payRateId ?? rates.find((r) => r.isDefault)?.id}>
          {rates.filter((r) => r.active || r.id === shift?.payRateId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Field>
      <Field label="Location" className="col-span-2"><Input name="location" placeholder="e.g. Adelaide Showground" defaultValue={shift?.location ?? ""} /></Field>
      <Field label="Notes" className="col-span-2 sm:col-span-3"><Textarea name="notes" rows={1} className="min-h-9" defaultValue={shift?.notes ?? ""} /></Field>
      <div className="col-span-2 flex items-end sm:col-span-1"><SubmitButton className="w-full">{submit}</SubmitButton></div>
    </form>
  );
}
