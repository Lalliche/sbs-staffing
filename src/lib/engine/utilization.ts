/* Utilization (spec 7.2). Planned ≠ real ≠ billable — never confused. */
import type { AppState, Employee, ISODate, Settings } from "../store/types";
import { assignedHours, theoreticalHours } from "./capacity";

type S = Pick<AppState, "employees" | "offices" | "holidays" | "leaves" | "assignments" | "timesheets" | "entries">;

export interface UtilizationResult {
  theoretical: number;
  assigned: number;
  worked: number;
  billable: number;
  planned: number; // %
  real: number; // %
  billability: number; // %
}
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

/** Hours actually worked: VALIDATED timesheets only. */
export function validatedHours(state: S, employeeId: string, from: ISODate, to: ISODate): { worked: number; billable: number } {
  const valid = new Set(state.timesheets.filter((t) => t.employeeId === employeeId && t.status === "VALIDE").map((t) => t.id));
  let worked = 0;
  let billable = 0;
  for (const e of state.entries) {
    if (!valid.has(e.timesheetId) || e.date < from || e.date > to) continue;
    worked += e.hours;
    if (e.billable) billable += e.hours;
  }
  return { worked, billable };
}

export function utilizationOf(state: S, emp: Employee, from: ISODate, to: ISODate, opts: { includeSoft?: boolean } = {}): UtilizationResult {
  const theoretical = theoreticalHours(state, emp, from, to);
  const assigned = assignedHours(state, emp, from, to, opts);
  const { worked, billable } = validatedHours(state, emp.id, from, to);
  return { theoretical, assigned, worked, billable, planned: pct(assigned, theoretical), real: pct(worked, theoretical), billability: pct(billable, theoretical) };
}

/** Group aggregate = Σ hours / Σ capacity (not an average of percentages). */
export function utilizationOfGroup(state: S, emps: Employee[], from: ISODate, to: ISODate, opts: { includeSoft?: boolean } = {}): UtilizationResult {
  const acc = { theoretical: 0, assigned: 0, worked: 0, billable: 0 };
  for (const e of emps) {
    const u = utilizationOf(state, e, from, to, opts);
    acc.theoretical += u.theoretical;
    acc.assigned += u.assigned;
    acc.worked += u.worked;
    acc.billable += u.billable;
  }
  return { ...acc, planned: pct(acc.assigned, acc.theoretical), real: pct(acc.worked, acc.theoretical), billability: pct(acc.billable, acc.theoretical) };
}

export type UtilizationStatus = "UNDER" | "OK" | "OVER";
/** `underLimit` lets callers pass a grade-aware under-use limit (see underUseLimit); defaults to the global threshold. */
export function utilizationStatus(value: number, thresholds: Settings["thresholds"], underLimit?: number): UtilizationStatus {
  if (value > thresholds.overload) return "OVER";
  if (value < (underLimit ?? thresholds.underUse)) return "UNDER";
  return "OK";
}
/** Target for an employee: grade target, falling back to the department target. */
export function targetFor(settings: Settings, emp: Employee): number {
  return settings.utilizationTargets.byGrade[emp.gradeId] ?? settings.utilizationTargets.byDepartment[emp.departmentId] ?? 80;
}

/** Effective under-use limit of an employee: the global threshold, lowered for grades whose target is low
 *  (a Partner targeted at 30 % is not "under-used" at 25 %). limit = min(threshold, 75 % of the grade target). */
export function underUseLimit(settings: Settings, emp: Employee): number {
  return Math.min(settings.thresholds.underUse, targetFor(settings, emp) * 0.75);
}
export function statusOf(state: { settings: Settings }, emp: Employee, plannedPct: number): UtilizationStatus {
  return utilizationStatus(plannedPct, state.settings.thresholds, underUseLimit(state.settings, emp));
}
