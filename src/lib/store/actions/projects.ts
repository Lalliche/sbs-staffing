/* Missions & staffing requirements: create / edit / status / requirements / documents (spec 8.3).
   Every write: permission gate → validation → mutation → audit (before/after) → notification. */
import { projectCoverage } from "../../engine/booking";
import { isValidDate } from "../../engine/dates";
import { fmtDate, fmtInt } from "../../engine/format";
import { nextId } from "../../engine/ids";
import { invalidate } from "../../engine/memo";
import { can } from "../../engine/permissions";
import type { AppState, Certainty, DocumentMeta, ISODate, Milestone, Priority, Project, ProjectPhase, ProjectStatus, StaffingRequirement } from "../types";
import { actorOf, audit, deny, empName, fail, notify, notifyHolders, ok, userOfEmployee, type Result } from "./core";
import { refreshStatuses } from "./time";

export const MIN_CANCEL_REASON = 10;
export const PRIORITIES: Priority[] = ["BASSE", "NORMALE", "HAUTE", "URGENTE"];
export const CERTAINTIES: Certainty[] = ["CONFIRMEE", "PROBABLE", "OPPORTUNITE"];
const FINAL: ProjectStatus[] = ["TERMINEE", "ANNULEE"];

export interface RequirementInput {
  gradeMin: string;
  quantity: number;
  mandatorySkillIds: string[];
  desiredSkillIds: string[];
  minExperienceYears: number;
  startDate: ISODate;
  endDate: ISODate;
  allocationPct: number;
  priority: Priority;
  fullTime?: boolean;
}
export interface PhaseInput {
  name: string;
  startDate: ISODate;
  endDate: ISODate;
}
export interface MilestoneInput {
  name: string;
  date: ISODate;
}
export interface FinanceInput {
  budget: number;
  resourceBudget: number;
  estimatedDailyCost: number;
  dailySellPrice?: number;
}
export interface ProjectInput {
  name: string;
  clientId: string;
  departmentId: string;
  leadId: string;
  type: string;
  priority: Priority;
  sector: string;
  reference: string;
  otp: string;
  description?: string;
  certainty?: Certainty;
  startDate: ISODate;
  endDate: ISODate;
  estimatedDays: number;
  phases?: PhaseInput[];
  milestones?: MilestoneInput[];
  /** Finance fields: only accepted from a viewer holding `project.finance.read`. */
  finance?: FinanceInput;
  requirements?: RequirementInput[];
}
export type ProjectPatch = Partial<Omit<ProjectInput, "requirements" | "finance">> & { finance?: Partial<FinanceInput> };

const norm = (v: string) => v.trim().toLowerCase();
export const referenceTaken = (s: Pick<AppState, "projects">, reference: string, exceptId?: string) => s.projects.some((p) => p.id !== exceptId && norm(p.reference) === norm(reference));
export const otpTaken = (s: Pick<AppState, "projects">, otp: string, exceptId?: string) => s.projects.some((p) => p.id !== exceptId && norm(p.otp) === norm(otp));

function freshId(s: AppState, prefix: string): string {
  let id = nextId(s, prefix);
  const used = (x: string) => s.projects.some((p) => p.id === x) || s.requirements.some((r) => r.id === x) || s.documents.some((d) => d.id === x);
  while (used(id)) id = nextId(s, prefix);
  return id;
}

/** Validation of one requirement row against its mission period. Returns a French message or null. */
export function validateRequirement(s: Pick<AppState, "grades" | "skills">, r: RequirementInput, period: { startDate: ISODate; endDate: ISODate }): string | null {
  if (!s.grades.some((g) => g.id === r.gradeMin)) return "Grade minimum inconnu.";
  if (!Number.isInteger(r.quantity) || r.quantity < 1 || r.quantity > 50) return "La quantité doit être un entier entre 1 et 50.";
  if (!(r.allocationPct >= 5 && r.allocationPct <= 100)) return "L’allocation doit être comprise entre 5 % et 100 %.";
  if (!(r.minExperienceYears >= 0 && r.minExperienceYears <= 40)) return "L’expérience minimale doit être comprise entre 0 et 40 ans.";
  if (!isValidDate(r.startDate) || !isValidDate(r.endDate) || r.startDate > r.endDate) return "Période du besoin invalide : la fin doit suivre le début.";
  if (r.startDate < period.startDate || r.endDate > period.endDate) return "Les dates du besoin doivent rester dans la période de la mission.";
  const known = new Set(s.skills.map((k) => k.id));
  if ([...r.mandatorySkillIds, ...r.desiredSkillIds].some((k) => !known.has(k))) return "Compétence inconnue.";
  if (r.mandatorySkillIds.some((k) => r.desiredSkillIds.includes(k))) return "Une compétence ne peut pas être à la fois obligatoire et souhaitée.";
  if (!PRIORITIES.includes(r.priority)) return "Priorité invalide.";
  return null;
}

function validateStructure(phases: PhaseInput[], milestones: MilestoneInput[], period: { startDate: ISODate; endDate: ISODate }): string | null {
  for (const ph of phases) {
    if (!ph.name.trim()) return "Chaque phase doit porter un nom.";
    if (!isValidDate(ph.startDate) || !isValidDate(ph.endDate) || ph.startDate > ph.endDate) return `Phase « ${ph.name} » : période invalide.`;
    if (ph.startDate < period.startDate || ph.endDate > period.endDate) return `Phase « ${ph.name} » : hors de la période de la mission.`;
  }
  for (const m of milestones) {
    if (!m.name.trim()) return "Chaque jalon doit porter un nom.";
    if (!isValidDate(m.date)) return `Jalon « ${m.name} » : date invalide.`;
    if (m.date < period.startDate || m.date > period.endDate) return `Jalon « ${m.name} » : hors de la période de la mission.`;
  }
  return null;
}

function validateProject(s: AppState, i: ProjectInput, exceptId?: string): Result<never> | null {
  if (i.name.trim().length < 3) return fail("INVALID", "Le nom de la mission doit comporter au moins 3 caractères.");
  if (!s.clients.some((c) => c.id === i.clientId)) return fail("INVALID", "Client inconnu.");
  if (!s.departments.some((d) => d.id === i.departmentId)) return fail("INVALID", "Département inconnu.");
  if (!s.employees.some((e) => e.id === i.leadId && e.status !== "ARCHIVE")) return fail("INVALID", "Responsable de mission inconnu ou archivé.");
  if (!i.type.trim()) return fail("INVALID", "Le type de mission est obligatoire.");
  if (!PRIORITIES.includes(i.priority)) return fail("INVALID", "Priorité invalide.");
  if (!i.reference.trim()) return fail("INVALID", "La référence est obligatoire.");
  if (referenceTaken(s, i.reference, exceptId)) return fail("INVALID", `La référence « ${i.reference.trim()} » existe déjà.`);
  if (!i.otp.trim()) return fail("INVALID", "Le numéro OTP est obligatoire.");
  if (otpTaken(s, i.otp, exceptId)) return fail("INVALID", `Le numéro OTP « ${i.otp.trim()} » existe déjà.`);
  if (!isValidDate(i.startDate) || !isValidDate(i.endDate) || i.startDate > i.endDate) return fail("INVALID", "Période invalide : la date de fin doit suivre la date de début.");
  if (!(i.estimatedDays > 0)) return fail("INVALID", "La durée estimée doit être strictement positive.");
  const struct = validateStructure(i.phases ?? [], i.milestones ?? [], i);
  if (struct) return fail("INVALID", struct);
  if (i.finance) {
    const f = i.finance;
    if ([f.budget, f.resourceBudget, f.estimatedDailyCost, f.dailySellPrice ?? 0].some((n) => !(n >= 0))) return fail("INVALID", "Les montants doivent être positifs ou nuls.");
  }
  return null;
}

/** Re-evaluate a mission that has not started: open seats → « en attente de staffing », complete → « à venir ». */
function syncStaffingStatus(s: AppState, p: Project) {
  if (FINAL.includes(p.status) || p.startDate <= s.now) return;
  const cov = projectCoverage(s, p.id);
  p.status = cov.quantity > 0 && cov.rate < 1 ? "EN_ATTENTE_STAFFING" : "A_VENIR";
}
const seatsLabel = (n: number) => `${fmtInt(n)} poste${n > 1 ? "s" : ""}`;

function notifyUnstaffed(s: AppState, p: Project, title: string) {
  const cov = projectCoverage(s, p.id);
  if (cov.missing > 0) notifyHolders(s, "request.process", "UNSTAFFED", title, `${p.name} — ${seatsLabel(cov.missing)} à pourvoir à partir du ${fmtDate(p.startDate)}.`, `/app/missions/${p.id}`);
}

const reqRow = (s: AppState, projectId: string, r: RequirementInput): StaffingRequirement => ({
  id: freshId(s, "rq"),
  projectId,
  gradeMin: r.gradeMin,
  quantity: r.quantity,
  mandatorySkillIds: [...new Set(r.mandatorySkillIds)],
  desiredSkillIds: [...new Set(r.desiredSkillIds)],
  minExperienceYears: r.minExperienceYears,
  startDate: r.startDate,
  endDate: r.endDate,
  allocationPct: r.allocationPct,
  priority: r.priority,
  fullTime: r.fullTime || undefined,
});

export function createProject(s: AppState, input: ProjectInput): Result<Project> {
  const denied = deny(s, "project.create", { departmentId: input.departmentId });
  if (denied) return denied;
  if (input.finance && !can(s, actorOf(s), "project.finance.read")) return fail("FORBIDDEN", "Votre profil ne permet pas de saisir les données financières d’une mission.");
  const bad = validateProject(s, input);
  if (bad) return bad;
  for (const [idx, r] of (input.requirements ?? []).entries()) {
    const err = validateRequirement(s, r, input);
    if (err) return fail("INVALID", `Besoin ${idx + 1} : ${err}`);
  }
  const actor = actorOf(s)!;
  const id = freshId(s, "p");
  const f = input.finance;
  const project: Project = {
    id,
    reference: input.reference.trim().toUpperCase(),
    otp: input.otp.trim().toUpperCase(),
    name: input.name.trim(),
    clientId: input.clientId,
    description: input.description?.trim() ?? "",
    departmentId: input.departmentId,
    leadId: input.leadId,
    createdById: actor.employeeId ?? undefined,
    type: input.type.trim(),
    priority: input.priority,
    startDate: input.startDate,
    endDate: input.endDate,
    estimatedDays: input.estimatedDays,
    budget: f?.budget ?? 0,
    currency: "DZD",
    resourceBudget: f?.resourceBudget ?? 0,
    estimatedDailyCost: f?.estimatedDailyCost ?? 0,
    dailySellPrice: f?.dailySellPrice,
    certainty: input.certainty ?? "CONFIRMEE",
    status: (input.requirements?.length ?? 0) > 0 ? "EN_ATTENTE_STAFFING" : "A_VENIR",
    phases: (input.phases ?? []).map((ph, i): ProjectPhase => ({ id: `${id}-ph${i + 1}`, name: ph.name.trim(), startDate: ph.startDate, endDate: ph.endDate })),
    milestones: (input.milestones ?? []).map((m, i): Milestone => ({ id: `${id}-ms${i + 1}`, name: m.name.trim(), date: m.date, done: false })),
    sector: input.sector.trim(),
  };
  s.projects.push(project);
  const reqs = (input.requirements ?? []).map((r) => reqRow(s, id, r));
  s.requirements.push(...reqs);
  const seats = reqs.reduce((n, r) => n + r.quantity, 0);
  refreshStatuses(s);
  audit(s, {
    action: "project.create",
    entity: "Mission",
    entityId: id,
    label: `${project.reference} — ${project.name}`,
    after: { Statut: project.status, Responsable: empName(s, project.leadId), Période: `${fmtDate(project.startDate)} → ${fmtDate(project.endDate)}`, Besoins: reqs.length ? `${reqs.length} ligne${reqs.length > 1 ? "s" : ""}, ${seatsLabel(seats)}` : "Aucun" },
  });
  if (seats > 0) notifyUnstaffed(s, project, `Nouvelle mission à staffer — ${project.reference}`);
  else notifyHolders(s, "request.process", "MISSION", `Nouvelle mission — ${project.reference}`, `${project.name} a été créée sans besoin de staffing.`, `/app/missions/${id}`);
  if (project.leadId !== actor.employeeId) notify(s, userOfEmployee(s, project.leadId)?.id, "MISSION", "Vous êtes responsable d’une mission", `${project.name} — ${project.reference}.`, `/app/missions/${id}`);
  return ok(s.projects.find((p) => p.id === id)!);
}

const FINANCE_LABEL = { budget: "Budget", resourceBudget: "Budget ressources", estimatedDailyCost: "Coût/jour estimé", dailySellPrice: "Prix de vente/jour" } as const;

export function updateProject(s: AppState, id: string, patch: ProjectPatch): Result<Project> {
  const p = s.projects.find((x) => x.id === id);
  if (!p) return fail("NOT_FOUND", "Mission introuvable.");
  const denied = deny(s, "project.edit", { projectId: id });
  if (denied) return denied;
  if (FINAL.includes(p.status)) return fail("LOCKED", "Une mission terminée ou annulée ne peut plus être modifiée.");
  if (patch.finance && !can(s, actorOf(s), "project.finance.read", { projectId: id })) return fail("FORBIDDEN", "Votre profil ne permet pas de modifier les données financières.");
  const next = {
    name: patch.name ?? p.name,
    clientId: patch.clientId ?? p.clientId,
    departmentId: patch.departmentId ?? p.departmentId,
    leadId: patch.leadId ?? p.leadId,
    type: patch.type ?? p.type,
    priority: patch.priority ?? p.priority,
    sector: patch.sector ?? p.sector,
    reference: patch.reference ?? p.reference,
    otp: patch.otp ?? p.otp,
    startDate: patch.startDate ?? p.startDate,
    endDate: patch.endDate ?? p.endDate,
    estimatedDays: patch.estimatedDays ?? p.estimatedDays,
    phases: patch.phases ?? p.phases,
    milestones: patch.milestones ?? p.milestones,
    finance: patch.finance ? { budget: p.budget, resourceBudget: p.resourceBudget, estimatedDailyCost: p.estimatedDailyCost, dailySellPrice: p.dailySellPrice, ...patch.finance } : undefined,
  };
  const bad = validateProject(s, next, id);
  if (bad) return bad;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const track = (label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      before[label] = a;
      after[label] = b;
    }
  };
  track("Nom", p.name, next.name.trim());
  track("Client", s.clients.find((c) => c.id === p.clientId)?.name, s.clients.find((c) => c.id === next.clientId)?.name);
  track("Département", s.departments.find((d) => d.id === p.departmentId)?.name, s.departments.find((d) => d.id === next.departmentId)?.name);
  track("Responsable", empName(s, p.leadId), empName(s, next.leadId));
  track("Type", p.type, next.type.trim());
  track("Priorité", p.priority, next.priority);
  track("Secteur", p.sector, next.sector.trim());
  track("Référence", p.reference, next.reference.trim().toUpperCase());
  track("OTP", p.otp, next.otp.trim().toUpperCase());
  track("Début", p.startDate, next.startDate);
  track("Fin", p.endDate, next.endDate);
  track("Durée estimée (j)", p.estimatedDays, next.estimatedDays);
  track("Phases", p.phases.map((x) => `${x.name} ${x.startDate}→${x.endDate}`), next.phases.map((x) => `${x.name} ${x.startDate}→${x.endDate}`));
  track("Jalons", p.milestones.map((x) => `${x.name} ${x.date}`), next.milestones.map((x) => `${x.name} ${x.date}`));
  if (patch.description !== undefined) track("Description", p.description, patch.description.trim());
  if (patch.certainty) track("Certitude", p.certainty, patch.certainty);
  if (next.finance) (Object.keys(FINANCE_LABEL) as (keyof typeof FINANCE_LABEL)[]).forEach((k) => track(FINANCE_LABEL[k], p[k], next.finance![k]));

  const leadChanged = next.leadId !== p.leadId;
  p.name = next.name.trim();
  p.clientId = next.clientId;
  p.departmentId = next.departmentId;
  p.leadId = next.leadId;
  p.type = next.type.trim();
  p.priority = next.priority;
  p.sector = next.sector.trim();
  p.reference = next.reference.trim().toUpperCase();
  p.otp = next.otp.trim().toUpperCase();
  p.startDate = next.startDate;
  p.endDate = next.endDate;
  p.estimatedDays = next.estimatedDays;
  if (patch.description !== undefined) p.description = patch.description.trim();
  if (patch.certainty) p.certainty = patch.certainty;
  if (patch.phases) p.phases = patch.phases.map((ph, i) => ({ id: `${id}-ph${i + 1}`, name: ph.name.trim(), startDate: ph.startDate, endDate: ph.endDate }));
  if (patch.milestones) {
    const done = new Map(p.milestones.map((m) => [`${m.name}|${m.date}`, m.done]));
    p.milestones = patch.milestones.map((m, i) => ({ id: `${id}-ms${i + 1}`, name: m.name.trim(), date: m.date, done: done.get(`${m.name.trim()}|${m.date}`) ?? false }));
  }
  if (next.finance) {
    p.budget = next.finance.budget;
    p.resourceBudget = next.finance.resourceBudget;
    p.estimatedDailyCost = next.finance.estimatedDailyCost;
    p.dailySellPrice = next.finance.dailySellPrice;
  }
  syncStaffingStatus(s, p);
  refreshStatuses(s);
  audit(s, { action: "project.update", entity: "Mission", entityId: id, label: `${p.reference} — ${p.name}`, before, after });
  if (leadChanged && next.leadId !== (actorOf(s)?.employeeId ?? "")) notify(s, userOfEmployee(s, next.leadId)?.id, "MISSION", "Vous êtes responsable d’une mission", `${p.name} — ${p.reference}.`, `/app/missions/${id}`);
  return ok(p);
}

/** Tick a milestone (audited). */
export function setMilestoneDone(s: AppState, projectId: string, milestoneId: string, done: boolean): Result<Milestone> {
  const p = s.projects.find((x) => x.id === projectId);
  if (!p) return fail("NOT_FOUND", "Mission introuvable.");
  const denied = deny(s, "project.edit", { projectId });
  if (denied) return denied;
  const m = p.milestones.find((x) => x.id === milestoneId);
  if (!m) return fail("NOT_FOUND", "Jalon introuvable.");
  m.done = done;
  audit(s, { action: "project.milestone", entity: "Mission", entityId: projectId, label: `${p.reference} — jalon « ${m.name} »`, before: { Atteint: !done }, after: { Atteint: done } });
  return ok(m);
}

/** Cancel / close / reopen a mission. Cancelling needs a written reason and cancels active assignments and open requests. */
export function setProjectStatus(s: AppState, id: string, status: ProjectStatus, reason?: string): Result<Project> {
  const p = s.projects.find((x) => x.id === id);
  if (!p) return fail("NOT_FOUND", "Mission introuvable.");
  const denied = deny(s, "project.edit", { projectId: id });
  if (denied) return denied;
  if (p.status === status) return ok(p);
  const before = p.status;
  if (status === "ANNULEE") {
    if (FINAL.includes(p.status)) return fail("INVALID", "Cette mission est déjà clôturée.");
    if (!reason || reason.trim().length < MIN_CANCEL_REASON) return fail("INVALID", `Le motif d’annulation doit comporter au moins ${MIN_CANCEL_REASON} caractères.`);
    let cancelled = 0;
    for (const a of s.assignments) {
      if (a.projectId !== id || (a.status !== "HARD" && a.status !== "SOFT")) continue;
      const prev = a.status;
      a.status = "ANNULEE";
      cancelled++;
      audit(s, { action: "assignment.cancel", entity: "Affectation", entityId: a.id, label: `${empName(s, a.employeeId)} — ${p.name} (mission annulée)`, before: { status: prev }, after: { status: "ANNULEE" }, reason: reason.trim() });
      notify(s, userOfEmployee(s, a.employeeId)?.id, "ASSIGNMENT", "Affectation annulée", `La mission « ${p.name} » a été annulée.`, "/app/planning");
    }
    for (const r of s.requests) {
      if (r.projectId !== id || ["REJETEE", "ANNULEE", "SATISFAITE"].includes(r.status)) continue;
      const prev = r.status;
      r.status = "ANNULEE";
      r.history.push({ ts: s.now, actorId: s.session.userId ?? "system", status: "ANNULEE", note: "Mission annulée." });
      audit(s, { action: "request.cancel", entity: "Demande", entityId: r.id, label: `${r.reference} — mission annulée`, before: { Statut: prev }, after: { Statut: "ANNULEE" }, reason: reason.trim() });
    }
    p.status = "ANNULEE";
    refreshStatuses(s);
    audit(s, { action: "project.cancel", entity: "Mission", entityId: id, label: `${p.reference} — ${p.name}`, before: { Statut: before }, after: { Statut: "ANNULEE", "Affectations annulées": cancelled }, reason: reason.trim() });
    notifyHolders(s, "request.process", "MISSION", `Mission annulée — ${p.reference}`, `${p.name} : ${cancelled} affectation${cancelled > 1 ? "s" : ""} annulée${cancelled > 1 ? "s" : ""}.`, `/app/missions/${id}`);
    notify(s, userOfEmployee(s, p.leadId)?.id, "MISSION", `Mission annulée — ${p.reference}`, p.name, `/app/missions/${id}`);
    return ok(p);
  }
  if (status === "TERMINEE") {
    if (p.status === "ANNULEE") return fail("INVALID", "Une mission annulée ne peut pas être terminée.");
    for (const a of s.assignments) {
      if (a.projectId !== id) continue;
      if (a.status === "HARD") a.status = "TERMINEE";
      else if (a.status === "SOFT") a.status = "ANNULEE";
    }
    p.status = "TERMINEE";
    audit(s, { action: "project.close", entity: "Mission", entityId: id, label: `${p.reference} — ${p.name}`, before: { Statut: before }, after: { Statut: "TERMINEE" }, reason: reason?.trim() });
    refreshStatuses(s);
    return ok(p);
  }
  if (p.status === "ANNULEE" && (status === "A_VENIR" || status === "EN_ATTENTE_STAFFING")) {
    if (p.endDate < s.now) return fail("INVALID", "La période de cette mission est échue : elle ne peut pas être rouverte.");
    p.status = status;
    syncStaffingStatus(s, p);
    refreshStatuses(s);
    audit(s, { action: "project.reopen", entity: "Mission", entityId: id, label: `${p.reference} — ${p.name}`, before: { Statut: before }, after: { Statut: p.status }, reason: reason?.trim() });
    return ok(p);
  }
  return fail("INVALID", "Ce changement de statut n’est pas autorisé : le statut évolue avec le staffing et le calendrier.");
}

/* ---------- requirements ---------- */
function activeLinked(s: AppState, requirementId: string) {
  return s.assignments.filter((a) => a.requirementId === requirementId && (a.status === "HARD" || a.status === "SOFT"));
}

export function addRequirement(s: AppState, projectId: string, input: RequirementInput): Result<StaffingRequirement> {
  const p = s.projects.find((x) => x.id === projectId);
  if (!p) return fail("NOT_FOUND", "Mission introuvable.");
  const denied = deny(s, "project.edit", { projectId });
  if (denied) return denied;
  if (FINAL.includes(p.status)) return fail("LOCKED", "Une mission terminée ou annulée n’accepte plus de nouveau besoin.");
  const err = validateRequirement(s, input, p);
  if (err) return fail("INVALID", err);
  const r = reqRow(s, projectId, input);
  s.requirements.push(r);
  syncStaffingStatus(s, p);
  refreshStatuses(s);
  const g = s.grades.find((x) => x.id === r.gradeMin)?.name;
  audit(s, { action: "project.requirement.add", entity: "Besoin", entityId: r.id, label: `${p.reference} — ${r.quantity} × ${g} (${r.allocationPct} %)`, after: { Grade: g, Quantité: r.quantity, Allocation: r.allocationPct, Début: r.startDate, Fin: r.endDate } });
  notifyUnstaffed(s, p, `Nouveau besoin de staffing — ${p.reference}`);
  return ok(r);
}

export function updateRequirement(s: AppState, requirementId: string, patch: Partial<RequirementInput>): Result<StaffingRequirement> {
  const r = s.requirements.find((x) => x.id === requirementId);
  if (!r) return fail("NOT_FOUND", "Besoin introuvable.");
  const p = s.projects.find((x) => x.id === r.projectId)!;
  const denied = deny(s, "project.edit", { projectId: p.id });
  if (denied) return denied;
  if (FINAL.includes(p.status)) return fail("LOCKED", "Une mission terminée ou annulée n’accepte plus de modification.");
  const next: RequirementInput = { ...r, ...patch, fullTime: patch.fullTime ?? r.fullTime };
  const err = validateRequirement(s, next, p);
  if (err) return fail("INVALID", err);
  const linked = activeLinked(s, r.id);
  const people = new Set(linked.map((a) => a.employeeId)).size;
  if (next.quantity < people) return fail("CONFLICT", `${people} collaborateur(s) sont déjà positionnés sur ce besoin : annulez d’abord une affectation avant de réduire la quantité.`);
  const grade = (id: string) => s.grades.find((g) => g.id === id)?.name;
  const skill = (ids: string[]) => ids.map((id) => s.skills.find((k) => k.id === id)?.name ?? id);
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  const track = (label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      before[label] = a;
      after[label] = b;
    }
  };
  track("Grade", grade(r.gradeMin), grade(next.gradeMin));
  track("Quantité", r.quantity, next.quantity);
  track("Compétences obligatoires", skill(r.mandatorySkillIds), skill(next.mandatorySkillIds));
  track("Compétences souhaitées", skill(r.desiredSkillIds), skill(next.desiredSkillIds));
  track("Expérience min. (ans)", r.minExperienceYears, next.minExperienceYears);
  track("Début", r.startDate, next.startDate);
  track("Fin", r.endDate, next.endDate);
  track("Allocation", r.allocationPct, next.allocationPct);
  track("Priorité", r.priority, next.priority);
  track("Temps plein", !!r.fullTime, !!next.fullTime);
  Object.assign(r, {
    gradeMin: next.gradeMin,
    quantity: next.quantity,
    mandatorySkillIds: [...new Set(next.mandatorySkillIds)],
    desiredSkillIds: [...new Set(next.desiredSkillIds)],
    minExperienceYears: next.minExperienceYears,
    startDate: next.startDate,
    endDate: next.endDate,
    allocationPct: next.allocationPct,
    priority: next.priority,
    fullTime: next.fullTime || undefined,
  });
  syncStaffingStatus(s, p);
  refreshStatuses(s);
  audit(s, { action: "project.requirement.update", entity: "Besoin", entityId: r.id, label: `${p.reference} — ${grade(r.gradeMin)} × ${r.quantity}`, before, after });
  if (Number(after["Quantité"]) > Number(before["Quantité"] ?? 0)) notifyUnstaffed(s, p, `Besoin de staffing augmenté — ${p.reference}`);
  return ok(r);
}

export function removeRequirement(s: AppState, requirementId: string): Result<StaffingRequirement> {
  const r = s.requirements.find((x) => x.id === requirementId);
  if (!r) return fail("NOT_FOUND", "Besoin introuvable.");
  const p = s.projects.find((x) => x.id === r.projectId)!;
  const denied = deny(s, "project.edit", { projectId: p.id });
  if (denied) return denied;
  if (FINAL.includes(p.status)) return fail("LOCKED", "Une mission terminée ou annulée n’accepte plus de modification.");
  const linked = activeLinked(s, r.id);
  if (linked.length) return fail("CONFLICT", `Ce besoin porte ${linked.length} affectation${linked.length > 1 ? "s" : ""} active${linked.length > 1 ? "s" : ""} (${[...new Set(linked.map((a) => empName(s, a.employeeId)))].join(", ")}) : annulez-les avant de le supprimer.`);
  s.requirements = s.requirements.filter((x) => x.id !== r.id);
  // history keeps its link: assignments that ended no longer point to a deleted seat
  for (const a of s.assignments) if (a.requirementId === r.id) a.requirementId = undefined;
  for (const q of s.requests) {
    if (q.requirementId !== r.id) continue;
    q.requirementId = undefined;
    if (!["REJETEE", "ANNULEE", "SATISFAITE"].includes(q.status)) {
      const prev = q.status;
      q.status = "ANNULEE";
      q.history.push({ ts: s.now, actorId: s.session.userId ?? "system", status: "ANNULEE", note: "Besoin supprimé de la mission." });
      audit(s, { action: "request.cancel", entity: "Demande", entityId: q.id, label: `${q.reference} — besoin supprimé`, before: { Statut: prev }, after: { Statut: "ANNULEE" } });
    }
  }
  syncStaffingStatus(s, p);
  refreshStatuses(s);
  const g = s.grades.find((x) => x.id === r.gradeMin)?.name;
  audit(s, { action: "project.requirement.remove", entity: "Besoin", entityId: r.id, label: `${p.reference} — ${r.quantity} × ${g}`, before: { Grade: g, Quantité: r.quantity, Allocation: r.allocationPct } });
  return ok(r);
}

/* ---------- documents (simulated upload) ---------- */
export const DOC_KINDS = ["Contrat", "Planning", "Livrable", "Compte rendu", "Autre"] as const;
export function addProjectDocument(s: AppState, projectId: string, input: { name: string; kind: string; sizeKb: number }): Result<DocumentMeta> {
  const p = s.projects.find((x) => x.id === projectId);
  if (!p) return fail("NOT_FOUND", "Mission introuvable.");
  const denied = deny(s, "project.edit", { projectId });
  if (denied) return denied;
  if (!input.name.trim()) return fail("INVALID", "Le nom du document est obligatoire.");
  if (!(input.sizeKb > 0)) return fail("INVALID", "Taille de fichier invalide.");
  const doc: DocumentMeta = { id: freshId(s, "doc"), entity: "PROJECT", entityId: projectId, name: input.name.trim(), kind: input.kind || "Autre", sizeKb: Math.round(input.sizeKb), uploadedById: s.session.userId ?? "", createdAt: s.now };
  s.documents.push(doc);
  audit(s, { action: "project.document.add", entity: "Mission", entityId: projectId, label: `${p.reference} — document « ${doc.name} »`, after: { Document: doc.name, Type: doc.kind } });
  invalidate(s);
  return ok(doc);
}

