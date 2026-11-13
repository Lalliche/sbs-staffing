/* Leave workflow (spec 7.6): submit → manager notified → approve/refuse → availability recomputed (engine). */
import { impactedAssignments, leaveWorkingDays, overlappingLeaves, LEAVE_LABEL } from "../../engine/leave";
import { isValidDate } from "../../engine/dates";
import { fmtRange } from "../../engine/format";
import { nextId } from "../../engine/ids";
import { can } from "../../engine/permissions";
import type { AppState, LeaveRequest, LeaveType } from "../types";
import { actorOf, audit, deny, empName, fail, notify, notifyHolders, ok, userOfEmployee, type Result } from "./core";

export interface LeaveInput {
  employeeId?: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  comment?: string;
  asDraft?: boolean;
}

export function submitLeave(s: AppState, input: LeaveInput): Result<LeaveRequest> {
  const u = actorOf(s);
  const employeeId = input.employeeId ?? u?.employeeId ?? undefined;
  if (!employeeId) return fail("INVALID", "Aucun collaborateur associé à ce compte.");
  const onBehalf = employeeId !== u?.employeeId;
  const denied = onBehalf ? deny(s, "leave.approve", { employeeId }) : deny(s, "leave.request", { employeeId });
  if (denied) return denied;
  if (!isValidDate(input.startDate) || !isValidDate(input.endDate) || input.startDate > input.endDate) return fail("INVALID", "Période invalide : la date de fin doit suivre la date de début.");
  const draft = { id: "", employeeId, startDate: input.startDate, endDate: input.endDate };
  if (leaveWorkingDays(s, draft) === 0) return fail("INVALID", "Cette période ne contient aucun jour travaillé.");
  const overlap = overlappingLeaves(s, draft);
  if (overlap.length) return fail("INVALID", `Cette période chevauche une demande existante (${fmtRange(overlap[0].startDate, overlap[0].endDate)}).`);
  const leave: LeaveRequest = { id: nextId(s, "lv"), employeeId, type: input.type, startDate: input.startDate, endDate: input.endDate, status: input.asDraft ? "BROUILLON" : "SOUMISE", comment: input.comment, createdAt: s.now };
  s.leaves.push(leave);
  audit(s, { action: input.asDraft ? "leave.draft" : "leave.submit", entity: "Congé", entityId: leave.id, label: `${empName(s, employeeId)} — ${LEAVE_LABEL[input.type]} ${fmtRange(leave.startDate, leave.endDate)}`, after: { status: leave.status } });
  if (!input.asDraft) {
    const emp = s.employees.find((e) => e.id === employeeId);
    const approver = emp?.managerId ? userOfEmployee(s, emp.managerId) : undefined;
    const body = `${empName(s, employeeId)} — ${LEAVE_LABEL[input.type].toLowerCase()} du ${fmtRange(leave.startDate, leave.endDate)}.`;
    if (approver) notify(s, approver.id, "LEAVE", "Demande de congé à approuver", body, "/app/disponibilites");
    else notifyHolders(s, "leave.approve", "LEAVE", "Demande de congé à approuver", body, "/app/disponibilites");
  }
  return ok(leave);
}

export function submitDraftLeave(s: AppState, id: string): Result<LeaveRequest> {
  const l = s.leaves.find((x) => x.id === id);
  if (!l || l.status !== "BROUILLON") return fail("INVALID", "Seul un brouillon peut être soumis.");
  const denied = deny(s, "leave.request", { employeeId: l.employeeId });
  if (denied) return denied;
  l.status = "SOUMISE";
  audit(s, { action: "leave.submit", entity: "Congé", entityId: l.id, label: empName(s, l.employeeId), before: { status: "BROUILLON" }, after: { status: "SOUMISE" } });
  const mgr = s.employees.find((e) => e.id === l.employeeId)?.managerId;
  notify(s, mgr ? userOfEmployee(s, mgr)?.id : undefined, "LEAVE", "Demande de congé à approuver", `${empName(s, l.employeeId)} — du ${fmtRange(l.startDate, l.endDate)}.`, "/app/disponibilites");
  return ok(l);
}

export function decideLeave(s: AppState, id: string, decision: "APPROUVEE" | "REFUSEE", comment?: string): Result<LeaveRequest & { impactedAssignmentIds: string[] }> {
  const l = s.leaves.find((x) => x.id === id);
  if (!l) return fail("NOT_FOUND", "Demande introuvable.");
  if (l.status !== "SOUMISE") return fail("INVALID", "Cette demande n’est plus en attente.");
  const denied = deny(s, "leave.approve", { employeeId: l.employeeId });
  if (denied) return denied;
  if (decision === "REFUSEE" && !comment?.trim()) return fail("INVALID", "Indiquez un motif de refus.");
  const u = actorOf(s)!;
  l.status = decision;
  l.approverId = u.employeeId ?? u.id;
  if (comment?.trim()) l.comment = comment.trim();
  const label = `${empName(s, l.employeeId)} — ${LEAVE_LABEL[l.type]} ${fmtRange(l.startDate, l.endDate)}`;
  audit(s, { action: decision === "APPROUVEE" ? "leave.approve" : "leave.refuse", entity: "Congé", entityId: l.id, label, before: { status: "SOUMISE" }, after: { status: decision }, reason: decision === "REFUSEE" ? comment : undefined });
  notify(s, userOfEmployee(s, l.employeeId)?.id, "LEAVE", decision === "APPROUVEE" ? "Congé approuvé" : "Congé refusé", `${fmtRange(l.startDate, l.endDate)}${comment ? ` — ${comment}` : ""}`, "/app/disponibilites");
  const impacted = decision === "APPROUVEE" ? impactedAssignments(s, l) : [];
  if (impacted.length) {
    const names = [...new Set(impacted.map((a) => s.projects.find((p) => p.id === a.projectId)?.name))].join(", ");
    notifyHolders(s, "assignment.edit", "CONFLICT", `Conflit de planning — ${empName(s, l.employeeId)}`, `Congé approuvé (${fmtRange(l.startDate, l.endDate)}) pendant l’affectation : ${names}.`, "/app/planning");
  }
  return ok({ ...l, impactedAssignmentIds: impacted.map((a) => a.id) });
}

/** The owner withdraws a draft or pending request (the row is removed, the audit entry stays). */
export function withdrawLeave(s: AppState, id: string): Result {
  const l = s.leaves.find((x) => x.id === id);
  if (!l) return fail("NOT_FOUND", "Demande introuvable.");
  if (l.status !== "BROUILLON" && l.status !== "SOUMISE") return fail("LOCKED", "Une demande décidée ne peut plus être retirée.");
  const u = actorOf(s);
  if (!(u?.employeeId === l.employeeId || can(s, u, "leave.approve", { employeeId: l.employeeId }))) return fail("FORBIDDEN", "Votre profil n’autorise pas cette action.");
  s.leaves = s.leaves.filter((x) => x.id !== id);
  audit(s, { action: "leave.withdraw", entity: "Congé", entityId: id, label: `${empName(s, l.employeeId)} — ${fmtRange(l.startDate, l.endDate)}`, before: { status: l.status } });
  return ok(undefined);
}
