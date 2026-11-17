/* Utilization (spec 7.2): planned = confirmed assigned hours ÷ theoretical capacity. */
import type { AppState, Employee, ISODate, Settings } from "../store/types";
import { assignedHours, theoreticalHours } from "./capacity";

type S = Pick<AppState, "employees" | "offices" | "holidays" | "leaves" | "assignments">;

export interface UtilizationResult {
  theoretical: number;
  assigned: number;
  planned: number; // %
}
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

export function utilizationOf(state: S, emp: Employee, from: ISODate, to: ISODate, opts: { includeSoft?: boolean } = {}): UtilizationResult {
  const theoretical = theoreticalHours(state, emp, from, to);
  const assigned = assignedHours(state, emp, from, to, opts);
  return { theoretical, assigned, planned: pct(assigned, theoretical) };
}

/** Group aggregate = Σ hours / Σ capacity (not an average of percentages). */
export function utilizationOfGroup(state: S, emps: Employee[], from: ISODate, to: ISODate, opts: { includeSoft?: boolean } = {}): UtilizationResult {
  const acc = { theoretical: 0, assigned: 0 };
  for (const e of emps) {
    const u = utilizationOf(state, e, from, to, opts);
    acc.theoretical += u.theoretical;
    acc.assigned += u.assigned;
  }
  return { ...acc, planned: pct(acc.assigned, acc.theoretical) };
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
