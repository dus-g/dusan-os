"use client";

import { useMemo, useState } from "react";
import { breakdown, type TaxOptions } from "@/lib/tax";
import { calculateShiftPay, type RateCard } from "@/lib/pay";
import { Field, Input, Checkbox } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const aud = (n: number, d = 0) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: d, minimumFractionDigits: d }).format(n);

/**
 * Weekly gross for H hours spread over standard days, using the real overtime rules.
 * Hours are split across `days` shifts so overtime only kicks in on long days.
 */
function weeklyGross(hoursPerWeek: number, days: number, rate: RateCard, sundayShare: number) {
  const perDay = (hoursPerWeek / days) * 60;
  const sundays = Math.round(days * sundayShare);
  let cents = 0;
  for (let i = 0; i < days; i++) {
    cents += calculateShiftPay({ startMinute: 0, endMinute: Math.round(perDay), breakMinutes: 0, shiftType: i < sundays ? "SUNDAY" : "STANDARD" }, rate).grossCents;
  }
  return cents / 100;
}

export function Forecast({ rate, tax, superRate }: { rate: RateCard; tax: TaxOptions; superRate: number }) {
  const [custom, setCustom] = useState(35);
  const [days, setDays] = useState(5);
  const [weeks, setWeeks] = useState(48);
  const [sundays, setSundays] = useState(0);
  const [loan, setLoan] = useState(!!tax.hasStudyLoan);

  const rows = useMemo(() => {
    const opts = { ...tax, hasStudyLoan: loan };
    return [20, 30, 40, 50, 60, custom].map((h) => {
      const g = weeklyGross(h, days, rate, sundays / Math.max(days, 1));
      const annual = g * weeks;
      const b = breakdown(annual, opts);
      return { h, weekly: g, annual, tax: b.total, net: b.net, weeklyNet: b.net / weeks, super: annual * superRate, effective: annual ? b.total / annual : 0, custom: h === custom };
    });
  }, [custom, days, weeks, sundays, loan, rate, tax, superRate]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><div><CardTitle>Assumptions</CardTitle><CardDescription>Adjust to match your roster. Results update as you type.</CardDescription></div></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Field label="Custom hours/week"><Input type="number" min={1} max={100} value={custom} onChange={(e) => setCustom(Number(e.target.value) || 0)} /></Field>
          <Field label="Shifts per week"><Input type="number" min={1} max={7} value={days} onChange={(e) => setDays(Math.min(7, Math.max(1, Number(e.target.value) || 1)))} /></Field>
          <Field label="Sunday shifts/week"><Input type="number" min={0} max={days} value={sundays} onChange={(e) => setSundays(Math.min(days, Math.max(0, Number(e.target.value) || 0)))} /></Field>
          <Field label="Weeks worked/year" hint="Casuals rarely hit 52."><Input type="number" min={1} max={52} value={weeks} onChange={(e) => setWeeks(Math.min(52, Math.max(1, Number(e.target.value) || 1)))} /></Field>
          <div className="flex items-end pb-2"><Checkbox label="Include HECS repayment" checked={loan} onChange={(e) => setLoan(e.target.checked)} /></div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.custom ? "custom" : r.h} className={r.custom ? "border-primary/50" : undefined}>
            <CardContent className="pt-4 sm:pt-5">
              <div className="flex items-baseline justify-between">
                <p className="font-serif text-3xl">{r.h}h</p>
                <p className="text-xs text-muted-foreground">{r.custom ? "Custom" : "per week"}</p>
              </div>
              <dl className="mt-3 space-y-1 text-sm tabular">
                <div className="flex justify-between"><dt className="text-muted-foreground">Weekly gross</dt><dd>{aud(r.weekly, 2)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Weekly take-home</dt><dd className="font-medium">{aud(r.weeklyNet, 2)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Annual gross</dt><dd>{aud(r.annual)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Annual tax</dt><dd>{aud(r.tax)} <span className="text-xs text-muted-foreground">({(r.effective * 100).toFixed(1)}%)</span></dd></div>
                <div className="flex justify-between border-t pt-1"><dt className="text-muted-foreground">Annual net</dt><dd className="font-semibold text-success">{aud(r.net)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Super</dt><dd>{aud(r.super)}</dd></div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
