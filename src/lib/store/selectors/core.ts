/* Core read layer. UI code reads people/missions ONLY through these selectors:
   sensitive fields (costs, rates, budgets) are absent for roles without the permission,
   and lists are limited to the viewer's scope (spec 3.3). Engine functions read raw state internally. */
import { can, type Resource } from "../../engine/permissions";
import type { MatchResult } from "../../engine/matching";
import type { AppState, Assignment, Employee, LeaveRequest, Project, StaffingRequest, User } from "../types";

export const sessionUser = (s: AppState): User | undefined => s.users.find((u) => u.id === s.session.userId && u.status === "ACTIF");
export const myEmployee = (s: AppState): Employee | undefined => {
  const u = sessionUser(s);
  return u?.employeeId ? s.employees.find((e) => e.id === u.employeeId) : undefined;
};
export const canDo = (s: AppState, perm: string, res?: Resource): boolean => can(s, sessionUser(s), perm, res);

/* ---------- employees ---------- */
export type EmployeeView = Omit<Employee, "dailyCost" | "dailyRate"> & { dailyCost?: number; dailyRate?: number };
export function employeeView(s: AppState, e: Employee): EmployeeView {
  if (canDo(s, "employee.salary.read", { employeeId: e.id })) return e;
  const { dailyCost: _c, dailyRate: _r, ...rest } = e;
  void _c;
  void _r;
  return rest;
}
/** Employees the viewer may open (scope-limited, sanitized). Archived people only on request. */
export function visibleEmployees(s: AppState, opts: { includeArchived?: boolean } = {}): EmployeeView[] {
  if (!canDo(s, "employee.view")) return [];
  return s.employees.filter((e) => (opts.includeArchived || e.status !== "ARCHIVE") && canDo(s, "employee.view", { employeeId: e.id })).map((e) => employeeView(s, e));
}
/** True when the viewer can only ever see their own employee record (a Collaborateur): the people list then makes no sense
 *  and the « Collaborateurs » section is shown as « Mon profil ». */
export function isSelfView(s: AppState): boolean {
  const u = sessionUser(s);
  if (!u?.employeeId) return false;
  return visibleEmployees(s, { includeArchived: true }).every((e) => e.id === u.employeeId);
}
export function employeeById(s: AppState, id: string): EmployeeView | undefined {
  const e = s.employees.find((x) => x.id === id);
  return e && canDo(s, "employee.view", { employeeId: id }) ? employeeView(s, e) : undefined;
}
/** Display name only — used for team lists, planning labels, notifications. Names are not sensitive. */
export const nameOf = (s: AppState, employeeId: string | null | undefined): string => {
  const e = s.employees.find((x) => x.id === employeeId);
  return e ? `${e.firstName} ${e.lastName}` : "—";
};
export const userName = (s: AppState, userIdOrEmployeeId: string | null | undefined): string => {
  const u = s.users.find((x) => x.id === userIdOrEmployeeId);
  if (u) return `${u.firstName} ${u.lastName}`;
  return nameOf(s, userIdOrEmployeeId);
};

/* ---------- projects ---------- */
export type ProjectView = Omit<Project, "budget" | "resourceBudget" | "estimatedDailyCost" | "dailySellPrice"> & { budget?: number; resourceBudget?: number; estimatedDailyCost?: number; dailySellPrice?: number };
export function projectView(s: AppState, p: Project): ProjectView {
  if (canDo(s, "project.finance.read", { projectId: p.id })) return p;
  const { budget: _b, resourceBudget: _r, estimatedDailyCost: _e, dailySellPrice: _d, ...rest } = p;
  void _b; void _r; void _e; void _d;
  return rest;
}
export function visibleProjects(s: AppState): ProjectView[] {
  if (!canDo(s, "project.view")) return [];
  return s.projects.filter((p) => canDo(s, "project.view", { projectId: p.id })).map((p) => projectView(s, p));
}
export function projectById(s: AppState, id: string): ProjectView | undefined {
  const p = s.projects.find((x) => x.id === id);
  return p && canDo(s, "project.view", { projectId: id }) ? projectView(s, p) : undefined;
}

/* ---------- assignments, leaves, requests ---------- */
export function visibleAssignments(s: AppState): Assignment[] {
  if (!canDo(s, "planning.view")) return [];
  return s.assignments.filter((a) => canDo(s, "planning.view", { employeeId: a.employeeId }) || canDo(s, "planning.view", { projectId: a.projectId }));
}
export function visibleLeaves(s: AppState): LeaveRequest[] {
  if (!canDo(s, "availability.view")) return [];
  return s.leaves.filter((l) => canDo(s, "availability.view", { employeeId: l.employeeId }));
}
export function visibleRequests(s: AppState): StaffingRequest[] {
  if (!canDo(s, "request.view")) return [];
  const me = sessionUser(s);
  return s.requests.filter((r) => canDo(s, "request.process") || r.requesterId === me?.employeeId || canDo(s, "request.view", { projectId: r.projectId }));
}

/* ---------- matching output ---------- */
export type MatchView = Omit<MatchResult, "estimatedCost"> & { estimatedCost?: number };
/** Cost is only shown to viewers who may see costs (spec 7.3). */
export function matchView(s: AppState, m: MatchResult): MatchView {
  if (canDo(s, "employee.salary.read")) return m;
  const { estimatedCost: _c, ...rest } = m;
  void _c;
  return rest;
}
