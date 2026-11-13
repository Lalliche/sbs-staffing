/* Pure calendar helpers on ISO dates ("YYYY-MM-DD"), always UTC. No Date.now(). */
import type { ISODate } from "../store/types";

const DAY = 86_400_000;

export const toMs = (d: ISODate): number => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};
export const fromMs = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10);

export const addDays = (d: ISODate, n: number): ISODate => fromMs(toMs(d) + n * DAY);
/** b − a, in days */
export const diffDays = (a: ISODate, b: ISODate): number => Math.round((toMs(b) - toMs(a)) / DAY);
/** 0 = Sunday … 6 = Saturday */
export const dow = (d: ISODate): number => new Date(toMs(d)).getUTCDay();
export const maxD = (a: ISODate, b: ISODate): ISODate => (a >= b ? a : b);
export const minD = (a: ISODate, b: ISODate): ISODate => (a <= b ? a : b);
export const overlaps = (aS: ISODate, aE: ISODate, bS: ISODate, bE: ISODate): boolean => aS <= bE && bS <= aE;

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let ms = toMs(from), end = toMs(to); ms <= end; ms += DAY) out.push(fromMs(ms));
  return out;
}

/** First day of the week containing `d` (default: Sunday — Algerian working week starts Sunday). */
export function weekStart(d: ISODate, startsOn = 0): ISODate {
  const diff = (dow(d) - startsOn + 7) % 7;
  return addDays(d, -diff);
}
export const monthStart = (d: ISODate): ISODate => `${d.slice(0, 7)}-01`;
export function addMonths(d: ISODate, n: number): ISODate {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return fromMs(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(day, last)));
}
export const monthEnd = (d: ISODate): ISODate => addDays(addMonths(monthStart(d), 1), -1);
export const quarterStart = (d: ISODate): ISODate => {
  const [y, m] = d.split("-").map(Number);
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, "0")}-01`;
};
/** ISO-like week label "S46" (week number where week 1 contains Jan 4th; weeks start Sunday). */
export function weekNumber(d: ISODate): number {
  const ws = weekStart(d);
  const jan4 = `${addDays(ws, 3).slice(0, 4)}-01-04`;
  const w1 = weekStart(jan4);
  return Math.floor(diffDays(w1, ws) / 7) + 1;
}
export const isValidDate = (d: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(d) && fromMs(toMs(d)) === d;

/** Month buckets between two dates (inclusive), each as [start, end]. */
export function monthsBetween(from: ISODate, to: ISODate): { key: string; start: ISODate; end: ISODate }[] {
  const out: { key: string; start: ISODate; end: ISODate }[] = [];
  let cur = monthStart(from);
  while (cur <= to) {
    out.push({ key: cur.slice(0, 7), start: cur, end: monthEnd(cur) });
    cur = addMonths(cur, 1);
  }
  return out;
}
