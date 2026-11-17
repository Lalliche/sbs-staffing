/* Work mode (présentiel / à distance). Pure: the same state and date always give the same answer.
   Precedence for one person on one day: not a working day → OFF · approved absence → ABSENT ·
   explicit one-day override (`state.workModes`) · usual pattern (`Employee.remoteWeekdays`) · otherwise on site. */
import type { AppState, Employee, ISODate, WorkMode } from "../store/types";
import { absenceDaySet, calendarOf, isWorkingDay } from "./capacity";
import { eachDay } from "./dates";
import { memo } from "./memo";

type S = Pick<AppState, "employees" | "offices" | "holidays" | "leaves" | "assignments" | "workModes">;

/** What a person is doing on a day. OFF = weekend, holiday or outside their contract; ABSENT = approved absence. */
export type Presence = WorkMode | "ABSENT" | "OFF";

const dow = (d: ISODate) => new Date(`${d}T00:00:00Z`).getUTCDay();

function overrides(state: S): Map<string, WorkMode> {
  return memo(state, "workModeOverrides", () => new Map(state.workModes.map((w) => [`${w.employeeId}|${w.date}`, w.mode])));
}

/** The mode a person works in on a day *if* they work that day (ignores absences and calendars). */
export function plannedModeOn(state: S, emp: Employee, date: ISODate): WorkMode {
  const o = overrides(state).get(`${emp.id}|${date}`);
  if (o) return o;
  return emp.remoteWeekdays?.includes(dow(date)) ? "REMOTE" : "ONSITE";
}

export function presenceOn(state: S, emp: Employee, date: ISODate): Presence {
  if (emp.status === "ARCHIVE") return "OFF";
  if (!isWorkingDay(emp, calendarOf(state, emp), date)) return "OFF";
  if (absenceDaySet(state, emp.id, date, date).size) return "ABSENT";
  return plannedModeOn(state, emp, date);
}

export interface PresenceCount {
  onsite: number;
  remote: number;
  absent: number;
  /** People who do not work that day (weekend, holiday, outside contract). */
  off: number;
}
export function presenceCount(state: S, emps: Employee[], date: ISODate): PresenceCount {
  const out: PresenceCount = { onsite: 0, remote: 0, absent: 0, off: 0 };
  for (const e of emps) {
    const p = presenceOn(state, e, date);
    if (p === "ONSITE") out.onsite++;
    else if (p === "REMOTE") out.remote++;
    else if (p === "ABSENT") out.absent++;
    else out.off++;
  }
  return out;
}

/** Presence of one person over a range, day by day (for the planning strip and the employee page). */
export function presenceRange(state: S, emp: Employee, from: ISODate, to: ISODate): { date: ISODate; presence: Presence; override: boolean }[] {
  const ov = overrides(state);
  return eachDay(from, to).map((date) => ({ date, presence: presenceOn(state, emp, date), override: ov.has(`${emp.id}|${date}`) }));
}

/** Person-days on site / remote over a range (absences and non-working days excluded). */
export function presenceDays(state: S, emps: Employee[], from: ISODate, to: ISODate): { onsite: number; remote: number; remoteSharePct: number } {
  let onsite = 0;
  let remote = 0;
  for (const e of emps) {
    for (const d of eachDay(from, to)) {
      const p = presenceOn(state, e, d);
      if (p === "ONSITE") onsite++;
      else if (p === "REMOTE") remote++;
    }
  }
  const total = onsite + remote;
  return { onsite, remote, remoteSharePct: total ? (remote / total) * 100 : 0 };
}
