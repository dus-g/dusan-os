import { Sidebar, MobileNav } from "@/components/sidebar";
import { getUser } from "@/lib/session";
import { db } from "@/lib/db";
import { levelFromXp } from "@/lib/xp";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, userId } = await getUser();
  const xp = await db.xpEvent.aggregate({ where: { userId }, _sum: { amount: true } });
  return (
    <div className="flex min-h-dvh">
      <Sidebar name={user.name} level={levelFromXp(xp._sum.amount ?? 0)} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <MobileNav />
    </div>
  );
}
