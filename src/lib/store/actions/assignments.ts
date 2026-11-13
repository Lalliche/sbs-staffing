/* Assignments: create / soft-book / convert / move / resize / cancel / replace (spec 7.4, 7.5, 8.4).
   Engine decides; actions enforce RBAC, demand the written exception when the engine says so, audit and notify. */
import { evaluateBooking, conflictsForConversion } from "../../engine/booking";
import { plannedHoursFor } from "../../engine/capacity";
import { hasBlockingConflict, type Conflict } from "../../engine/conflicts";
import { addDays, diffDays, isValidDate } from "../../engine/dates";
import { fmtPct, fmtRange } from "../../engine/format";
import { nextId } from "../../engine/ids";
import type { BlockReason } from "../../engine/matching";
import { can } from "../../engine/permissions";
import type { AppState, Assignment } from "../types";
import { actorOf, audit, deny, empName, fail, notify, notifyHolders, ok, userOfEmployee, type Result } from "./core";
import { refreshStatuses } from "./time";

export interface BookingInput {
  employeeId: string;
  projectId: string;
  requirementId?: string;
  startDate: string;
  endDate: string;
  allocationPct: number;
  status: "SOFT" | "HARD";
  /** Written justification (≥ 10 characters) when the engine requires an exception. */
  exceptionReason?: string;
}
export const MIN_REASON = 10;

function validate(s: AppState, i: Pick<BookingInput, "employeeId" | "projectId" | "startDate" | "endDate" | "allocationPct">): Result<never> | null {
  if (!s.employees.some((e) => e.id === i.employeeId)) return fail("NOT_FOUND", "Collaborateur introuvable.");
  if (!s.projects.some((p) => p.id === i.projectId)) return fail("NOT_FOUND", "Mission introuvable.");
  if (!isValidDate(i.startDate) || !isValidDate(i.endDate) || i.startDate > i.endDate) return fail("INVALID", "Période invalide : la date de fin doit suivre la date de début.");
  if (!(i.allocationPct >= 5 && i.allocationPct <= 100)) return fail("INVALID", "L’allocation doit être comprise entre 5 % et 100 %.");
  return null;
}

/** Shared exception gate. Returns a failure when an exception is required and not (validly) provided. */
function exceptionGate(s: AppState, conflicts: Conflict[], blocks: BlockReason[], reason?: string): Result<never> | null {
  const needs = hasBlockingConflict(conflicts) || blocks.length > 0;
  if (!needs) return null;
  const summary = [...conflicts.filter((c) => c.severity === "ERROR").map((c) => c.message), ...blocks.map((b) => `${b.label} (${b.detail})`)].join(" · ");
  if (!reason || !reason.trim()) return fail("NEEDS_EXCEPTION", summary, { conflicts, blocks });
  const denied = deny(s, "assignment.exception");
  if (denied) return fail("FORBIDDEN", "Seul un profil habilité peut autoriser une exception.", { conflicts, blocks });
  if (reason.trim().length < MIN_REASON) return fail("INVALID", `La justification doit comporter au moins ${MIN_REASON} caractères.`, { conflicts, blocks });
  return null;
}

export function createAssignment(s: AppState, input: BookingInput): Result<Assignment> {
  const bad = validate(s, input);
  if (bad) return bad;
  const res = { projectId: input.projectId };
  const denied = input.status === "HARD" ? deny(s, "assignment.create", res) : can(s, actorOf(s), "assignment.create", res) ? null : deny(s, "assignment.softbook", res);
  if (denied) return denied;
  const dup = s.assignments.find((a) => a.employeeId === input.employeeId && a.projectId === input.projectId && (a.status === "HARD" || a.status === "SOFT") && a.startDate <= input.endDate && a.endDate >= input.startDate);
  if (dup) return fail("INVALID", `${empName(s, input.employeeId)} est déjà affecté(e) à cette mission sur une période qui se recoupe.`);
  const requirement = input.requirementId ? s.requirements.find((r) => r.id === input.requirementId && r.projectId === input.projectId) : undefined;
  if (input.requirementId && !requirement) return fail("INVALID", "Ce besoin n’appartient pas à la mission.");
  const evaluation = evaluateBooking(s, input, requirement);
  const gate = exceptionGate(s, evaluation.conflicts, evaluation.blocks, input.exceptionReason);
  if (gate) return gate;

  const emp = s.employees.find((e) => e.id === input.employeeId)!;
  const project = s.projects.find((p) => p.id === input.projectId)!;
  const usedException = evaluation.needsException;
  const a: Assignment = {
    id: nextId(s, "a"),
    employeeId: input.employeeId,
    projectId: input.projectId,
    requirementId: input.requirementId,
    startDate: input.startDate,
    endDate: input.endDate,
    allocationPct: input.allocationPct,
    plannedHours: plannedHoursFor(s, emp, input.startDate, input.endDate, input.allocationPct),
    status: input.status,
    validatedById: input.status === "HARD" ? s.session.userId ?? undefined : undefined,
    softExpiresAt: input.status === "SOFT" ? addDays(s.now, s.settings.softBookingExpiryDays) : undefined,
    exceptionReason: usedException ? input.exceptionReason!.trim() : undefined,
    createdAt: s.now,
    fullTime: requirement?.fullTime,
  };
  s.assignments.push(a);
  audit(s, {
    action: usedException ? "assignment.exception" : input.status === "HARD" ? "assignment.create" : "assignment.softbook",
    entity: "Affectation",
    entityId: a.id,
    label: `${empName(s, a.employeeId)} → ${project.name} (${fmtPct(a.allocationPct)}, ${input.status === "HARD" ? "confirmée" : "réservation"})`,
    after: { status: a.status, allocationPct: a.allocationPct, période: fmtRange(a.startDate, a.endDate) },
    reason: usedException ? input.exceptionReason!.trim() : undefined,
  });
  const u = userOfEmployee(s, a.employeeId);
  notify(s, u?.id, "ASSIGNMENT", input.status === "HARD" ? "Affectation confirmée" : "Réservation à votre nom", `${project.name} — ${fmtPct(a.allocationPct)}, ${fmtRange(a.startDate, a.endDate)}.`, `/app/missions/${project.id}`);
  if (project.leadId !== s.users.find((x) => x.id === s.session.userId)?.employeeId) notify(s, userOfEmployee(s, project.leadId)?.id, "MISSION", "Équipe de mission modifiée", `${empName(s, a.employeeId)} ${input.status === "HARD" ? "est affecté(e)" : "est réservé(e)"} sur « ${project.name} ».`, `/app/missions/${project.id}`);
  if (usedException) notifyHolders(s, "admin.audit", "CONFLICT", "Exception de planning accordée", `${empName(s, a.employeeId)} — ${project.name}.`, "/app/admin/audit");
  refreshStatuses(s);
  return ok(a, evaluation.conflicts.filter((c) => c.severity === "WARNING").map((c) => c.message));
}

export function createAssignments(s: AppState, inputs: BookingInput[]): Result<Assignment>[] {
  return inputs.map((i) => createAssignment(s, i));
}

export function convertToHard(s: AppState, id: string, exceptionReason?: string): Result<Assignment> {
  const a = s.assignments.find((x) => x.id === id);
  if (!a) return fail("NOT_FOUND", "Affectation introuvable.");
  if (a.status !== "SOFT") return fail("INVALID", "Seule une réservation (soft) peut être confirmée.");
  const denied = deny(s, "assignment.create", { projectId: a.projectId });
  if (denied) return denied;
  const conflicts = conflictsForConversion(s, a);
  const gate = exceptionGate(s, conflicts, [], exceptionReason);
  if (gate) return gate;
  const used = hasBlockingConflict(conflicts);
  a.status = "HARD";
  a.softExpiresAt = undefined;
  a.validatedById = s.session.userId ?? undefined;
  if (used) a.exceptionReason = exceptionReason!.trim();
  audit(s, { action: used ? "assignment.exception" : "assignment.convert", entity: "Affectation", entityId: a.id, label: `${empName(s, a.employeeId)} — réservation confirmée`, before: { status: "SOFT" }, after: { status: "HARD" }, reason: used ? exceptionReason!.trim() : undefined });
  notify(s, userOfEmployee(s, a.employeeId)?.id, "ASSIGNMENT", "Affectation confirmée", "Votre réservation a été confirmée.", `/app/missions/${a.projectId}`);
  refreshStatuses(s);
  return ok(a);
}

export interface AssignmentPatch {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  allocationPct?: number;
}
/** Drag (employee and/or dates), resize (dates) and inline % edit all end here. */
export function updateAssignment(s: AppState, id: string, patch: AssignmentPatch, exceptionReason?: string): Result<Assignment> {
  const a = s.assignments.find((x) => x.id === id);
  if (!a) return fail("NOT_FOUND", "Affectation introuvable.");
  if (a.status === "ANNULEE" || a.status === "TERMINEE") return fail("LOCKED", "Une affectation terminée ou annulée ne peut plus être modifiée.");
  const res = { projectId: a.projectId };
  const denied = can(s, actorOf(s), "assignment.edit", res) ? null : deny(s, "planning.edit", res);
  if (denied) return denied;
  const next = { employeeId: patch.employeeId ?? a.employeeId, projectId: a.projectId, startDate: patch.startDate ?? a.startDate, endDate: patch.endDate ?? a.endDate, allocationPct: patch.allocationPct ?? a.allocationPct };
  const bad = validate(s, next);
  if (bad) return bad;
  if (next.employeeId === a.employeeId && next.startDate === a.startDate && next.endDate === a.endDate && next.allocationPct === a.allocationPct) return ok(a);
  const requirement = a.requirementId ? s.requirements.find((r) => r.id === a.requirementId) : undefined;
  const evaluation = evaluateBooking(s, { ...next, id: a.id, status: a.status as "SOFT" | "HARD" }, requirement && next.employeeId !== a.employeeId ? requirement : undefined);
  const gate = exceptionGate(s, evaluation.conflicts, evaluation.blocks, exceptionReason);
  if (gate) return gate;
  const before = { employé: empName(s, a.employeeId), période: fmtRange(a.startDate, a.endDate), allocationPct: a.allocationPct };
  const prevEmployee = a.employeeId;
  Object.assign(a, next);
  const emp = s.employees.find((e) => e.id === a.employeeId)!;
  a.plannedHours = plannedHoursFor(s, emp, a.startDate, a.endDate, a.allocationPct);
  const used = evaluation.needsException;
  if (used) a.exceptionReason = exceptionReason!.trim();
  const moved = prevEmployee !== a.employeeId;
  audit(s, {
    action: used ? "assignment.exception" : moved ? "assignment.move" : "assignment.update",
    entity: "Affectation",
    entityId: a.id,
    label: `${empName(s, a.employeeId)} — ${s.projects.find((p) => p.id === a.projectId)?.name}`,
    before,
    after: { employé: empName(s, a.employeeId), période: fmtRange(a.startDate, a.endDate), allocationPct: a.allocationPct },
    reason: used ? exceptionReason!.trim() : undefined,
  });
  const project = s.projects.find((p) => p.id === a.projectId);
  notify(s, userOfEmployee(s, a.employeeId)?.id, "ASSIGNMENT", "Affectation modifiée", `${project?.name} — ${fmtPct(a.allocationPct)}, ${fmtRange(a.startDate, a.endDate)}.`, `/app/missions/${a.projectId}`);
  if (moved) notify(s, userOfEmployee(s, prevEmployee)?.id, "ASSIGNMENT", "Affectation retirée", `Vous n’êtes plus affecté(e) à « ${project?.name} ».`, "/app/planning");
  refreshStatuses(s);
  return ok(a, evaluation.conflicts.filter((c) => c.severity === "WARNING").map((c) => c.message));
}

/** Convenience used by the planning grid: move by whole days (keeps duration). */
export function shiftAssignment(s: AppState, id: string, days: number, toEmployeeId?: string, exceptionReason?: string): Result<Assignment> {
  const a = s.assignments.find((x) => x.id === id);
  if (!a) return fail("NOT_FOUND", "Affectation introuvable.");
  return updateAssignment(s, id, { startDate: addDays(a.startDate, days), endDate: addDays(a.endDate, days), employeeId: toEmployeeId }, exceptionReason);
}

export function cancelAssignment(s: AppState, id: string, reason?: string): Result<Assignment> {
  const a = s.assignments.find((x) => x.id === id);
  if (!a) return fail("NOT_FOUND", "Affectation introuvable.");
  if (a.status === "ANNULEE" || a.status === "TERMINEE") return fail("INVALID", "Cette affectation est déjà clôturée.");
  const denied = deny(s, "assignment.cancel", { projectId: a.projectId });
  if (denied) return denied;
  const before = a.status;
  a.status = "ANNULEE";
  audit(s, { action: "assignment.cancel", entity: "Affectation", entityId: a.id, label: `${empName(s, a.employeeId)} — ${s.projects.find((p) => p.id === a.projectId)?.name}`, before: { status: before }, after: { status: "ANNULEE" }, reason });
  notify(s, userOfEmployee(s, a.employeeId)?.id, "ASSIGNMENT", "Affectation annulée", `${s.projects.find((p) => p.id === a.projectId)?.name} — annulée.`, "/app/planning");
  refreshStatuses(s);
  const proj = s.projects.find((p) => p.id === a.projectId);
  if (proj) notifyHolders(s, "request.process", "UNSTAFFED", "Besoin de nouveau non couvert", `${proj.name} : ${empName(s, a.employeeId)} retiré(e).`, `/app/missions/${proj.id}`);
  return ok(a);
}

/** Propose a replacement: the new person takes the same slot, the old assignment is cancelled and linked. */
export function replaceAssignment(s: AppState, id: string, newEmployeeId: string, exceptionReason?: string): Result<Assignment> {
  const old = s.assignments.find((x) => x.id === id);
  if (!old) return fail("NOT_FOUND", "Affectation introuvable.");
  if (old.status !== "HARD" && old.status !== "SOFT") return fail("INVALID", "Seule une affectation active peut être remplacée.");
  if (old.employeeId === newEmployeeId) return fail("INVALID", "Choisissez un autre collaborateur.");
  const denied = deny(s, "assignment.create", { projectId: old.projectId });
  if (denied) return denied;
  const oldStatus = old.status as "SOFT" | "HARD";
  old.status = "ANNULEE"; // free the slot so the new booking is evaluated against the rest of the plan
  const created = createAssignment(s, { employeeId: newEmployeeId, projectId: old.projectId, requirementId: old.requirementId, startDate: old.startDate, endDate: old.endDate, allocationPct: old.allocationPct, status: oldStatus, exceptionReason });
  if (!created.ok) {
    old.status = oldStatus;
    return created;
  }
  created.value.replacedAssignmentId = old.id;
  audit(s, { action: "assignment.replace", entity: "Affectation", entityId: old.id, label: `${empName(s, old.employeeId)} remplacé(e) par ${empName(s, newEmployeeId)}`, before: { employé: empName(s, old.employeeId) }, after: { employé: empName(s, newEmployeeId) } });
  return created;
}

export { diffDays };
