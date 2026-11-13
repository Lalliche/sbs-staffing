/* Assignment conflicts (spec 7.4). Pure: given a state and a candidate booking, list everything that clashes. */
import type { AppState, Assignment, ISODate } from "../store/types";
import { absenceDaySet, assignmentsOf, calendarOf, getEmployee, isWorkingDay, workingDays } from "./capacity";
import { eachDay, maxD, minD } from "./dates";
import { fmtRange } from "./format";

type S = Pick<AppState, "employees" | "offices" | "holidays" | "leaves" | "assignments" | "settings" | "projects">;

export type ConflictKind = "OVERALLOCATION" | "LEAVE" | "LEAVE_PENDING" | "CONTRACT" | "FULL_TIME" | "NO_WORKING_DAYS" | "INACTIVE";
export type ConflictSeverity = "ERROR" | "WARNING";
export interface Conflict {
  kind: ConflictKind;
  severity: ConflictSeverity;
  from: ISODate;
  to: ISODate;
  message: string;
  /** Peak total allocation for overlaps. */
  peakPct?: number;
  withAssignmentIds?: string[];
}
export interface BookingDraft {
  id?: string;
  employeeId: string;
  projectId: string;
  startDate: ISODate;
  endDate: ISODate;
  allocationPct: number;
  status: "SOFT" | "HARD";
  fullTime?: boolean;
}

export const OVERLOAD_EPS = 0.0001;

function group(days: ISODate[]): [ISODate, ISODate][] {
  const out: [ISODate, ISODate][] = [];
  let s: ISODate | null = null;
  let prev: ISODate | null = null;
  for (const d of days) {
    if (!s) {
      s = d;
      prev = d;
      continue;
    }
    const gap = (Date.parse(d) - Date.parse(prev!)) / 86_400_000;
    if (gap <= 3) prev = d; // weekends / holidays do not break a run
    else {
      out.push([s, prev!]);
      s = d;
      prev = d;
    }
  }
  if (s) out.push([s, prev!]);
  return out;
}

export function checkBooking(state: S, draft: BookingDraft): Conflict[] {
  const emp = getEmployee(state, draft.employeeId);
  if (!emp) return [];
  const out: Conflict[] = [];
  const { startDate: from, endDate: to } = draft;
  const cal = calendarOf(state, emp);

  // (inactive)
  if (emp.status === "ARCHIVE") out.push({ kind: "INACTIVE", severity: "ERROR", from, to, message: `${emp.firstName} ${emp.lastName} est archivé(e).` });

  // (b) contract dates
  if (from < emp.startDate || (emp.endDate && to > emp.endDate)) {
    const bad: [ISODate, ISODate] = from < emp.startDate ? [from, minD(to, emp.startDate)] : [maxD(from, emp.endDate!), to];
    out.push({ kind: "CONTRACT", severity: "ERROR", from: bad[0], to: bad[1], message: `Hors des dates de contrat (${fmtRange(emp.startDate, emp.endDate ?? "2099-12-31").replace(" → 31 déc. 2099", " → …")}).` });
  }

  // No working day at all
  const wd = workingDays(state, emp, from, to);
  if (wd.length === 0) out.push({ kind: "NO_WORKING_DAYS", severity: "ERROR", from, to, message: "Aucun jour travaillé sur la période (week-end, jours fériés ou hors contrat)." });

  // (c) approved leave: ERROR when it is a long absence or covers at least half of the booking, else WARNING.
  //     Pending leave is always a WARNING.
  for (const [statuses, kind] of [
    [["APPROUVEE"], "LEAVE"],
    [["SOUMISE"], "LEAVE_PENDING"],
  ] as const) {
    const abs = absenceDaySet(state, emp.id, from, to, [...statuses]);
    const days = wd.filter((d) => abs.has(d));
    for (const [a, b] of group(days)) {
      const n = days.filter((d) => d >= a && d <= b).length;
      const heavy = n >= state.settings.longAbsenceDays || (wd.length > 0 && n / wd.length >= 0.5);
      out.push({
        kind,
        severity: kind === "LEAVE" && heavy ? "ERROR" : "WARNING",
        from: a,
        to: b,
        message: kind === "LEAVE" ? `${heavy ? "Congé approuvé" : "Absence"} du ${fmtRange(a, b)} (${n} j).` : `Demande de congé en attente du ${fmtRange(a, b)} (${n} j).`,
      });
    }
  }

  // (d) part-time vs full-time mission
  if (draft.fullTime && emp.weeklyHours < state.settings.standardWeeklyHours) {
    out.push({ kind: "FULL_TIME", severity: "ERROR", from, to, message: `Mission à temps plein : ${emp.firstName} travaille ${emp.weeklyHours} h/semaine (temps partiel).` });
  }

  // (a) allocation over 100 % on any day
  const others = assignmentsOf(state, emp.id).filter((a) => a.id !== draft.id && a.endDate >= from && a.startDate <= to);
  const abs = absenceDaySet(state, emp.id, from, to);
  const hardDays: ISODate[] = [];
  const softDays: ISODate[] = [];
  let peakHard = 0;
  let peakSoft = 0;
  const withHard = new Set<string>();
  const withSoft = new Set<string>();
  for (const d of eachDay(from, to)) {
    if (!isWorkingDay(emp, cal, d) || abs.has(d)) continue;
    let hard = 0;
    let soft = 0;
    const ids: Assignment[] = [];
    for (const a of others) {
      if (a.startDate <= d && a.endDate >= d) {
        ids.push(a);
        if (a.status === "SOFT") soft += a.allocationPct;
        else hard += a.allocationPct;
      }
    }
    if (hard + draft.allocationPct > 100 + OVERLOAD_EPS) {
      hardDays.push(d);
      peakHard = Math.max(peakHard, hard + draft.allocationPct);
      ids.filter((a) => a.status !== "SOFT").forEach((a) => withHard.add(a.id));
    } else if (hard + soft + draft.allocationPct > 100 + OVERLOAD_EPS) {
      softDays.push(d);
      peakSoft = Math.max(peakSoft, hard + soft + draft.allocationPct);
      ids.filter((a) => a.status === "SOFT").forEach((a) => withSoft.add(a.id));
    }
  }
  for (const [a, b] of group(hardDays))
    out.push({ kind: "OVERALLOCATION", severity: "ERROR", from: a, to: b, peakPct: peakHard, withAssignmentIds: [...withHard], message: `Surcharge : ${Math.round(peakHard)} % de la capacité du ${fmtRange(a, b)}.` });
  for (const [a, b] of group(softDays))
    out.push({ kind: "OVERALLOCATION", severity: "WARNING", from: a, to: b, peakPct: peakSoft, withAssignmentIds: [...withSoft], message: `Réservation concurrente : ${Math.round(peakSoft)} % (soft) du ${fmtRange(a, b)}.` });
  return out;
}

export const hasBlockingConflict = (c: Conflict[]) => c.some((x) => x.severity === "ERROR");

export interface ExistingConflict extends Conflict {
  assignmentId: string;
  employeeId: string;
  projectId: string;
  /** An exception with a written reason was recorded on one of the assignments involved. */
  acknowledged: boolean;
}
/** Conflicts of the assignments already in the plan (planning markers, dashboard, alerts).
 *  Only the part of each assignment that is still ahead of the demo clock is checked, and a leave inside a long
 *  assignment is a conflict only when it is a long absence (settings.longAbsenceDays working days). */
export function findPlanConflicts(state: S & { now: ISODate }, opts: { employeeIds?: string[]; from?: ISODate; to?: ISODate } = {}): ExistingConflict[] {
  const out: ExistingConflict[] = [];
  const seenOverlap = new Set<string>();
  const floor = opts.from ?? state.now;
  for (const a of state.assignments) {
    if (a.status !== "HARD" && a.status !== "SOFT") continue;
    if (opts.employeeIds && !opts.employeeIds.includes(a.employeeId)) continue;
    if (a.endDate < floor) continue;
    if (opts.to && a.startDate > opts.to) continue;
    const emp = getEmployee(state, a.employeeId);
    const cs = checkBooking(state, { id: a.id, employeeId: a.employeeId, projectId: a.projectId, startDate: maxD(a.startDate, floor), endDate: a.endDate, allocationPct: a.allocationPct, status: a.status, fullTime: a.fullTime });
    for (const c of cs) {
      if (c.kind === "LEAVE_PENDING") {
        const days = emp ? workingDays(state, emp, c.from, c.to).length : 0;
        if (days < state.settings.longAbsenceDays) continue;
      }
      if (c.kind === "OVERALLOCATION") {
        const key = [a.id, ...(c.withAssignmentIds ?? [])].sort().join("|") + c.from;
        if (seenOverlap.has(key)) continue;
        seenOverlap.add(key);
      }
      if (c.severity === "ERROR" || c.kind === "LEAVE_PENDING") {
        const ids = [a.id, ...(c.withAssignmentIds ?? [])];
        const acknowledged = c.kind === "OVERALLOCATION" && state.assignments.some((x) => ids.includes(x.id) && !!x.exceptionReason);
        out.push({ ...c, assignmentId: a.id, employeeId: a.employeeId, projectId: a.projectId, acknowledged });
      }
    }
  }
  return out;
}
