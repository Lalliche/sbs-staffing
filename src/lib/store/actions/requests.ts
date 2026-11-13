/* Staffing requests (spec 8.8): state machine with RBAC, audit and notifications.
   BROUILLON → SOUMISE → EN_ANALYSE → PROPOSITION_ENVOYEE → EN_ATTENTE_VALIDATION → APPROUVEE → SATISFAITE
   SATISFAITE is reached automatically (refreshStatuses) once the requirement is covered by HARD bookings. */
import { fmtDate } from "../../engine/format";
import { isValidDate } from "../../engine/dates";
import { nextId } from "../../engine/ids";
import { can } from "../../engine/permissions";
import type { AppState, ISODate, Priority, RequestStatus, StaffingRequest } from "../types";
import { actorOf, audit, deny, fail, notify, notifyHolders, ok, userOfEmployee, type Result } from "./core";
import { PRIORITIES } from "./projects";
import { refreshStatuses } from "./time";

export const MIN_JUSTIFICATION = 10;
export const MIN_DECISION_REASON = 10;

export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  BROUILLON: ["SOUMISE", "ANNULEE"],
  SOUMISE: ["EN_ANALYSE", "REJETEE", "ANNULEE"],
  EN_ANALYSE: ["PROPOSITION_ENVOYEE", "REJETEE", "ANNULEE"],
  PROPOSITION_ENVOYEE: ["EN_ATTENTE_VALIDATION", "EN_ANALYSE", "REJETEE", "ANNULEE"],
  EN_ATTENTE_VALIDATION: ["APPROUVEE", "REJETEE", "EN_ANALYSE", "ANNULEE"],
  APPROUVEE: ["SATISFAITE", "ANNULEE"],
  REJETEE: [],
  ANNULEE: [],
  SATISFAITE: [],
};
export const FINAL_REQUEST: RequestStatus[] = ["REJETEE", "ANNULEE", "SATISFAITE"];
/** Transitions that must carry a written reason. */
const NEEDS_REASON = (from: RequestStatus, to: RequestStatus) => to === "REJETEE" || (to === "EN_ANALYSE" && from !== "SOUMISE");

export interface RequestInput {
  projectId: string;
  requirementId?: string;
  gradeId: string;
  quantity: number;
  skillIds: string[];
  startDate: ISODate;
  endDate: ISODate;
  allocationPct: number;
  estimatedLoad: number;
  priority: Priority;
  justification: string;
}

const myEmployeeId = (s: AppState) => actorOf(s)?.employeeId ?? null;
const isOwner = (s: AppState, r: StaffingRequest) => !!myEmployeeId(s) && r.requesterId === myEmployeeId(s);

/** Why the current actor cannot move `r` to `to` (null = allowed). Used by actions AND by the UI to show/hide buttons. */
export function requestTransitionDenied(s: AppState, r: StaffingRequest, to: RequestStatus): string | null {
  const u = actorOf(s);
  if (!u) return "Session expirée : reconnectez-vous.";
  if (!REQUEST_TRANSITIONS[r.status].includes(to)) return "Cette transition n’est pas possible depuis le statut actuel.";
  const res = { projectId: r.projectId };
  const process = can(s, u, "request.process", res);
  const approve = can(s, u, "request.approve", res);
  const owner = isOwner(s, r) && can(s, u, "request.create", res);
  const ok_ = (cond: boolean) => (cond ? null : "Votre profil n’autorise pas cette action.");
  switch (to) {
    case "SOUMISE":
      return ok_(owner);
    case "EN_ANALYSE":
      if (r.status === "SOUMISE") return ok_(process);
      return ok_(process || approve || (r.status === "PROPOSITION_ENVOYEE" && owner));
    case "PROPOSITION_ENVOYEE":
    case "EN_ATTENTE_VALIDATION":
      return ok_(process);
    case "APPROUVEE":
      return ok_(approve);
    case "REJETEE":
      return ok_(r.status === "EN_ATTENTE_VALIDATION" ? approve : process);
    case "ANNULEE":
      return ok_(owner || process);
    default:
      return "Cette transition est automatique.";
  }
}

export function nextRequestReference(s: Pick<AppState, "requests" | "now">): string {
  const max = s.requests.reduce((m, r) => Math.max(m, Number(r.reference.split("-").pop()) || 0), 0);
  return `DS-${s.now.slice(0, 4)}-${String(max + 1).padStart(3, "0")}`;
}

function validate(s: AppState, i: RequestInput, submitting: boolean): Result<never> | null {
  const project = s.projects.find((p) => p.id === i.projectId);
  if (!project) return fail("NOT_FOUND", "Mission introuvable.");
  if (project.status === "TERMINEE" || project.status === "ANNULEE") return fail("INVALID", "Cette mission est terminée ou annulée : aucune demande possible.");
  if (i.requirementId && !s.requirements.some((r) => r.id === i.requirementId && r.projectId === i.projectId)) return fail("INVALID", "Ce besoin n’appartient pas à la mission.");
  if (!s.grades.some((g) => g.id === i.gradeId)) return fail("INVALID", "Grade inconnu.");
  if (!Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 50) return fail("INVALID", "La quantité doit être un entier entre 1 et 50.");
  if (!isValidDate(i.startDate) || !isValidDate(i.endDate) || i.startDate > i.endDate) return fail("INVALID", "Période invalide : la date de fin doit suivre la date de début.");
  if (!(i.allocationPct >= 5 && i.allocationPct <= 100)) return fail("INVALID", "L’allocation doit être comprise entre 5 % et 100 %.");
  if (!(i.estimatedLoad > 0)) return fail("INVALID", "La charge estimée (jours-hommes) doit être strictement positive.");
  if (!PRIORITIES.includes(i.priority)) return fail("INVALID", "Priorité invalide.");
  if (i.skillIds.some((k) => !s.skills.some((x) => x.id === k))) return fail("INVALID", "Compétence inconnue.");
  if (submitting && i.justification.trim().length < MIN_JUSTIFICATION) return fail("INVALID", `La justification doit comporter au moins ${MIN_JUSTIFICATION} caractères.`);
  return null;
}

function pushHistory(s: AppState, r: StaffingRequest, status: RequestStatus, note?: string) {
  r.history.push({ ts: s.now, actorId: s.session.userId ?? "system", status, note });
}

function submitted(s: AppState, r: StaffingRequest) {
  const p = s.projects.find((x) => x.id === r.projectId);
  pushHistory(s, r, "SOUMISE");
  audit(s, { action: "request.submit", entity: "Demande", entityId: r.id, label: `${r.reference} — ${p?.name}`, before: { Statut: "BROUILLON" }, after: { Statut: "SOUMISE" } });
  notifyHolders(s, "request.process", "REQUEST", `Nouvelle demande de staffing ${r.reference}`, `${p?.name} — ${r.quantity} × ${s.grades.find((g) => g.id === r.gradeId)?.name}, dès le ${fmtDate(r.startDate)}.`, `/app/demandes/${r.id}`);
}

export function createRequest(s: AppState, input: RequestInput, opts: { submit?: boolean } = {}): Result<StaffingRequest> {
  const denied = deny(s, "request.create", { projectId: input.projectId });
  if (denied) return denied;
  const requesterId = myEmployeeId(s);
  if (!requesterId) return fail("FORBIDDEN", "Une demande doit être rattachée à un collaborateur : utilisez un profil Manager.");
  const bad = validate(s, input, !!opts.submit);
  if (bad) return bad;
  const r: StaffingRequest = {
    id: nextId(s, "rqs"),
    reference: nextRequestReference(s),
    projectId: input.projectId,
    requirementId: input.requirementId,
    requesterId,
    gradeId: input.gradeId,
    quantity: input.quantity,
    skillIds: [...new Set(input.skillIds)],
    startDate: input.startDate,
    endDate: input.endDate,
    allocationPct: input.allocationPct,
    estimatedLoad: input.estimatedLoad,
    priority: input.priority,
    justification: input.justification.trim(),
    status: "BROUILLON",
    proposedEmployeeIds: [],
    createdAt: s.now,
    comments: [],
    history: [],
  };
  s.requests.push(r);
  const p = s.projects.find((x) => x.id === r.projectId);
  audit(s, { action: "request.create", entity: "Demande", entityId: r.id, label: `${r.reference} — ${p?.name}`, after: { Statut: "BROUILLON", Quantité: r.quantity, Priorité: r.priority } });
  if (opts.submit) {
    r.status = "SOUMISE";
    submitted(s, r);
    refreshStatuses(s);
  }
  return ok(s.requests.find((x) => x.id === r.id)!);
}

export function updateRequest(s: AppState, id: string, patch: Partial<RequestInput>): Result<StaffingRequest> {
  const r = s.requests.find((x) => x.id === id);
  if (!r) return fail("NOT_FOUND", "Demande introuvable.");
  const denied = deny(s, "request.create", { projectId: r.projectId });
  if (denied) return denied;
  if (!isOwner(s, r)) return fail("FORBIDDEN", "Seul l’auteur de la demande peut la modifier.");
  if (r.status !== "BROUILLON") return fail("LOCKED", "Seule une demande en brouillon peut être modifiée.");
  const next: RequestInput = { ...r, ...patch };
  const bad = validate(s, next, false);
  if (bad) return bad;
  const before = { Grade: s.grades.find((g) => g.id === r.gradeId)?.name, Quantité: r.quantity, Début: r.startDate, Fin: r.endDate, Allocation: r.allocationPct, Priorité: r.priority, Charge: r.estimatedLoad };
  Object.assign(r, { ...next, skillIds: [...new Set(next.skillIds)], justification: next.justification.trim() });
  audit(s, { action: "request.update", entity: "Demande", entityId: r.id, label: r.reference, before, after: { Grade: s.grades.find((g) => g.id === r.gradeId)?.name, Quantité: r.quantity, Début: r.startDate, Fin: r.endDate, Allocation: r.allocationPct, Priorité: r.priority, Charge: r.estimatedLoad } });
  return ok(r);
}

function move(s: AppState, id: string, to: RequestStatus, opts: { reason?: string; note?: string; auditAction: string; title?: string; notifyRequester?: string; notifyApprovers?: string; notifyProcessor?: string }): Result<StaffingRequest> {
  const r = s.requests.find((x) => x.id === id);
  if (!r) return fail("NOT_FOUND", "Demande introuvable.");
  const why = requestTransitionDenied(s, r, to);
  if (why) return fail(REQUEST_TRANSITIONS[r.status].includes(to) ? "FORBIDDEN" : "INVALID", why);
  if (NEEDS_REASON(r.status, to) && (opts.reason ?? "").trim().length < MIN_DECISION_REASON) return fail("INVALID", `Un motif écrit d’au moins ${MIN_DECISION_REASON} caractères est obligatoire.`);
  const from = r.status;
  const p = s.projects.find((x) => x.id === r.projectId);
  r.status = to;
  if (to === "EN_ANALYSE" && from === "SOUMISE") r.handledById = s.session.userId ?? undefined;
  const note = (opts.reason ?? opts.note)?.trim() || undefined;
  pushHistory(s, r, to, note);
  audit(s, { action: opts.auditAction, entity: "Demande", entityId: r.id, label: `${r.reference} — ${p?.name}`, before: { Statut: from }, after: { Statut: to }, reason: opts.reason?.trim() });
  const requester = userOfEmployee(s, r.requesterId)?.id;
  const title = opts.title ?? `Demande ${r.reference}`;
  if (opts.notifyRequester) notify(s, requester, "REQUEST", title, opts.notifyRequester, `/app/demandes/${r.id}`);
  if (opts.notifyProcessor) {
    if (r.handledById) notify(s, r.handledById, "REQUEST", title, opts.notifyProcessor, `/app/demandes/${r.id}`);
    else notifyHolders(s, "request.process", "REQUEST", title, opts.notifyProcessor, `/app/demandes/${r.id}`);
  }
  if (opts.notifyApprovers) notifyHolders(s, "request.approve", "REQUEST", title, opts.notifyApprovers, `/app/demandes/${r.id}`);
  refreshStatuses(s);
  return ok(s.requests.find((x) => x.id === id)!);
}

export function submitRequest(s: AppState, id: string): Result<StaffingRequest> {
  const r = s.requests.find((x) => x.id === id);
  if (!r) return fail("NOT_FOUND", "Demande introuvable.");
  const why = requestTransitionDenied(s, r, "SOUMISE");
  if (why) return fail("FORBIDDEN", why);
  const bad = validate(s, r, true);
  if (bad) return bad;
  r.status = "SOUMISE";
  submitted(s, r);
  refreshStatuses(s);
  return ok(s.requests.find((x) => x.id === id)!);
}

export function cancelRequest(s: AppState, id: string, reason?: string): Result<StaffingRequest> {
  return move(s, id, "ANNULEE", { reason, auditAction: "request.cancel", title: "Demande annulée", notifyProcessor: "La demande a été annulée par son auteur.", notifyRequester: "Votre demande a été annulée." });
}
/** « Prendre en charge » — the Resource Manager picks the request up. */
export function takeRequest(s: AppState, id: string): Result<StaffingRequest> {
  return move(s, id, "EN_ANALYSE", { auditAction: "request.take", note: "Prise en charge.", title: "Demande prise en charge", notifyRequester: "Votre demande est en cours d’analyse par le Resource Manager." });
}
export function setProposedEmployees(s: AppState, id: string, employeeIds: string[]): Result<StaffingRequest> {
  const r = s.requests.find((x) => x.id === id);
  if (!r) return fail("NOT_FOUND", "Demande introuvable.");
  const denied = deny(s, "request.process", { projectId: r.projectId });
  if (denied) return denied;
  if (!["SOUMISE", "EN_ANALYSE", "PROPOSITION_ENVOYEE"].includes(r.status)) return fail("LOCKED", "Les candidats ne peuvent plus être modifiés à ce stade.");
  if (employeeIds.some((e) => !s.employees.some((x) => x.id === e && x.status !== "ARCHIVE"))) return fail("INVALID", "Collaborateur inconnu ou archivé.");
  const names = (ids: string[]) => ids.map((e) => s.employees.find((x) => x.id === e)).map((e) => (e ? `${e.firstName} ${e.lastName}` : "?"));
  const before = names(r.proposedEmployeeIds);
  r.proposedEmployeeIds = [...new Set(employeeIds)];
  audit(s, { action: "request.propose", entity: "Demande", entityId: r.id, label: `${r.reference} — candidats proposés`, before: { Candidats: before }, after: { Candidats: names(r.proposedEmployeeIds) } });
  return ok(r);
}
export function sendProposal(s: AppState, id: string, note?: string): Result<StaffingRequest> {
  const r = s.requests.find((x) => x.id === id);
  if (r && r.status === "EN_ANALYSE" && r.proposedEmployeeIds.length === 0) return fail("INVALID", "Sélectionnez au moins un candidat avant d’envoyer une proposition.");
  return move(s, id, "PROPOSITION_ENVOYEE", { note, auditAction: "request.proposal", title: "Proposition de staffing", notifyRequester: "Une proposition de candidats vous a été envoyée." });
}
export function sendToValidation(s: AppState, id: string, note?: string): Result<StaffingRequest> {
  return move(s, id, "EN_ATTENTE_VALIDATION", { note, auditAction: "request.validation", title: "Proposition à approuver", notifyApprovers: "Une proposition de staffing attend votre validation.", notifyRequester: "Votre demande est en attente de validation." });
}
export function approveRequest(s: AppState, id: string, note?: string): Result<StaffingRequest> {
  return move(s, id, "APPROUVEE", { note, auditAction: "request.approve", title: "Demande approuvée", notifyRequester: "La proposition a été approuvée.", notifyProcessor: "La proposition a été approuvée : vous pouvez confirmer les affectations." });
}
export function rejectRequest(s: AppState, id: string, reason: string): Result<StaffingRequest> {
  return move(s, id, "REJETEE", { reason, auditAction: "request.reject", title: "Demande rejetée", notifyRequester: `Votre demande a été rejetée : ${reason.trim()}`, notifyProcessor: `La demande a été rejetée : ${reason.trim()}` });
}
export function returnToAnalysis(s: AppState, id: string, reason: string): Result<StaffingRequest> {
  return move(s, id, "EN_ANALYSE", { reason, auditAction: "request.return", title: "Demande renvoyée en analyse", notifyProcessor: `Proposition renvoyée en analyse : ${reason.trim()}`, notifyRequester: "Votre demande est renvoyée en analyse." });
}

export function addRequestComment(s: AppState, id: string, text: string): Result<StaffingRequest> {
  const r = s.requests.find((x) => x.id === id);
  if (!r) return fail("NOT_FOUND", "Demande introuvable.");
  const u = actorOf(s);
  if (!u) return fail("FORBIDDEN", "Session expirée : reconnectez-vous.");
  const allowed = can(s, u, "request.process", { projectId: r.projectId }) || can(s, u, "request.approve", { projectId: r.projectId }) || isOwner(s, r);
  if (!allowed) return fail("FORBIDDEN", "Votre profil n’autorise pas cette action.");
  if (!text.trim()) return fail("INVALID", "Le commentaire est vide.");
  r.comments.push({ id: nextId(s, "cm"), authorId: u.id, ts: s.now, text: text.trim() });
  audit(s, { action: "request.comment", entity: "Demande", entityId: r.id, label: `${r.reference} — commentaire`, after: { Commentaire: text.trim().slice(0, 120) } });
  if (!isOwner(s, r)) notify(s, userOfEmployee(s, r.requesterId)?.id, "REQUEST", `Commentaire sur ${r.reference}`, text.trim().slice(0, 120), `/app/demandes/${r.id}`);
  else notifyHolders(s, "request.process", "REQUEST", `Commentaire sur ${r.reference}`, text.trim().slice(0, 120), `/app/demandes/${r.id}`);
  return ok(r);
}
