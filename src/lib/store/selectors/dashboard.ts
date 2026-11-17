/* Dashboard selectors (spec 8.1). Every figure is computed from the engine; scope follows RBAC (`employee.view` scope). */
import { requirementCoverage, projectCoverage } from "../../engine/booking";
import { findPlanConflicts } from "../../engine/conflicts";
import { addDays, monthEnd, monthStart, quarterStart, weekStart, addMonths } from "../../engine/dates";
import { forecastByGrade } from "../../engine/forecast";
import { fmtDateShort } from "../../engine/format";
import { statusOf, utilizationOf, utilizationOfGroup } from "../../engine/utilization";
import type { AppState, Employee, ISODate, StaffingRequest } from "../types";
import { availabilityOf, type Availability } from "./people";
import { presenceSummary, presenceWeeks } from "./presence";
import { canDo, sessionUser } from "./core";

export type Period = "recent" | "next" | "month" | "quarter";
export const PERIOD_LABEL: Record<Period, string> = { recent: "4 dernières semaines", next: "4 prochaines semaines", month: "Mois en cours", quarter: "Trimestre en cours" };
export interface DashFilters {
  period: Period;
  dept?: string;
  office?: string;
  grade?: string;
  manager?: string;
  type?: string;
}
export const lastClosedWeekEnd = (s: AppState): ISODate => addDays(weekStart(s.now), -1);
export function periodRange(s: AppState, p: Period): { from: ISODate; to: ISODate } {
  const ws = weekStart(s.now);
  if (p === "recent") return { from: addDays(ws, -28), to: addDays(ws, -1) };
  if (p === "next") return { from: s.now, to: addDays(s.now, 27) };
  if (p === "month") return { from: monthStart(s.now), to: monthEnd(s.now) };
  return { from: quarterStart(s.now), to: monthEnd(addMonths(quarterStart(s.now), 2)) };
}
const OPEN: StaffingRequest["status"][] = ["SOUMISE", "EN_ANALYSE", "PROPOSITION_ENVOYEE", "EN_ATTENTE_VALIDATION", "APPROUVEE"];

export function scopedEmployees(s: AppState, f: Partial<DashFilters> = {}): Employee[] {
  return s.employees.filter((e) => e.status !== "ARCHIVE" && canDo(s, "employee.view", { employeeId: e.id }) && (!f.dept || e.departmentId === f.dept) && (!f.office || e.officeId === f.office) && (!f.grade || e.gradeId === f.grade) && (!f.manager || e.managerId === f.manager));
}
export interface Kpi {
  key: string;
  label: string;
  value: number;
  display: string;
  href?: string;
  hint?: string;
  tone?: "ok" | "alert" | "conflict" | "neutral";
  spark?: number[];
}
const pct = (n: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} %`;
const int = (n: number) => new Intl.NumberFormat("fr-FR").format(Math.round(n));

export function weeklyTrend(s: AppState, emps: Employee[], weeks = 8) {
  const out: { week: ISODate; label: string; planned: number }[] = [];
  const base = addDays(weekStart(s.now), -7 * weeks);
  for (let i = 0; i < weeks; i++) {
    const from = addDays(base, i * 7);
    const to = addDays(from, 6);
    out.push({ week: from, label: fmtDateShort(from), planned: utilizationOfGroup(s, emps, from, to).planned });
  }
  return out;
}

export function executive(s: AppState, f: DashFilters) {
  const emps = scopedEmployees(s, f);
  const { from, to } = periodRange(s, f.period);
  const grp = utilizationOfGroup(s, emps, from, to);
  const presence = presenceSummary(s, emps);
  const ahead = { from: s.now, to: addDays(s.now, 27) };
  const avail: Record<Availability, number> = { LIBRE: 0, PARTIELLE: 0, PLEINE: 0, SURCHARGEE: 0, INDISPONIBLE: 0 };
  let affectes = 0, under = 0, over = 0;
  const underIds: string[] = [], overIds: string[] = [];
  for (const e of emps) {
    avail[availabilityOf(s, e.id, ahead.from, ahead.to).status]++;
    if (s.assignments.some((a) => a.employeeId === e.id && a.status === "HARD" && a.startDate <= s.now && a.endDate >= s.now)) affectes++;
    const st = statusOf(s, e, utilizationOf(s, e, ahead.from, ahead.to).planned);
    if (st === "UNDER") { under++; underIds.push(e.id); }
    if (st === "OVER") { over++; overIds.push(e.id); }
  }
  const projects = s.projects.filter((p) => (!f.dept || p.departmentId === f.dept) && (!f.type || p.type === f.type) && canDo(s, "project.view", { projectId: p.id }));
  const requests = s.requests.filter((r) => OPEN.includes(r.status) && (!f.dept || s.projects.find((p) => p.id === r.projectId)?.departmentId === f.dept));
  const trend = weeklyTrend(s, emps);
  const kpis: Kpi[] = [
    { key: "actifs", label: "Collaborateurs actifs", value: emps.length, display: int(emps.length), href: "/app/collaborateurs?status=ACTIF" },
    { key: "dispo", label: "Disponibles (4 sem.)", value: avail.LIBRE + avail.PARTIELLE, display: int(avail.LIBRE + avail.PARTIELLE), href: "/app/collaborateurs?view=disponibles", hint: "Libres ou partiellement chargés" },
    { key: "affectes", label: "Affectés aujourd’hui", value: affectes, display: int(affectes), href: "/app/planning" },
    ...(presence.allowed ? [{ key: "onsite", label: "Sur site aujourd’hui", value: presence.onsite, display: int(presence.onsite), href: "/app/collaborateurs?presence=ONSITE", hint: `sur ${int(presence.total)} collaborateurs` } satisfies Kpi, { key: "remote", label: "À distance aujourd’hui", value: presence.remote, display: int(presence.remote), href: "/app/collaborateurs?presence=REMOTE", hint: presence.absent ? `${int(presence.absent)} absent(s)` : "Aucune absence" } satisfies Kpi] : []),
    { key: "actives", label: "Missions actives", value: projects.filter((p) => p.status === "ACTIVE").length, display: int(projects.filter((p) => p.status === "ACTIVE").length), href: "/app/missions?statut=ACTIVE" },
    { key: "avenir", label: "Missions à venir", value: projects.filter((p) => p.status === "A_VENIR").length, display: int(projects.filter((p) => p.status === "A_VENIR").length), href: "/app/missions?statut=A_VENIR" },
    { key: "attente", label: "En attente de staffing", value: projects.filter((p) => p.status === "EN_ATTENTE_STAFFING").length, display: int(projects.filter((p) => p.status === "EN_ATTENTE_STAFFING").length), href: "/app/missions?statut=EN_ATTENTE_STAFFING", tone: projects.some((p) => p.status === "EN_ATTENTE_STAFFING") ? "alert" : "neutral" },
    { key: "planned", label: "Utilisation planifiée", value: grp.planned, display: pct(grp.planned), hint: PERIOD_LABEL[f.period], spark: trend.map((t) => t.planned), href: "/app/analytics?rapport=utilisation-employe" },
    { key: "under", label: "Sous-occupés", value: under, display: int(under), tone: under ? "alert" : "ok", href: "/app/collaborateurs?view=sous-occupes", hint: "4 prochaines semaines" },
    { key: "over", label: "Surchargés", value: over, display: int(over), tone: over ? "conflict" : "ok", href: "/app/collaborateurs?view=surcharges", hint: "4 prochaines semaines" },
    { key: "open", label: "Demandes ouvertes", value: requests.length, display: int(requests.length), href: "/app/demandes" },
    { key: "urgent", label: "Demandes urgentes", value: requests.filter((r) => r.priority === "URGENTE").length, display: int(requests.filter((r) => r.priority === "URGENTE").length), tone: requests.some((r) => r.priority === "URGENTE") ? "conflict" : "ok", href: "/app/demandes?priorite=URGENTE" },
  ];
  const byGrade = s.grades.map((g) => ({ label: g.name, value: emps.filter((e) => e.gradeId === g.id).length }));
  const byDept = s.departments.map((d) => ({ label: d.name, value: emps.filter((e) => e.departmentId === d.id).length }));
  const workload = s.departments.map((d) => ({ label: d.name, value: Math.round(utilizationOfGroup(s, emps.filter((e) => e.departmentId === d.id), ahead.from, ahead.to).planned) }));
  const statuses: [string, string][] = [["EN_ATTENTE_STAFFING", "En attente de staffing"], ["A_VENIR", "À venir"], ["ACTIVE", "En cours"], ["TERMINEE", "Terminées"]];
  const missionsByStatus = statuses.map(([k, label]) => ({ label, value: projects.filter((p) => p.status === k).length }));
  const forecast = forecastByGrade(s, { from: s.now, horizonMonths: 3, departmentId: f.dept }).map((g) => ({ label: g.gradeName, supply: Math.round(g.supplyFte * 10) / 10, demand: Math.round(g.demandFte * 10) / 10, deficit: g.deficitPersons }));
  const availSlices = (["LIBRE", "PARTIELLE", "PLEINE", "SURCHARGEE", "INDISPONIBLE"] as Availability[]).map((k) => ({ label: { LIBRE: "Libre", PARTIELLE: "Partielle", PLEINE: "Pleine", SURCHARGEE: "Surchargée", INDISPONIBLE: "Indisponible" }[k], value: avail[k] })).filter((x) => x.value);
  return { kpis, trend, presence, byGrade, byDept, availSlices, workload, missionsByStatus, forecast, from, to, headcount: emps.length, underIds, overIds };
}

export const OPEN_REQUEST_STATUSES = OPEN;

export function unstaffedMissions(s: AppState) {
  return s.projects
    .filter((p) => p.status !== "TERMINEE" && p.status !== "ANNULEE" && canDo(s, "project.view", { projectId: p.id }))
    .map((p) => ({ project: p, cov: projectCoverage(s, p.id), reqs: s.requirements.filter((r) => r.projectId === p.id).map((r) => ({ req: r, cov: requirementCoverage(s, r) })).filter((x) => x.cov.missing > 0) }))
    .filter((x) => x.cov.missing > 0)
    .sort((a, b) => a.project.startDate.localeCompare(b.project.startDate));
}

export function resourceManager(s: AppState) {
  const queue = s.requests.filter((r) => OPEN.includes(r.status));
  const byStatus = ["SOUMISE", "EN_ANALYSE", "PROPOSITION_ENVOYEE", "EN_ATTENTE_VALIDATION"].map((k) => ({ status: k as StaffingRequest["status"], count: queue.filter((r) => r.status === k).length }));
  const conflicts = findPlanConflicts(s);
  const expiring = s.assignments.filter((a) => a.status === "SOFT" && a.softExpiresAt && a.softExpiresAt <= addDays(s.now, 7)).sort((a, b) => (a.softExpiresAt ?? "").localeCompare(b.softExpiresAt ?? ""));
  const emps = scopedEmployees(s);
  const presence = presenceSummary(s, emps);
  const ahead = { from: s.now, to: addDays(s.now, 27) };
  const rows = emps.map((e) => ({ e, planned: utilizationOf(s, e, ahead.from, ahead.to).planned })).map((x) => ({ ...x, st: statusOf(s, x.e, x.planned) }));
  return { queue, byStatus, urgent: queue.filter((r) => r.priority === "URGENTE"), conflicts, unstaffed: unstaffedMissions(s), expiring, presence, under: rows.filter((x) => x.st === "UNDER"), over: rows.filter((x) => x.st === "OVER") };
}

export function teamDashboard(s: AppState) {
  const emps = scopedEmployees(s).filter((e) => e.id !== sessionUser(s)?.employeeId);
  const weeks = [0, 1, 2, 3].map((i) => addDays(weekStart(s.now), i * 7));
  const rows = emps.map((e) => ({ e, weeks: weeks.map((w) => Math.round(utilizationOf(s, e, w, addDays(w, 6), { includeSoft: true }).planned)) }));
  const myId = sessionUser(s)?.employeeId;
  const myProjects = s.projects.filter((p) => (p.leadId === myId || canDo(s, "project.edit", { projectId: p.id })) && p.status !== "TERMINEE" && p.status !== "ANNULEE").map((p) => ({ project: p, cov: projectCoverage(s, p.id) }));
  return { rows, weeks, myProjects, presence: presenceSummary(s, emps) };
}

export function hrDashboard(s: AppState) {
  const limit = addDays(s.now, 30);
  const certs = s.employeeCertifications.filter((c) => c.expiresAt >= s.now && c.expiresAt <= limit).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const byContract = ["CDI", "CDD", "STAGE", "CONSULTANT"].map((c) => ({ label: c, value: s.employees.filter((e) => e.contract === c && e.status !== "ARCHIVE").length }));
  const ending = s.employees.filter((e) => e.endDate && e.status !== "ARCHIVE" && e.endDate <= addDays(s.now, 120)).sort((a, b) => (a.endDate ?? "").localeCompare(b.endDate ?? ""));
  return { certs, presence: presenceSummary(s, scopedEmployees(s)), archived: s.employees.filter((e) => e.status === "ARCHIVE").length, active: s.employees.filter((e) => e.status !== "ARCHIVE").length, byContract, ending, pendingValidation: s.employeeSkills.filter((x) => !x.validatedById).length };
}

export function myWeek(s: AppState) {
  const u = sessionUser(s);
  const empId = u?.employeeId;
  const ws = weekStart(s.now);
  const we = addDays(ws, 6);
  const mine = s.assignments.filter((a) => a.employeeId === empId && (a.status === "HARD" || a.status === "SOFT") && a.startDate <= we && a.endDate >= ws);
  const emp = s.employees.find((e) => e.id === empId);
  return {
    emp,
    week: { from: ws, to: we },
    assignments: mine,
    certs: s.employeeCertifications.filter((c) => c.employeeId === empId && c.expiresAt <= addDays(s.now, 60)),
    util: emp ? utilizationOf(s, emp, monthStart(s.now), monthEnd(s.now)) : undefined,
    presenceWeek: emp ? presenceWeeks(s, emp, 1)[0] ?? [] : [],
  };
}

export function adminDashboard(s: AppState) {
  const week = addDays(s.now, -7);
  return { users: s.users.length, activeUsers: s.users.filter((u) => u.status === "ACTIF").length, auditRecent: s.audit.filter((a) => a.ts >= week).length, auditTotal: s.audit.length, exceptions: s.audit.filter((a) => a.action === "assignment.exception"), recent: s.audit.slice(0, 8), emails: s.emailLog.length, perms: Object.values(s.rolePermissions).reduce((a, b) => a + b.length, 0) };
}
