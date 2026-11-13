/* Planning grid selectors: rows, lanes, heat cells, markers. All load maths comes from the engine. */
import { averageLoadPct, peakLoadPct } from "../../engine/capacity";
import { findPlanConflicts } from "../../engine/conflicts";
import { requirementCoverage } from "../../engine/booking";
import { addDays, addMonths, diffDays, monthStart, quarterStart, weekStart } from "../../engine/dates";
import type { AppState, Assignment, Employee, ISODate, LeaveRequest, StaffingRequirement } from "../types";
import { visibleAssignments, visibleLeaves } from "./core";
import { canDo } from "./core";

export type Lens = "personnes" | "missions" | "departements";
export type View = "jour" | "semaine" | "mois" | "trimestre";
export const VIEW_LABEL: Record<View, string> = { jour: "Jour", semaine: "Semaine", mois: "Mois", trimestre: "Trimestre" };
/** em per day, number of days shown, snap in days (design-system §5). */
export const ZOOM: Record<View, { ppd: number; days: number; snap: number; step: number }> = {
  jour: { ppd: 2.5, days: 28, snap: 1, step: 7 },
  semaine: { ppd: 6 / 7, days: 84, snap: 1, step: 28 },
  mois: { ppd: 8 / 30.4, days: 182, snap: 7, step: 91 },
  trimestre: { ppd: 12 / 91, days: 365, snap: 7, step: 182 },
};
export function defaultStart(s: AppState, v: View): ISODate {
  if (v === "mois") return monthStart(s.now);
  if (v === "trimestre") return quarterStart(s.now);
  return weekStart(s.now);
}
export function shiftStart(start: ISODate, v: View, dir: -1 | 1): ISODate {
  if (v === "mois") return addMonths(start, dir * 3);
  if (v === "trimestre") return addMonths(start, dir * 6);
  return addDays(start, dir * ZOOM[v].step);
}
export interface Tick { date: ISODate; label: string; major: boolean; x: number }
export function ticks(start: ISODate, v: View): { top: { label: string; x: number; w: number }[]; bottom: Tick[]; end: ISODate } {
  const { ppd, days } = ZOOM[v];
  const end = addDays(start, days - 1);
  const bottom: Tick[] = [];
  const top: { label: string; x: number; w: number }[] = [];
  const mo = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  const sd = new Intl.DateTimeFormat("fr-FR", { weekday: "narrow", day: "numeric", timeZone: "UTC" });
  const sm = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
  let curMonth = "";
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    const x = i * ppd;
    const mk = d.slice(0, 7);
    if (mk !== curMonth) { curMonth = mk; top.push({ label: mo.format(new Date(`${d}T00:00:00Z`)), x, w: 0 }); }
    top[top.length - 1].w = x + ppd - top[top.length - 1].x;
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
    if (v === "jour") bottom.push({ date: d, label: sd.format(new Date(`${d}T00:00:00Z`)), major: dow === 0, x });
    else if (v === "semaine" && dow === 0) bottom.push({ date: d, label: `S${Math.floor(diffDays(weekStart(`${d.slice(0, 4)}-01-04`), d) / 7) + 1}`, major: true, x });
    else if (v === "mois" && d.endsWith("-01")) bottom.push({ date: d, label: sm.format(new Date(`${d}T00:00:00Z`)).replace(".", ""), major: true, x });
    else if (v === "trimestre" && d.endsWith("-01") && ["01", "04", "07", "10"].includes(d.slice(5, 7))) bottom.push({ date: d, label: `T${Math.ceil(Number(d.slice(5, 7)) / 3)}`, major: true, x });
  }
  return { top, bottom, end };
}

export interface Lane { a: Assignment; lane: number }
export function lanesFor(list: Assignment[]): { lanes: Lane[]; count: number } {
  const sorted = [...list].sort((x, y) => x.startDate.localeCompare(y.startDate));
  const ends: ISODate[] = [];
  const lanes: Lane[] = sorted.map((a) => {
    let i = ends.findIndex((e) => e < a.startDate);
    if (i < 0) { i = ends.length; ends.push(a.endDate); } else ends[i] = a.endDate;
    return { a, lane: i };
  });
  return { lanes, count: Math.max(1, ends.length) };
}

export interface PlanFilters { dept?: string; grade?: string; office?: string; mission?: string; q?: string; employee?: string }
export interface PlanRow {
  key: string;
  kind: "person" | "mission" | "placeholder" | "group";
  label: string;
  sub?: string;
  employee?: Employee;
  projectId?: string;
  requirement?: StaffingRequirement;
  groupId?: string;
  summary?: { avg: number; over: number; count: number };
  lanes: Lane[];
  laneCount: number;
  leaves: LeaveRequest[];
  deptId?: string;
}

export function planningRows(s: AppState, lens: Lens, f: PlanFilters): PlanRow[] {
  const asg = visibleAssignments(s).filter((a) => a.status === "HARD" || a.status === "SOFT");
  const leaves = visibleLeaves(s).filter((l) => l.status === "APPROUVEE");
  const q = (f.q ?? "").toLowerCase();
  const emps = s.employees
    .filter((e) => e.status !== "ARCHIVE" && canDo(s, "planning.view", { employeeId: e.id }) && (!f.dept || e.departmentId === f.dept) && (!f.grade || e.gradeId === f.grade) && (!f.office || e.officeId === f.office) && (!f.employee || e.id === f.employee) && (!q || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q)))
    .sort((a, b) => a.departmentId.localeCompare(b.departmentId) || (s.grades.find((g) => g.id === b.gradeId)?.rank ?? 0) - (s.grades.find((g) => g.id === a.gradeId)?.rank ?? 0) || a.lastName.localeCompare(b.lastName));
  if (lens === "missions") {
    const rows: PlanRow[] = [];
    for (const p of s.projects.filter((x) => x.status !== "TERMINEE" && x.status !== "ANNULEE" && (!f.mission || x.id === f.mission) && (!f.dept || x.departmentId === f.dept) && canDo(s, "project.view", { projectId: x.id }))) {
      const list = asg.filter((a) => a.projectId === p.id && (!f.employee || a.employeeId === f.employee));
      if (!list.length && f.employee) continue;
      const { lanes, count } = lanesFor(list);
      rows.push({ key: `m-${p.id}`, kind: "mission", label: p.name, sub: p.reference, projectId: p.id, lanes, laneCount: count, leaves: [], deptId: p.departmentId });
      for (const r of s.requirements.filter((x) => x.projectId === p.id)) {
        const cov = requirementCoverage(s, r);
        if (cov.missing > 0) rows.push({ key: `ph-${r.id}`, kind: "placeholder", label: `Besoin non couvert : ${cov.missing} × ${s.grades.find((g) => g.id === r.gradeMin)?.name}`, sub: `${r.allocationPct} % · ${p.name}`, projectId: p.id, requirement: r, lanes: [], laneCount: 1, leaves: [], deptId: p.departmentId });
      }
    }
    return rows;
  }
  const rows: PlanRow[] = [];
  let lastDept = "";
  for (const e of emps) {
    if (lens === "departements" && e.departmentId !== lastDept) {
      lastDept = e.departmentId;
      const members = emps.filter((x) => x.departmentId === e.departmentId);
      rows.push({ key: `g-${e.departmentId}`, kind: "group", label: s.departments.find((d) => d.id === e.departmentId)?.name ?? "", groupId: e.departmentId, lanes: [], laneCount: 1, leaves: [], deptId: e.departmentId, sub: `${members.length} collaborateurs` });
    }
    const list = asg.filter((a) => a.employeeId === e.id && (!f.mission || a.projectId === f.mission));
    const { lanes, count } = lanesFor(list);
    rows.push({ key: `p-${e.id}`, kind: "person", label: `${e.firstName} ${e.lastName}`, sub: s.grades.find((g) => g.id === e.gradeId)?.name, employee: e, lanes, laneCount: count, leaves: leaves.filter((l) => l.employeeId === e.id), deptId: e.departmentId });
  }
  return rows;
}

export function groupSummary(s: AppState, deptId: string, from: ISODate, to: ISODate, includeSoft: boolean) {
  const members = s.employees.filter((e) => e.departmentId === deptId && e.status !== "ARCHIVE" && canDo(s, "planning.view", { employeeId: e.id }));
  const loads = members.map((e) => averageLoadPct(s, e, from, to, includeSoft));
  return { avg: loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : 0, over: loads.filter((l) => l > s.settings.thresholds.overload).length, count: members.length };
}

export function conflictIds(s: AppState): Set<string> {
  const ids = new Set<string>();
  for (const c of findPlanConflicts(s)) {
    if (c.severity !== "ERROR") continue;
    ids.add(c.assignmentId);
    (c.withAssignmentIds ?? []).forEach((i) => ids.add(i));
  }
  return ids;
}

export type HeatState = "free" | "part" | "full" | "over" | "absent";
export interface HeatCell { x: number; w: number; pct: number; state: HeatState; from: ISODate; to: ISODate }
export function heatState(pct: number, over: number): Exclude<HeatState, "absent"> {
  if (pct > over) return "over";
  if (pct >= 85) return "full";
  if (pct >= 50) return "part";
  return "free";
}
export function heatCells(s: AppState, e: Employee, start: ISODate, v: View, includeSoft: boolean): HeatCell[] {
  const { ppd, days } = ZOOM[v];
  const stepDays = v === "jour" ? 1 : v === "semaine" ? 7 : v === "mois" ? 30 : 91;
  const out: HeatCell[] = [];
  for (let i = 0; i < days; i += stepDays) {
    const from = addDays(start, i);
    const to = addDays(from, Math.min(stepDays, days - i) - 1);
    const pct = v === "jour" ? peakLoadPct(s, e, from, to, includeSoft) : averageLoadPct(s, e, from, to, includeSoft);
    out.push({ x: i * ppd, w: Math.min(stepDays, days - i) * ppd, pct, state: heatState(pct, s.settings.thresholds.overload), from, to });
  }
  return out;
}
