/* Timesheets (spec 7.7): states, locking, anomalies. */
import type { AppState, ISODate, Timesheet, TimesheetEntry, TimesheetStatus } from "../store/types";
import { absenceDaySet, assignmentsOf, calendarOf, getEmployee, isWorkingDay } from "./capacity";
import { addDays, eachDay, weekStart } from "./dates";

type S = Pick<AppState, "timesheets" | "entries" | "employees" | "offices" | "holidays" | "leaves" | "assignments" | "settings" | "projects">;

export const TS_LABEL: Record<TimesheetStatus, string> = { BROUILLON: "Brouillon", SOUMIS: "Soumis", VALIDE: "Validé", REJETE: "Rejeté", CORRECTION_DEMANDEE: "Correction demandée" };
export const INTERNAL_CODES: Record<string, string> = { "INT-FORM": "Formation interne", "INT-ADM": "Administratif", "INT-BD": "Développement commercial" };
export const isInternalCode = (id: string) => id.startsWith("INT-");

const TRANSITIONS: Record<TimesheetStatus, TimesheetStatus[]> = {
  BROUILLON: ["SOUMIS"],
  SOUMIS: ["VALIDE", "REJETE", "CORRECTION_DEMANDEE"],
  REJETE: ["SOUMIS"],
  CORRECTION_DEMANDEE: ["SOUMIS"],
  // A validated sheet is locked: the only exit is the traced correction procedure.
  VALIDE: ["CORRECTION_DEMANDEE"],
};
export const canTransition = (from: TimesheetStatus, to: TimesheetStatus) => TRANSITIONS[from].includes(to);
/** Entries may be edited only while the employee owns the sheet. */
export const isEditable = (t: Pick<Timesheet, "status">) => t.status === "BROUILLON" || t.status === "REJETE" || t.status === "CORRECTION_DEMANDEE";
export const isLocked = (t: Pick<Timesheet, "status">) => !isEditable(t);

export const entriesOf = (state: Pick<AppState, "entries">, timesheetId: string): TimesheetEntry[] => state.entries.filter((e) => e.timesheetId === timesheetId);
export const totalHours = (entries: TimesheetEntry[]) => entries.reduce((s, e) => s + e.hours, 0);
export const billableHours = (entries: TimesheetEntry[]) => entries.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
export const sheetWeek = (d: ISODate) => weekStart(d);

export type AnomalyKind = "DAILY_MAX" | "WEEKLY_MAX" | "ON_LEAVE" | "NOT_ASSIGNED" | "NON_WORKING_DAY" | "EMPTY";
export interface Anomaly {
  kind: AnomalyKind;
  severity: "ALERT" | "INFO";
  date?: ISODate;
  projectId?: string;
  message: string;
}

export function anomalies(state: S, ts: Timesheet): Anomaly[] {
  const emp = getEmployee(state, ts.employeeId);
  if (!emp) return [];
  const entries = entriesOf(state, ts.id);
  const out: Anomaly[] = [];
  const cal = calendarOf(state, emp);
  const wEnd = addDays(ts.weekStart, 6);
  const leave = absenceDaySet(state, emp.id, ts.weekStart, wEnd);
  const total = totalHours(entries);
  if (!entries.length) out.push({ kind: "EMPTY", severity: "INFO", message: "Aucune heure saisie cette semaine." });
  if (total > state.settings.maxWeeklyHours) out.push({ kind: "WEEKLY_MAX", severity: "ALERT", message: `${total} h saisies : au-delà du maximum hebdomadaire (${state.settings.maxWeeklyHours} h).` });
  const byDay = new Map<ISODate, number>();
  for (const e of entries) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.hours);
  for (const [d, h] of byDay) {
    if (h > state.settings.maxDailyHours) out.push({ kind: "DAILY_MAX", severity: "ALERT", date: d, message: `${h} h le ${d} : au-delà du maximum quotidien (${state.settings.maxDailyHours} h).` });
    if (leave.has(d)) out.push({ kind: "ON_LEAVE", severity: "ALERT", date: d, message: `Heures saisies un jour de congé approuvé (${d}).` });
    else if (!isWorkingDay(emp, cal, d) && h > 0) out.push({ kind: "NON_WORKING_DAY", severity: "INFO", date: d, message: `Heures saisies un jour non travaillé (${d}).` });
  }
  const mine = assignmentsOf(state, emp.id);
  const seen = new Set<string>();
  for (const e of entries) {
    if (isInternalCode(e.projectId) || seen.has(e.projectId)) continue;
    const ok = mine.some((a) => a.projectId === e.projectId && a.startDate <= wEnd && a.endDate >= ts.weekStart);
    if (!ok) {
      seen.add(e.projectId);
      out.push({ kind: "NOT_ASSIGNED", severity: "ALERT", projectId: e.projectId, message: `Heures sur une mission sans affectation cette semaine.` });
    }
  }
  return out;
}

/** Days of the week as the timesheet grid shows them (all 7, working ones flagged). */
export const weekDays = (weekStartDate: ISODate) => eachDay(weekStartDate, addDays(weekStartDate, 6));
