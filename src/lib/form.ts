import { fromISO } from "./dates";
import { toCents } from "./money";

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const int = (fd: FormData, k: string, fallback = 0) => {
  const n = num(fd, k);
  return n === null ? fallback : Math.round(n);
};
export const bool = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v === "on" || v === "true" || v === "1";
};
export const date = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? fromISO(v) : null;
};
export const cents = (fd: FormData, k: string) => {
  const c = toCents(fd.get(k));
  return Number.isFinite(c) ? c : null;
};
export function required<T>(v: T | null | undefined, name: string): T {
  if (v === null || v === undefined || (typeof v === "string" && v === "")) throw new Error(`${name} is required`);
  return v;
}
export type FormState = { error?: string; success?: string } | undefined;
