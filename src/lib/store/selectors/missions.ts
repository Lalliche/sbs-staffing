import { projectCoverage, requirementCoverage, type Coverage } from "../../engine/booking";
import { validatedHours } from "../../engine/utilization";
import { plannedHoursFor } from "../../engine/capacity";
import type { AppState, Assignment, AuditLog, Employee, StaffingRequirement } from "../types";
import { canDo, visibleProjects, type ProjectView } from "./core";

export interface MissionRow {
  p: ProjectView;
  client: string;
  department: string;
  lead: string;
  cov: Coverage;
  assigned: number;
}
export function missionRows(s: AppState): MissionRow[] {
  return visibleProjects(s).map((p) => {
    const cov = projectCoverage(s, p.id);
    const lead = s.employees.find((e) => e.id === p.leadId);
    return {
      p,
      client: s.clients.find((c) => c.id === p.clientId)?.name ?? "—",
      department: s.departments.find((d) => d.id === p.departmentId)?.name ?? "—",
      lead: lead ? `${lead.firstName} ${lead.lastName}` : "—",
      cov,
      assigned: new Set(s.assignments.filter((a) => a.projectId === p.id && (a.status === "HARD" || a.status === "SOFT")).map((a) => a.employeeId)).size,
    };
  });
}
export type MissionView = "toutes" | "attente" | "cours" | "avenir" | "terminees" | "miennes";
export const MISSION_VIEWS: { value: MissionView; label: string }[] = [
  { value: "toutes", label: "Toutes" }, { value: "attente", label: "En attente de staffing" }, { value: "cours", label: "En cours" }, { value: "avenir", label: "À venir" }, { value: "terminees", label: "Terminées" }, { value: "miennes", label: "Mes missions" },
];
export function inMissionView(s: AppState, r: MissionRow, v: MissionView, myEmployeeId?: string | null): boolean {
  if (v === "toutes") return true;
  if (v === "attente") return r.p.status === "EN_ATTENTE_STAFFING";
  if (v === "cours") return r.p.status === "ACTIVE";
  if (v === "avenir") return r.p.status === "A_VENIR";
  if (v === "terminees") return r.p.status === "TERMINEE" || r.p.status === "ANNULEE";
  return !!myEmployeeId && (r.p.leadId === myEmployeeId || s.assignments.some((a) => a.projectId === r.p.id && a.employeeId === myEmployeeId && (a.status === "HARD" || a.status === "SOFT")));
}

export interface TeamRow {
  a: Assignment;
  emp: Employee;
  grade: string;
}
export function missionTeam(s: AppState, projectId: string): TeamRow[] {
  return s.assignments
    .filter((a) => a.projectId === projectId && (a.status === "HARD" || a.status === "SOFT" || a.status === "TERMINEE"))
    .map((a) => ({ a, emp: s.employees.find((e) => e.id === a.employeeId)!, grade: s.grades.find((g) => g.id === s.employees.find((e) => e.id === a.employeeId)?.gradeId)?.name ?? "" }))
    .filter((x) => x.emp)
    .sort((x, y) => (s.grades.find((g) => g.name === y.grade)?.rank ?? 0) - (s.grades.find((g) => g.name === x.grade)?.rank ?? 0));
}
export const requirementsOf = (s: AppState, projectId: string): { req: StaffingRequirement; cov: Coverage }[] => s.requirements.filter((r) => r.projectId === projectId).map((req) => ({ req, cov: requirementCoverage(s, req) }));

/** Validated hours per person on this mission (spec 8.3 « Timesheets »). */
export function missionTimesheets(s: AppState, projectId: string) {
  const byEmp = new Map<string, { hours: number; billable: number }>();
  const valid = new Map(s.timesheets.filter((t) => t.status === "VALIDE").map((t) => [t.id, t.employeeId]));
  for (const e of s.entries) {
    if (e.projectId !== projectId) continue;
    const emp = valid.get(e.timesheetId);
    if (!emp) continue;
    const cur = byEmp.get(emp) ?? { hours: 0, billable: 0 };
    cur.hours += e.hours;
    if (e.billable) cur.billable += e.hours;
    byEmp.set(emp, cur);
  }
  return [...byEmp.entries()].map(([employeeId, v]) => ({ employeeId, ...v })).sort((a, b) => b.hours - a.hours);
}
void validatedHours;

/** Budget & cost: only for viewers allowed to see both finance and employee costs. */
export function missionCosts(s: AppState, projectId: string) {
  if (!canDo(s, "project.finance.read", { projectId }) || !canDo(s, "employee.salary.read")) return undefined;
  const p = s.projects.find((x) => x.id === projectId);
  if (!p) return undefined;
  let planned = 0;
  let toDate = 0;
  for (const a of s.assignments) {
    if (a.projectId !== projectId || (a.status !== "HARD" && a.status !== "TERMINEE")) continue;
    const e = s.employees.find((x) => x.id === a.employeeId);
    if (!e) continue;
    const hours = plannedHoursFor(s, e, a.startDate, a.endDate, a.allocationPct);
    const upto = a.endDate < s.now ? a.endDate : s.now;
    const hNow = a.startDate > upto ? 0 : plannedHoursFor(s, e, a.startDate, upto, a.allocationPct);
    const perHour = e.dailyCost / (e.weeklyHours / 5);
    planned += hours * perHour;
    toDate += hNow * perHour;
  }
  return { budget: p.budget, resourceBudget: p.resourceBudget, plannedCost: Math.round(planned), costToDate: Math.round(toDate), margin: p.budget - Math.round(planned) };
}

export function missionHistory(s: AppState, projectId: string): AuditLog[] {
  const ids = new Set<string>([projectId, ...s.assignments.filter((a) => a.projectId === projectId).map((a) => a.id), ...s.requests.filter((r) => r.projectId === projectId).map((r) => r.id), ...s.requirements.filter((r) => r.projectId === projectId).map((r) => r.id)]);
  return s.audit.filter((a) => ids.has(a.entityId));
}
export const projectDocs = (s: AppState, projectId: string) => s.documents.filter((d) => d.entity === "PROJECT" && d.entityId === projectId);
