/* Leave workflow helpers (spec 7.6). The effect on availability comes from capacity.ts (absenceDaySet). */
import type { AppState, Assignment, LeaveRequest, LeaveType } from "../store/types";
import { calendarOf, getEmployee, workingDays } from "./capacity";
import { overlaps } from "./dates";

export const LEAVE_LABEL: Record<LeaveType, string> = {
  CONGE_ANNUEL: "Congé annuel",
  MALADIE: "Maladie",
  FORMATION: "Formation",
  DEPLACEMENT: "Déplacement",
  MISSION_INTERNE: "Mission interne",
  EXCEPTIONNEL: "Congé exceptionnel",
  TEMPS_PARTIEL: "Temps partiel",
};
export const ANNUAL_LEAVE_ALLOWANCE = 30;

type S = Pick<AppState, "employees" | "offices" | "holidays" | "leaves" | "assignments">;

/** Working days actually consumed by a leave (weekends/holidays excluded → counted once). */
export function leaveWorkingDays(state: S, leave: Pick<LeaveRequest, "employeeId" | "startDate" | "endDate">): number {
  const emp = getEmployee(state, leave.employeeId);
  return emp ? workingDays(state, emp, leave.startDate, leave.endDate).length : 0;
}
export function overlappingLeaves(state: S, leave: Pick<LeaveRequest, "id" | "employeeId" | "startDate" | "endDate">): LeaveRequest[] {
  return state.leaves.filter((l) => l.id !== leave.id && l.employeeId === leave.employeeId && (l.status === "APPROUVEE" || l.status === "SOUMISE") && overlaps(l.startDate, l.endDate, leave.startDate, leave.endDate));
}
/** Assignments that clash with a leave (shown to the approver before approval). */
export function impactedAssignments(state: S, leave: Pick<LeaveRequest, "employeeId" | "startDate" | "endDate">): Assignment[] {
  return state.assignments.filter((a) => a.employeeId === leave.employeeId && (a.status === "HARD" || a.status === "SOFT") && overlaps(a.startDate, a.endDate, leave.startDate, leave.endDate));
}
export function annualLeaveTaken(state: S, employeeId: string, year: number): number {
  let n = 0;
  for (const l of state.leaves) {
    if (l.employeeId !== employeeId || l.type !== "CONGE_ANNUEL" || l.status !== "APPROUVEE") continue;
    const s = l.startDate < `${year}-01-01` ? `${year}-01-01` : l.startDate;
    const e = l.endDate > `${year}-12-31` ? `${year}-12-31` : l.endDate;
    if (s <= e) n += leaveWorkingDays(state, { employeeId, startDate: s, endDate: e });
  }
  return n;
}
export { calendarOf };
