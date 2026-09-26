import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fromISO } from "@/lib/dates";

export const requireUserId = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
});

export const getSettings = cache(async (userId: string) => {
  const s = await db.settings.findUnique({ where: { userId } });
  if (s) return s;
  return db.settings.create({
    data: { userId, dateOfBirth: fromISO("2003-12-09"), universityStartDate: fromISO("2027-03-02") },
  });
});

export const getUser = cache(async () => {
  const userId = await requireUserId();
  const [user, settings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true, createdAt: true } }),
    getSettings(userId),
  ]);
  return { user, settings, userId };
});

export function taxOptions(s: { taxMode: "ATO_RESIDENT" | "FLAT"; flatTaxRate: number; hasStudyLoan: boolean }) {
  return { mode: s.taxMode, flatRate: s.flatTaxRate, hasStudyLoan: s.hasStudyLoan } as const;
}
