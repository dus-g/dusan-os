import {
  LayoutDashboard, Clock, Wallet, CalendarClock, TrendingUp, Landmark, Receipt, PieChart, PiggyBank,
  GraduationCap, Stethoscope, Target, Trophy, Repeat, HeartPulse, NotebookPen, Map, BarChart3, Settings,
} from "lucide-react";

export const NAV = [
  { group: "Today", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Work",
    items: [
      { href: "/work", label: "Shifts", icon: Clock },
      { href: "/payday", label: "Payday", icon: CalendarClock },
      { href: "/forecast", label: "Forecast", icon: TrendingUp },
    ],
  },
  {
    group: "Money",
    items: [
      { href: "/finances", label: "Accounts", icon: Landmark },
      { href: "/expenses", label: "Expenses", icon: Receipt },
      { href: "/budget", label: "Budget", icon: PieChart },
      { href: "/savings", label: "Savings goals", icon: PiggyBank },
    ],
  },
  {
    group: "Study",
    items: [
      { href: "/university", label: "Public Health", icon: GraduationCap },
      { href: "/medicine", label: "Medicine", icon: Stethoscope },
    ],
  },
  {
    group: "Life",
    items: [
      { href: "/missions", label: "Missions", icon: Target },
      { href: "/rpg", label: "Level & achievements", icon: Trophy },
      { href: "/habits", label: "Habits", icon: Repeat },
      { href: "/health", label: "Health", icon: HeartPulse },
      { href: "/journal", label: "Journal", icon: NotebookPen },
      { href: "/roadmap", label: "Roadmap", icon: Map },
    ],
  },
  {
    group: "Review",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

export const MOBILE_NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/work", label: "Shifts", icon: Clock },
  { href: "/habits", label: "Habits", icon: Repeat },
  { href: "/finances", label: "Money", icon: Wallet },
] as const;
