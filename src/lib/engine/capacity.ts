/* Capacity (spec 7.1). Theoretical → available. Unavailability is merged per day: the same day is never
   counted twice (leave ∪ holiday ∪ non-working weekday). */
import type { AppState, Assignment, Employee, ISODate, LeaveStatus } from "../store/types";
import { eachDay, maxD, minD } from "./dates";
import { memo } from "./memo";

type S = Pick<AppState, "employees" | "offices" | "holidays" | "leaves" | "assignments">;

export interface Calendar {
  workingWeekdays: number[];
  holidays: Set<ISODate>;
}

export function calendarOf(state: S, emp: Employee): Calendar {
  return memo(state, `cal:${emp.id}`, () => {
    const office = state.offices.find((o) => o.id === emp.officeId);
    const weekdays = emp.workingWeekdays ?? office?.workingWeekdays ?? [1, 2, 3, 4, 5];
    const holidays = new Set(state.holidays.filter((h) => h.officeId === null || h.officeId === emp.officeId).map((h) => h.date));
    return { workingWeekdays: weekdays, holidays };
  });
}

export const getEmployee = (state: Pick<AppState, "employees">, id: string): Employee | undefined => state.employees.find((e) => e.id === id);

/** weeklyHours / working days per week (spec 7.1). */
export function dailyHours(emp: Employee, cal: Calendar): number {
  return cal.workingWeekdays.length ? emp.weeklyHours / cal.workingWeekdays.length : 0;
}

/** Statuses counted as "confirmed" capacity use. */
export const isConfirmed = (a: Assignment) => a.status === "HARD" || a.status === "TERMINEE";
export const isSoft = (a: Assignment) => a.status === "SOFT";
export const isActiveAssignment = (a: Assignment) => a.status === "HARD" || a.status === "SOFT" || a.status === "TERMINEE";

const dow = (d: ISODate) => new Date(`${d}T00:00:00Z`).getUTCDay();

export function assignmentsOf(state: S, employeeId: string): Assignment[] {
  const idx = memo(state, "assignmentsByEmployee", () => {
    const m = new Map<string, Assignment[]>();
    for (const a of state.assignments) {
      if (!isActiveAssignment(a)) continue;
      const l = m.get(a.employeeId);
      if (l) l.push(a);
      else m.set(a.employeeId, [a]);
    }
    return m;
  });
  return idx.get(employeeId) ?? [];
}

/** Days inside the employee's contract, on a working weekday, not a holiday. */
export function isWorkingDay(emp: Employee, cal: Calendar, d: ISODate): boolean {
  if (d < emp.startDate) return false;
  if (emp.endDate && d > emp.endDate) return false;
  return cal.workingWeekdays.includes(dow(d)) && !cal.holidays.has(d);
}
export function workingDays(state: S, emp: Employee, from: ISODate, to: ISODate): ISODate[] {
  const cal = calendarOf(state, emp);
  return eachDay(from, to).filter((d) => isWorkingDay(emp, cal, d));
}

/** Union of leave days (merged: overlapping leaves count once). */
export function absenceDaySet(state: S, employeeId: string, from: ISODate, to: ISODate, statuses: LeaveStatus[] = ["APPROUVEE"]): Set<ISODate> {
  const out = new Set<ISODate>();
  for (const l of state.leaves) {
    if (l.employeeId !== employeeId || !statuses.includes(l.status)) continue;
    if (l.endDate < from || l.startDate > to) continue;
    for (const d of eachDay(maxD(l.startDate, from), minD(l.endDate, to))) out.add(d);
  }
  return out;
}

export function theoreticalHours(state: S, emp: Employee, from: ISODate, to: ISODate): number {
  const cal = calendarOf(state, emp);
  return workingDays(state, emp, from, to).length * dailyHours(emp, cal);
}
/** Hours lost to approved absences, on working days only (so a leave over a holiday/weekend counts once). */
export function absenceHours(state: S, emp: Employee, from: ISODate, to: ISODate): number {
  const cal = calendarOf(state, emp);
  const abs = absenceDaySet(state, emp.id, from, to);
  return workingDays(state, emp, from, to).filter((d) => abs.has(d)).length * dailyHours(emp, cal);
}

export interface DayLoad {
  date: ISODate;
  working: boolean;
  absent: boolean;
  /** Confirmed allocation, % of the person's capacity. */
  hardPct: number;
  softPct: number;
  hours: number;
}
/** Per-day load of one employee over a range. */
export function dayLoads(state: S, emp: Employee, from: ISODate, to: ISODate): DayLoad[] {
  return memo(state, `loads:${emp.id}:${from}:${to}`, () => {
    const cal = calendarOf(state, emp);
    const dh = dailyHours(emp, cal);
    const abs = absenceDaySet(state, emp.id, from, to);
    const days = eachDay(from, to);
    const map = new Map<ISODate, DayLoad>();
    for (const d of days) {
      const working = isWorkingDay(emp, cal, d);
      map.set(d, { date: d, working, absent: working && abs.has(d), hardPct: 0, softPct: 0, hours: dh });
    }
    for (const a of assignmentsOf(state, emp.id)) {
      if (a.endDate < from || a.startDate > to) continue;
      for (const d of eachDay(maxD(a.startDate, from), minD(a.endDate, to))) {
        const l = map.get(d)!;
        if (!l.working) continue;
        if (isConfirmed(a)) l.hardPct += a.allocationPct;
        else l.softPct += a.allocationPct;
      }
    }
    return days.map((d) => map.get(d)!);
  });
}

/** Hours assigned on days the person is actually present (HARD, optionally + SOFT). */
export function assignedHours(state: S, emp: Employee, from: ISODate, to: ISODate, opts: { includeSoft?: boolean } = {}): number {
  let h = 0;
  for (const l of dayLoads(state, emp, from, to)) {
    if (!l.working || l.absent) continue;
    h += (l.hardPct + (opts.includeSoft ? l.softPct : 0)) / 100 * l.hours;
  }
  return h;
}
/** Hours reserved by SOFT bookings only. */
export function reservedHours(state: S, emp: Employee, from: ISODate, to: ISODate): number {
  let h = 0;
  for (const l of dayLoads(state, emp, from, to)) if (l.working && !l.absent) h += (l.softPct / 100) * l.hours;
  return h;
}
/** available = theoretical − absences − confirmed (HARD) hours. Per-day clamped: an overloaded day cannot "pay for" a free one. */
export function availableHours(state: S, emp: Employee, from: ISODate, to: ISODate, opts: { includeSoft?: boolean } = {}): number {
  let h = 0;
  for (const l of dayLoads(state, emp, from, to)) {
    if (!l.working || l.absent) continue;
    const used = l.hardPct + (opts.includeSoft ? l.softPct : 0);
    h += Math.max(0, 100 - used) / 100 * l.hours;
  }
  return h;
}
/** Hours above 100 % (planned overload). */
export function overloadHours(state: S, emp: Employee, from: ISODate, to: ISODate): number {
  let h = 0;
  for (const l of dayLoads(state, emp, from, to)) {
    if (!l.working || l.absent) continue;
    h += Math.max(0, l.hardPct - 100) / 100 * l.hours;
  }
  return h;
}
/** Peak confirmed allocation over a range (for heatmaps). */
export function peakLoadPct(state: S, emp: Employee, from: ISODate, to: ISODate, includeSoft = true): number {
  let p = 0;
  for (const l of dayLoads(state, emp, from, to)) if (l.working && !l.absent) p = Math.max(p, l.hardPct + (includeSoft ? l.softPct : 0));
  return p;
}
/** Average load % across present working days. */
export function averageLoadPct(state: S, emp: Employee, from: ISODate, to: ISODate, includeSoft = false): number {
  const ls = dayLoads(state, emp, from, to).filter((l) => l.working && !l.absent);
  if (!ls.length) return 0;
  return ls.reduce((s, l) => s + l.hardPct + (includeSoft ? l.softPct : 0), 0) / ls.length;
}
/** Planned hours of one assignment: working days × dailyHours × %, ignoring leave (it is the *plan*). */
export function plannedHoursFor(state: S, emp: Employee, start: ISODate, end: ISODate, pct: number): number {
  const cal = calendarOf(state, emp);
  return Math.round(workingDays(state, emp, start, end).length * dailyHours(emp, cal) * (pct / 100) * 10) / 10;
}
