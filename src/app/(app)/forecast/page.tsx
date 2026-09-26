import { db } from "@/lib/db";
import { getUser, taxOptions } from "@/lib/session";
import { DEFAULT_RATE_CARD } from "@/lib/pay";
import { TAX_YEAR } from "@/lib/tax";
import { PageHeader } from "@/components/page";
import { Forecast } from "@/components/work/forecast";

export const metadata = { title: "Forecast" };

export default async function ForecastPage() {
  const { userId, settings } = await getUser();
  const r = await db.payRate.findFirst({ where: { userId, isDefault: true } });
  const rate = r ?? DEFAULT_RATE_CARD;
  return (
    <div>
      <PageHeader title="Work forecast" description={`What different weekly hours earn on your default pay profile. Tax uses ${TAX_YEAR} resident rates with Medicare levy and the low income tax offset.`} />
      <Forecast
        tax={taxOptions(settings)}
        superRate={settings.superRate}
        rate={{
          baseRateCents: rate.baseRateCents, saturdayRateCents: rate.saturdayRateCents, sundayRateCents: rate.sundayRateCents,
          publicHolidayRateCents: rate.publicHolidayRateCents, overtime1RateCents: rate.overtime1RateCents, overtime2RateCents: rate.overtime2RateCents,
          overtimeAfterMinutes: rate.overtimeAfterMinutes, overtimeTier1Minutes: rate.overtimeTier1Minutes,
        }}
      />
    </div>
  );
}
