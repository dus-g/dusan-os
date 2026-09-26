"use client";

import { useTheme } from "next-themes";
import { Select } from "@/components/ui/input";

/** Applies the theme instantly and submits it with the preferences form. */
export function ThemeSelect({ defaultValue }: { defaultValue: string }) {
  const { setTheme } = useTheme();
  return (
    <Select name="theme" id="theme" defaultValue={defaultValue} onChange={(e) => setTheme(e.target.value)}>
      <option value="dark">Dark</option>
      <option value="light">Light</option>
    </Select>
  );
}
