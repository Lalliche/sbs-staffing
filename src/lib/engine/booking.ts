/* Assignments: evaluation, soft/hard rules, coverage (spec 7.4, 7.5). */
import type { AppState, Assignment, ISODate, StaffingRequirement } from "../store/types";
import { addDays } from "./dates";
import { checkBooking, hasBlockingConflict, type BookingDraft, type Conflict } from "./conflicts";
import { rankCandidates, requirementLike, scoreCandidate, type BlockReason } from "./matching";
import { plannedHoursFor, getEmployee } from "./capacity";

type S = Pick<AppState, "employees" | "offices" | "holidays" | "leaves" | "assignments" | "settings" | "projects" | "skills" | "grades" | "employeeSkills" | "certifications" | "employeeCertifications" | "requirements" | "now">;

export interface BookingEvaluation {
  conflicts: Conflict[];
  /** Matching blocks (only when the booking comes from a requirement). */
  blocks: BlockReason[];
  /** true → a habilitated user must authorise an exception with a written reason. */
  needsException: boolean;
}

export function evaluateBooking(state: S, draft: BookingDraft, requirement?: StaffingRequirement): BookingEvaluation {
  const conflicts = checkBooking(state, { ...draft, fullTime: draft.fullTime ?? requirement?.fullTime });
  let blocks: BlockReason[] = [];
  if (requirement) {
    const emp = getEmployee(state, draft.employeeId);
    const project = state.projects.find((p) => p.id === requirement.projectId);
    if (emp) blocks = scoreCandidate(state, emp, requirementLike(requirement, project)).blocking;
  }
  return { conflicts, blocks, needsException: hasBlockingConflict(conflicts) || blocks.length > 0 };
}

export const softExpiryDate = (now: ISODate, days: number): ISODate => addDays(now, days);
export const expiredSoftBookings = (state: Pick<AppState, "assignments" | "now">): Assignment[] =>
  state.assignments.filter((a) => a.status === "SOFT" && !!a.softExpiresAt && a.softExpiresAt < state.now);

/** SOFT → HARD: conflicts are re-checked against everything *except* the booking itself. */
export function conflictsForConversion(state: S, a: Assignment): Conflict[] {
  return checkBooking(state, { id: a.id, employeeId: a.employeeId, projectId: a.projectId, startDate: a.startDate, endDate: a.endDate, allocationPct: a.allocationPct, status: "HARD", fullTime: a.fullTime });
}

export interface Coverage {
  quantity: number;
  hard: number;
  soft: number;
  missing: number;
  /** hard / quantity, 0..1 — only HARD counts as staffed. */
  rate: number;
}
export function requirementCoverage(state: Pick<AppState, "assignments">, req: StaffingRequirement): Coverage {
  const linked = state.assignments.filter((a) => a.requirementId === req.id);
  const hard = new Set(linked.filter((a) => a.status === "HARD" || a.status === "TERMINEE").map((a) => a.employeeId)).size;
  const soft = new Set(linked.filter((a) => a.status === "SOFT").map((a) => a.employeeId)).size;
  const h = Math.min(hard, req.quantity);
  return { quantity: req.quantity, hard: h, soft, missing: Math.max(0, req.quantity - h), rate: req.quantity ? h / req.quantity : 1 };
}
export function projectCoverage(state: Pick<AppState, "assignments" | "requirements">, projectId: string): Coverage {
  const reqs = state.requirements.filter((r) => r.projectId === projectId);
  const agg = reqs.map((r) => requirementCoverage(state, r)).reduce((a, c) => ({ quantity: a.quantity + c.quantity, hard: a.hard + c.hard, soft: a.soft + c.soft, missing: a.missing + c.missing, rate: 0 }), { quantity: 0, hard: 0, soft: 0, missing: 0, rate: 0 });
  agg.rate = agg.quantity ? agg.hard / agg.quantity : 1;
  return agg;
}

export { plannedHoursFor, rankCandidates };
