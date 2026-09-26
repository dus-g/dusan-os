"use client";

import { motion, useReducedMotion } from "framer-motion";

export interface Milestone { label: string; date: string; done: boolean }

/**
 * The dashboard's signature element: Dusan's life from now to Dr Dusan,
 * drawn as a single line with milestones, and a marker for today.
 */
export function LifeArc({ start, end, today, milestones }: { start: string; end: string; today: string; milestones: Milestone[] }) {
  const reduce = useReducedMotion();
  const s = Date.parse(start), e = Date.parse(end);
  const pos = (d: string) => Math.min(100, Math.max(0, ((Date.parse(d) - s) / (e - s)) * 100));
  const now = pos(today);
  const years: number[] = [];
  for (let y = new Date(start).getUTCFullYear() + 1; y <= new Date(end).getUTCFullYear(); y++) years.push(y);

  return (
    <div className="relative select-none pb-14 pt-10">
      <div className="relative h-px bg-border">
        <motion.div
          className="absolute inset-y-0 left-0 h-[3px] -translate-y-px rounded-full bg-primary"
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${now}%` }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
        {years.map((y) => (
          <span key={y} className="absolute top-3 -translate-x-1/2 text-[10px] text-muted-foreground tabular" style={{ left: `${pos(`${y}-01-01`)}%` }}>{y}</span>
        ))}
        {milestones.map((m, i) => (
          <div key={m.label} className="absolute -translate-x-1/2" style={{ left: `${pos(m.date)}%` }}>
            <span className={`block size-2.5 -translate-y-1/2 rounded-full border-2 ${m.done ? "border-primary bg-primary" : "border-muted-foreground bg-background"}`} />
            <span className={`absolute left-1/2 w-max max-w-28 -translate-x-1/2 text-center text-[11px] leading-tight ${i % 2 ? "top-8" : "-top-9"} ${m.done ? "text-foreground" : "text-muted-foreground"}`}>
              {m.label}
            </span>
          </div>
        ))}
        <motion.div
          className="absolute -translate-x-1/2"
          initial={reduce ? false : { left: "0%" }}
          animate={{ left: `${now}%` }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="block size-3.5 -translate-y-1/2 rounded-full bg-xp ring-4 ring-xp/20" />
        </motion.div>
      </div>
    </div>
  );
}
