/* fr-FR formatting. Always Intl — never hand-built strings (U+202F groups, comma decimals). */
import type { ISODate } from "../store/types";
import { diffDays } from "./dates";

const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const dateLong = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateMed = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const monthLong = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShort = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });
const weekdayLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });
const at = (d: ISODate) => new Date(`${d}T00:00:00Z`);

export const fmtInt = (n: number) => nf0.format(Math.round(n));
export const fmtDec = (n: number) => nf1.format(n);
export const fmtPct = (n: number, digits = 0) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)} %`;
export const fmtHours = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n)} h`;
export const fmtDZD = (n: number) => `${nf0.format(Math.round(n))} DZD`;
export const fmtDZDCompact = (n: number) => (Math.abs(n) >= 1e6 ? `${compact.format(n)} DZD` : fmtDZD(n));
export const fmtDate = (d: ISODate) => dateMed.format(at(d));
export const fmtDateLong = (d: ISODate) => dateLong.format(at(d));
export const fmtDateShort = (d: ISODate) => dateShort.format(at(d));
export const fmtMonth = (d: ISODate) => monthLong.format(at(d));
export const fmtMonthShort = (d: ISODate) => monthShort.format(at(d)).replace(".", "");
export const fmtWeekday = (d: ISODate) => weekday.format(at(d)).replace(".", "");
export const fmtWeekdayLong = (d: ISODate) => weekdayLong.format(at(d));
export const fmtRange = (a: ISODate, b: ISODate) => (a === b ? fmtDateShort(a) : `${fmtDateShort(a)} → ${fmtDate(b)}`);

/** "dans 3 j", "il y a 2 j", "aujourd'hui" — relative to the demo clock. */
export function relDays(d: ISODate, now: ISODate): string {
  const n = diffDays(now, d);
  if (n === 0) return "aujourd’hui";
  if (n === 1) return "demain";
  if (n === -1) return "hier";
  return n > 0 ? `dans ${n} j` : `il y a ${-n} j`;
}
export const plural = (n: number, one: string, many?: string) => (n === 1 || n === 0 ? one : many ?? `${one}s`);
