"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";

type Datum = Record<string, string | number | null>;
export type Series = { key: string; label: string; color?: string };

const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function fmt(v: number, kind: "money" | "number" | "hours") {
  if (kind === "money") return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0, notation: Math.abs(v) >= 10000 ? "compact" : "standard" }).format(v);
  if (kind === "hours") return `${Math.round(v * 10) / 10}h`;
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(v);
}

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;

function ChartTooltip({ kind }: { kind: "money" | "number" | "hours" }) {
  return (
    <Tooltip
      cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }}
      formatter={(v: number) => fmt(v, kind)}
    />
  );
}

export function TrendChart({
  data, x, series, type = "area", kind = "money", height = 220, stacked,
}: { data: Datum[]; x: string; series: Series[]; type?: "area" | "bar" | "line"; kind?: "money" | "number" | "hours"; height?: number; stacked?: boolean }) {
  if (!data.length) return <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>No data yet</div>;
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
      <XAxis dataKey={x} {...axis} minTickGap={16} />
      <YAxis {...axis} width={52} tickFormatter={(v) => fmt(v, kind)} />
      <ChartTooltip kind={kind} />
      {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
    </>
  );
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        {type === "bar" ? (
          <BarChart data={data}>
            {common}
            {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? PALETTE[i]} radius={[3, 3, 0, 0]} stackId={stacked ? "a" : undefined} maxBarSize={36} />)}
          </BarChart>
        ) : type === "line" ? (
          <LineChart data={data}>
            {common}
            {series.map((s, i) => <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i]} strokeWidth={2} dot={false} connectNulls type="monotone" />)}
          </LineChart>
        ) : (
          <AreaChart data={data}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={s.color ?? PALETTE[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {common}
            {series.map((s, i) => <Area key={s.key} dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i]} fill={`url(#g-${s.key})`} strokeWidth={2} type="monotone" />)}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
