/* Presence selectors (présentiel / à distance). RBAC-aware: nothing is returned without `workmode.view`. */
import { addDays, weekStart } from "../../engine/dates";
import { presenceCount, presenceOn, presenceRange, type Presence, type PresenceCount } from "../../engine/workmode";
import type { AppState, Employee, ISODate } from "../types";
import { canDo, sessionUser } from "./core";

const visible = (s: AppState, emps: Employee[]): Employee[] => (canDo(s, "workmode.view") ? emps.filter((e) => canDo(s, "employee.view", { employeeId: e.id }) || e.id === sessionUser(s)?.employeeId) : []);

/** Presence of one person on a day, or null when the viewer may not see it. */
export function presenceOfEmployeeOn(s: AppState, e: Employee, date: ISODate): Presence | null {
  return visible(s, [e]).length ? presenceOn(s, e, date) : null;
}

/** Counts for a day over the people the viewer may see (defaults to the demo « today »). */
export function presenceSummary(s: AppState, emps: Employee[], date: ISODate = s.now): PresenceCount & { total: number; allowed: boolean } {
  const list = visible(s, emps.filter((e) => e.status !== "ARCHIVE"));
  return { ...presenceCount(s, list, date), total: list.length, allowed: canDo(s, "workmode.view") };
}

/** Ids by presence on a day — used by list filters. */
export function presenceIds(s: AppState, emps: Employee[], date: ISODate = s.now): Record<Presence, string[]> {
  const out: Record<Presence, string[]> = { ONSITE: [], REMOTE: [], ABSENT: [], OFF: [] };
  for (const e of visible(s, emps.filter((x) => x.status !== "ARCHIVE"))) out[presenceOn(s, e, date)].push(e.id);
  return out;
}

/** The working week (Sunday→Thursday by default) of a person, day by day, starting from the demo week. */
export function presenceWeeks(s: AppState, e: Employee, weeks = 2): { date: ISODate; presence: Presence; override: boolean }[][] {
  if (!visible(s, [e]).length) return [];
  const ws = weekStart(s.now);
  return Array.from({ length: weeks }, (_, i) => presenceRange(s, e, addDays(ws, i * 7), addDays(ws, i * 7 + 6)));
}

/** May the viewer change this person's mode? */
export const canEditPresence = (s: AppState, employeeId: string): boolean => canDo(s, "workmode.edit", { employeeId });

/** Remote days of a person over a range (the planning draws them as a dashed line). Empty when the viewer may not see presence. */
export function remoteDaysOf(s: AppState, e: Employee, from: ISODate, to: ISODate): ISODate[] {
  if (!visible(s, [e]).length) return [];
  return presenceRange(s, e, from, to).filter((d) => d.presence === "REMOTE").map((d) => d.date);
}
