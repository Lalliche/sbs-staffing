/* People actions (spec 8.5): create / edit / archive / restore / import / documents.
   Every write checks can(), mutates the draft, writes an AuditLog row (before/after) and notifies when relevant. */
import { isValidDate, diffDays } from "../../engine/dates";
import { nextId } from "../../engine/ids";
import { defaultDailyCost } from "../selectors/people";
import type { AppState, Contract, Employee, EmployeeStatus, DocumentMeta } from "../types";
import { actorOf, audit, deny, fail, fullName, notifyHolders, ok, type Result } from "./core";

export interface EmployeeInput {
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  gradeId: string;
  departmentId: string;
  officeId: string;
  managerId: string | null;
  contract: Contract;
  weeklyHours: number;
  startDate: string;
  endDate?: string;
  status?: EmployeeStatus;
  bio: string;
  yearsExperience: number;
  sectors: string[];
  languages: string[];
  diplomas: string[];
  /** RESTRICTED — only applied for actors holding `employee.salary.read`. */
  dailyCost?: number;
  dailyRate?: number;
}
export type FieldErrors = Partial<Record<keyof EmployeeInput, string>>;
export const CONTRACTS: Contract[] = ["CDI", "CDD", "STAGE", "CONSULTANT"];
export const CONTRACT_LABEL: Record<Contract, string> = { CDI: "CDI", CDD: "CDD", STAGE: "Stage", CONSULTANT: "Consultant externe" };

const norm = (t: string) => t.trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pure validation shared by the form, the import wizard (live) and the actions. Returns one message per faulty field. */
export function validateEmployeeInput(s: AppState, input: Partial<EmployeeInput>, opts: { selfId?: string; reserved?: { matricules?: Set<string>; emails?: Set<string> } } = {}): FieldErrors {
  const e: FieldErrors = {};
  const others = s.employees.filter((x) => x.id !== opts.selfId);
  const mat = (input.matricule ?? "").trim();
  if (!mat) e.matricule = "Le matricule est obligatoire.";
  else if (others.some((x) => norm(x.matricule) === norm(mat)) || opts.reserved?.matricules?.has(norm(mat))) e.matricule = `Le matricule « ${mat} » existe déjà.`;
  if (!(input.firstName ?? "").trim()) e.firstName = "Le prénom est obligatoire.";
  if (!(input.lastName ?? "").trim()) e.lastName = "Le nom est obligatoire.";
  const mail = (input.email ?? "").trim();
  if (!mail) e.email = "L’e-mail est obligatoire.";
  else if (!EMAIL.test(mail)) e.email = "Adresse e-mail invalide.";
  else if (others.some((x) => norm(x.email) === norm(mail)) || opts.reserved?.emails?.has(norm(mail))) e.email = "Cette adresse e-mail est déjà utilisée.";
  if (!(input.jobTitle ?? "").trim()) e.jobTitle = "Le poste est obligatoire.";
  if (!s.grades.some((g) => g.id === input.gradeId)) e.gradeId = input.gradeId ? "Grade inconnu." : "Le grade est obligatoire.";
  if (!s.departments.some((d) => d.id === input.departmentId)) e.departmentId = input.departmentId ? "Département inconnu." : "Le département est obligatoire.";
  if (!s.offices.some((o) => o.id === input.officeId)) e.officeId = input.officeId ? "Bureau inconnu." : "Le bureau est obligatoire.";
  if (input.managerId) {
    const m = s.employees.find((x) => x.id === input.managerId);
    if (!m || m.status === "ARCHIVE") e.managerId = "Manager introuvable ou archivé.";
    else if (opts.selfId) {
      // no reporting loop: the chosen manager must not (transitively) report to the person
      let cur: Employee | undefined = m;
      for (let i = 0; cur && i < 12; i++) {
        if (cur.id === opts.selfId) {
          e.managerId = "Ce manager dépend déjà de cette personne (boucle hiérarchique).";
          break;
        }
        cur = s.employees.find((x) => x.id === cur?.managerId);
      }
    }
  }
  if (!input.contract || !CONTRACTS.includes(input.contract)) e.contract = "Type de contrat invalide.";
  if (!Number.isFinite(input.weeklyHours) || (input.weeklyHours ?? 0) < 1 || (input.weeklyHours ?? 0) > 60) e.weeklyHours = "Heures hebdomadaires : entre 1 et 60.";
  if (!input.startDate || !isValidDate(input.startDate)) e.startDate = "Date d’entrée invalide (AAAA-MM-JJ).";
  if (input.endDate) {
    if (!isValidDate(input.endDate)) e.endDate = "Date de fin invalide (AAAA-MM-JJ).";
    else if (input.startDate && isValidDate(input.startDate) && input.endDate < input.startDate) e.endDate = "La fin du contrat précède la date d’entrée.";
  } else if (input.contract && input.contract !== "CDI" && input.contract !== undefined && input.startDate) {
    // fixed-term contracts should carry an end date, but it is only a warning in the form: not an error here
  }
  if (!Number.isFinite(input.yearsExperience) || (input.yearsExperience ?? 0) < 0 || (input.yearsExperience ?? 0) > 60) e.yearsExperience = "Expérience : entre 0 et 60 ans.";
  if (input.dailyCost !== undefined && (!Number.isFinite(input.dailyCost) || input.dailyCost < 0)) e.dailyCost = "Montant invalide.";
  if (input.dailyRate !== undefined && (!Number.isFinite(input.dailyRate) || input.dailyRate < 0)) e.dailyRate = "Montant invalide.";
  return e;
}
const firstError = (e: FieldErrors) => Object.values(e)[0] ?? "Formulaire invalide.";

const snapshot = (e: Employee, withMoney: boolean): Record<string, unknown> => ({
  matricule: e.matricule, firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phone, jobTitle: e.jobTitle, gradeId: e.gradeId, departmentId: e.departmentId,
  officeId: e.officeId, managerId: e.managerId, contract: e.contract, weeklyHours: e.weeklyHours, startDate: e.startDate, endDate: e.endDate ?? null, status: e.status, bio: e.bio,
  yearsExperience: e.yearsExperience, sectors: e.sectors, languages: e.languages, diplomas: e.diplomas, ...(withMoney ? { dailyCost: e.dailyCost, dailyRate: e.dailyRate ?? null } : {}),
});
const ENTITY = "Collaborateur";

function build(s: AppState, input: EmployeeInput, id: string, canMoney: boolean): Employee {
  return {
    id,
    matricule: input.matricule.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    phone: (input.phone ?? "").trim(),
    jobTitle: input.jobTitle.trim(),
    gradeId: input.gradeId,
    departmentId: input.departmentId,
    officeId: input.officeId,
    managerId: input.managerId || null,
    contract: input.contract,
    weeklyHours: input.weeklyHours,
    startDate: input.startDate,
    endDate: input.endDate || undefined,
    status: input.status === "CONGE_LONG" ? "CONGE_LONG" : "ACTIF",
    bio: (input.bio ?? "").trim(),
    yearsExperience: input.yearsExperience,
    sectors: [...(input.sectors ?? [])],
    languages: [...(input.languages ?? [])],
    diplomas: [...(input.diplomas ?? [])],
    dailyCost: canMoney && input.dailyCost !== undefined ? input.dailyCost : defaultDailyCost(s, input.gradeId),
    dailyRate: canMoney ? input.dailyRate : undefined,
  };
}

/* ------------------------------------------------------------------ create */
export function createEmployee(s: AppState, input: EmployeeInput): Result<Employee> {
  const denied = deny(s, "employee.create");
  if (denied) return denied;
  const canMoney = !!deny(s, "employee.salary.read") === false;
  if ((input.dailyCost !== undefined || input.dailyRate !== undefined) && !canMoney) return fail("FORBIDDEN", "Vous ne pouvez pas renseigner coût et tarif journaliers.");
  const errors = validateEmployeeInput(s, input);
  if (Object.keys(errors).length) return fail("INVALID", firstError(errors));
  const e = build(s, input, nextId(s, "e"), canMoney);
  s.employees.push(e);
  audit(s, {
    action: "employee.create",
    entity: ENTITY,
    entityId: e.id,
    label: `${fullName(e)} (${e.matricule})`,
    after: { matricule: e.matricule, gradeId: e.gradeId, departmentId: e.departmentId, officeId: e.officeId, contract: e.contract, startDate: e.startDate },
  });
  return ok(e);
}

/* ------------------------------------------------------------------ update */
export function updateEmployee(s: AppState, id: string, patch: Partial<EmployeeInput>): Result<Employee> {
  const e = s.employees.find((x) => x.id === id);
  if (!e) return fail("NOT_FOUND", "Collaborateur introuvable.");
  const denied = deny(s, "employee.create", { employeeId: id });
  if (denied) return denied;
  if (e.status === "ARCHIVE") return fail("LOCKED", "Collaborateur archivé : restaurez-le avant de le modifier.");
  const canMoney = !deny(s, "employee.salary.read", { employeeId: id });
  const touchesMoney = (patch.dailyCost !== undefined && patch.dailyCost !== e.dailyCost) || (patch.dailyRate !== undefined && patch.dailyRate !== e.dailyRate);
  if (touchesMoney && !canMoney) return fail("FORBIDDEN", "Vous ne pouvez pas modifier coût et tarif journaliers.");
  const before = snapshot(e, canMoney);
  const merged: EmployeeInput = { ...(snapshot(e, canMoney) as unknown as EmployeeInput), endDate: e.endDate, managerId: e.managerId, ...patch };
  const errors = validateEmployeeInput(s, merged, { selfId: id });
  if (Object.keys(errors).length) return fail("INVALID", firstError(errors));
  const next = build(s, merged, id, canMoney);
  if (!canMoney) {
    next.dailyCost = e.dailyCost;
    next.dailyRate = e.dailyRate;
  }
  const after = snapshot(next, canMoney);
  if (JSON.stringify(before) === JSON.stringify(after)) return ok(e, ["Aucune modification à enregistrer."]);
  // keep the fields the form does not edit
  Object.assign(e, { ...next, workingWeekdays: e.workingWeekdays, archivedAt: e.archivedAt, archiveReason: e.archiveReason });
  audit(s, { action: "employee.update", entity: ENTITY, entityId: id, label: `${fullName(e)} (${e.matricule})`, before, after });
  return ok(e);
}

/* ------------------------------------------------------------------ archive / restore */
export function archiveEmployee(s: AppState, id: string, reason: string): Result<{ openAssignments: number }> {
  const e = s.employees.find((x) => x.id === id);
  if (!e) return fail("NOT_FOUND", "Collaborateur introuvable.");
  const denied = deny(s, "employee.archive", { employeeId: id });
  if (denied) return denied;
  if (e.status === "ARCHIVE") return fail("INVALID", "Ce collaborateur est déjà archivé.");
  if (reason.trim().length < 3) return fail("INVALID", "Indiquez le motif de l’archivage (départ, fin de contrat…).");
  const actor = actorOf(s);
  if (actor?.employeeId === id) return fail("INVALID", "Vous ne pouvez pas archiver votre propre fiche.");
  const before = { status: e.status, endDate: e.endDate ?? null };
  e.status = "ARCHIVE";
  e.archivedAt = s.now;
  e.archiveReason = reason.trim();
  if (!e.endDate || e.endDate > s.now) e.endDate = s.now; // capacity stops at the departure date; history stays
  const open = s.assignments.filter((a) => a.employeeId === id && (a.status === "HARD" || a.status === "SOFT") && a.endDate >= s.now).length;
  audit(s, { action: "employee.archive", entity: ENTITY, entityId: id, label: `${fullName(e)} (${e.matricule})`, before, after: { status: "ARCHIVE", archivedAt: s.now, endDate: e.endDate ?? null }, reason: reason.trim() });
  if (open > 0) notifyHolders(s, "assignment.edit", "SYSTEM", `Collaborateur archivé avec ${open} affectation${open > 1 ? "s" : ""} en cours`, `${fullName(e)} a quitté le cabinet : à remplacer dans le planning.`, "/app/planning");
  return ok({ openAssignments: open }, open ? [`${open} affectation${open > 1 ? "s" : ""} en cours ou à venir : à remplacer par le staffing.`] : undefined);
}
export function restoreEmployee(s: AppState, id: string): Result<Employee> {
  const e = s.employees.find((x) => x.id === id);
  if (!e) return fail("NOT_FOUND", "Collaborateur introuvable.");
  const denied = deny(s, "employee.archive", { employeeId: id });
  if (denied) return denied;
  if (e.status !== "ARCHIVE") return fail("INVALID", "Ce collaborateur n’est pas archivé.");
  const before = { status: e.status, archivedAt: e.archivedAt ?? null, endDate: e.endDate ?? null };
  if (e.endDate && e.endDate === e.archivedAt) delete e.endDate;
  e.status = "ACTIF";
  delete e.archivedAt;
  delete e.archiveReason;
  audit(s, { action: "employee.restore", entity: ENTITY, entityId: id, label: `${fullName(e)} (${e.matricule})`, before, after: { status: "ACTIF", archivedAt: null, endDate: e.endDate ?? null } });
  return ok(e);
}

/* ------------------------------------------------------------------ import */
export interface ImportRow {
  /** Line number in the source file (1-based, header excluded). */
  line: number;
  input: Partial<EmployeeInput>;
}
export interface ImportRejected {
  line: number;
  input: Partial<EmployeeInput>;
  errors: FieldErrors;
}
export interface ImportOutcome {
  created: string[];
  rejected: ImportRejected[];
}
/** Pure pre-check of a batch (wizard step 3): errors per line, duplicates inside the file included. */
export function validateImportRows(s: AppState, rows: ImportRow[]): Map<number, FieldErrors> {
  const out = new Map<number, FieldErrors>();
  const matricules = new Set<string>();
  const emails = new Set<string>();
  for (const r of rows) {
    const errs = validateEmployeeInput(s, r.input, { reserved: { matricules, emails } });
    if (Object.keys(errs).length) out.set(r.line, errs);
    // a faulty row does not reserve its matricule: the corrected one may keep it
    else {
      matricules.add(norm(r.input.matricule ?? ""));
      emails.add(norm(r.input.email ?? ""));
    }
  }
  return out;
}
export function importEmployees(s: AppState, rows: ImportRow[], meta: { fileName: string }): Result<ImportOutcome> {
  const denied = deny(s, "employee.import");
  if (denied) return denied;
  if (!rows.length) return fail("INVALID", "Le fichier ne contient aucune ligne à importer.");
  const canMoney = !deny(s, "employee.salary.read");
  const errors = validateImportRows(s, rows);
  const created: string[] = [];
  const rejected: ImportRejected[] = [];
  for (const r of rows) {
    const errs = errors.get(r.line);
    if (errs) {
      rejected.push({ line: r.line, input: r.input, errors: errs });
      continue;
    }
    const { dailyCost, dailyRate, ...rest } = r.input;
    const e = build(s, { ...(rest as EmployeeInput), dailyCost: canMoney ? dailyCost : undefined, dailyRate: canMoney ? dailyRate : undefined }, nextId(s, "e"), canMoney);
    s.employees.push(e);
    created.push(e.id);
  }
  audit(s, {
    action: "import.employees",
    entity: ENTITY,
    entityId: meta.fileName,
    label: `Import « ${meta.fileName} » : ${created.length} créé${created.length > 1 ? "s" : ""}, ${rejected.length} rejeté${rejected.length > 1 ? "s" : ""}`,
    after: { fichier: meta.fileName, lignes: rows.length, crees: created.length, rejetes: rejected.length, lignesRejetees: rejected.map((x) => x.line).join(", ") || null },
  });
  return ok({ created, rejected }, rejected.length ? [`${rejected.length} ligne${rejected.length > 1 ? "s" : ""} rejetée${rejected.length > 1 ? "s" : ""}.`] : undefined);
}

/* ------------------------------------------------------------------ documents (metadata only, simulated upload) */
export function addEmployeeDocument(s: AppState, employeeId: string, doc: { name: string; kind: string; sizeKb: number }): Result<DocumentMeta> {
  const e = s.employees.find((x) => x.id === employeeId);
  if (!e) return fail("NOT_FOUND", "Collaborateur introuvable.");
  const actor = actorOf(s);
  const own = !!actor && actor.employeeId === employeeId;
  const denied = own ? deny(s, "employee.view", { employeeId }) : deny(s, "employee.create", { employeeId });
  if (denied) return denied;
  const name = doc.name.trim();
  if (!name) return fail("INVALID", "Nom de document obligatoire.");
  const d: DocumentMeta = { id: nextId(s, "doc"), entity: "EMPLOYEE", entityId: employeeId, name, kind: doc.kind || "Autre", sizeKb: Math.max(1, Math.round(doc.sizeKb)), uploadedById: actor!.id, createdAt: s.now };
  s.documents.unshift(d);
  audit(s, { action: "employee.document", entity: ENTITY, entityId: employeeId, label: `${fullName(e)} — ${name}`, after: { document: name, type: d.kind, tailleKo: d.sizeKb } });
  return ok(d);
}

/** Days until a contract end (fixed-term reminders in the fiche). */
export const daysToEnd = (e: Pick<Employee, "endDate">, now: string) => (e.endDate ? diffDays(now, e.endDate) : null);
