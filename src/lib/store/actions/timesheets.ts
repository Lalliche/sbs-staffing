/* Timesheet writes (spec 7.7). The engine's `canTransition` / `isEditable` are the single rule. */
import { addDays, diffDays, weekStart } from "../../engine/dates";
import { fmtDate } from "../../engine/format";
import { nextId } from "../../engine/ids";
import { canTransition, isEditable, isInternalCode } from "../../engine/timesheet";
import { can } from "../../engine/permissions";
import type { ActivityType, AppState, Timesheet } from "../types";
import { actorOf, audit, deny, empName, fail, notify, notifyHolders, ok, userOfEmployee, type Result } from "./core";
import { ensureTimesheet } from "./time";

export interface EntryInput {
  projectId: string;
  date: string;
  hours: number;
  billable: boolean;
  activityType: ActivityType;
  description: string;
}
const own = (s: AppState, employeeId: string) => {
  const u = actorOf(s);
  return !!u && u.employeeId === employeeId && can(s, u, "timesheet.own", { employeeId });
};
const find = (s: AppState, id: string): Timesheet | undefined => s.timesheets.find((t) => t.id === id);

/** Replace the entries of one week (draft autosave / « Enregistrer »). Creates the sheet lazily. */
export function saveWeek(s: AppState, employeeId: string, week: string, entries: EntryInput[]): Result<Timesheet> {
  if (!own(s, employeeId)) return fail("FORBIDDEN", "Vous ne pouvez saisir que vos propres heures.");
  const wk = weekStart(week);
  const ts = s.timesheets.find((t) => t.employeeId === employeeId && t.weekStart === wk) ?? ensureTimesheet(s, employeeId, wk, false);
  if (!ts) return fail("NOT_FOUND", "Collaborateur introuvable.");
  if (!isEditable(ts)) return fail("LOCKED", "Cette feuille est verrouillée (soumise ou validée).");
  const perDay = new Map<string, number>();
  for (const e of entries) {
    if (!(e.hours >= 0 && e.hours <= 24)) return fail("INVALID", "Les heures d’une ligne doivent être comprises entre 0 et 24.");
    const off = diffDays(wk, e.date);
    if (off < 0 || off > 6) return fail("INVALID", "Une saisie sort de la semaine.");
    if (!isInternalCode(e.projectId) && !s.projects.some((p) => p.id === e.projectId)) return fail("INVALID", "Mission inconnue.");
    perDay.set(e.date, (perDay.get(e.date) ?? 0) + e.hours);
  }
  if ([...perDay.values()].some((h) => h > 24)) return fail("INVALID", "Plus de 24 h saisies sur une journée.");
  s.entries = s.entries.filter((e) => e.timesheetId !== ts.id);
  for (const e of entries.filter((x) => x.hours > 0)) s.entries.push({ id: nextId(s, "te"), timesheetId: ts.id, ...e });
  return ok(ts);
}

function managerOf(s: AppState, employeeId: string) {
  const m = s.employees.find((e) => e.id === employeeId)?.managerId;
  return m ? userOfEmployee(s, m) : undefined;
}
export function submitTimesheet(s: AppState, id: string): Result<Timesheet> {
  const ts = find(s, id);
  if (!ts) return fail("NOT_FOUND", "Feuille introuvable.");
  if (!own(s, ts.employeeId)) return fail("FORBIDDEN", "Vous ne pouvez soumettre que votre propre feuille.");
  if (!canTransition(ts.status, "SOUMIS")) return fail("LOCKED", "Cette feuille ne peut pas être soumise dans son état actuel.");
  const total = s.entries.filter((e) => e.timesheetId === id).reduce((a, e) => a + e.hours, 0);
  if (total <= 0) return fail("INVALID", "Saisissez au moins une heure avant de soumettre.");
  const before = ts.status;
  ts.status = "SOUMIS";
  ts.submittedAt = s.now;
  ts.comment = undefined;
  audit(s, { action: "timesheet.submit", entity: "Timesheet", entityId: id, label: `${empName(s, ts.employeeId)} — semaine du ${fmtDate(ts.weekStart)}`, before: { Statut: before }, after: { Statut: "SOUMIS", Heures: total } });
  const mgr = managerOf(s, ts.employeeId);
  if (mgr) notify(s, mgr.id, "TIMESHEET", "Timesheet à valider", `${empName(s, ts.employeeId)} — semaine du ${fmtDate(ts.weekStart)} (${total} h).`, "/app/timesheets?vue=validation");
  else notifyHolders(s, "timesheet.validate", "TIMESHEET", "Timesheet à valider", `${empName(s, ts.employeeId)} — semaine du ${fmtDate(ts.weekStart)}.`, "/app/timesheets?vue=validation");
  return ok(ts);
}

function decide(s: AppState, id: string, to: "VALIDE" | "REJETE" | "CORRECTION_DEMANDEE", comment: string | undefined, action: string, verb: string): Result<Timesheet> {
  const ts = find(s, id);
  if (!ts) return fail("NOT_FOUND", "Feuille introuvable.");
  const denied = deny(s, "timesheet.validate", { employeeId: ts.employeeId });
  if (denied) return denied;
  if (actorOf(s)?.employeeId === ts.employeeId) return fail("FORBIDDEN", "Vous ne pouvez pas valider votre propre feuille.");
  if (!canTransition(ts.status, to)) return fail("LOCKED", "Cette feuille n’est pas en attente de décision.");
  if (to !== "VALIDE" && !comment?.trim()) return fail("INVALID", "Un commentaire est obligatoire pour cette décision.");
  const before = ts.status;
  ts.status = to;
  ts.comment = comment?.trim() || undefined;
  if (to === "VALIDE") {
    ts.validatedById = s.session.userId ?? undefined;
    ts.validatedAt = s.now;
  }
  audit(s, { action, entity: "Timesheet", entityId: id, label: `${empName(s, ts.employeeId)} — semaine du ${fmtDate(ts.weekStart)}`, before: { Statut: before }, after: { Statut: to }, reason: to === "VALIDE" ? undefined : comment?.trim() });
  notify(s, userOfEmployee(s, ts.employeeId)?.id, "TIMESHEET", `Timesheet ${verb}`, `Semaine du ${fmtDate(ts.weekStart)}${comment ? ` — ${comment.trim()}` : ""}`, "/app/timesheets");
  return ok(ts);
}
export const validateTimesheet = (s: AppState, id: string, comment?: string) => decide(s, id, "VALIDE", comment, "timesheet.validate", "validé");
export const rejectTimesheet = (s: AppState, id: string, comment: string) => decide(s, id, "REJETE", comment, "timesheet.reject", "rejeté");
export const requestCorrection = (s: AppState, id: string, comment: string) => decide(s, id, "CORRECTION_DEMANDEE", comment, "timesheet.correction-request", "à corriger");
export function validateMany(s: AppState, ids: string[]): Result<{ done: number; refused: number }> {
  let done = 0, refused = 0;
  for (const id of ids) {
    if (validateTimesheet(s, id).ok) done++;
    else refused++;
  }
  return ok({ done, refused });
}

/** Traced correction of a VALIDATED sheet (spec 7.7): written reason, appended to `corrections`, audited. */
export function openCorrection(s: AppState, id: string, reason: string): Result<Timesheet> {
  const ts = find(s, id);
  if (!ts) return fail("NOT_FOUND", "Feuille introuvable.");
  const denied = deny(s, "timesheet.correct", { employeeId: ts.employeeId });
  if (denied) return denied;
  if (ts.status !== "VALIDE") return fail("INVALID", "Seule une feuille validée nécessite la procédure de correction.");
  if (reason.trim().length < 10) return fail("INVALID", "Le motif de correction doit comporter au moins 10 caractères.");
  ts.corrections.push({ ts: s.now, actorId: s.session.userId ?? "system", reason: reason.trim() });
  ts.status = "CORRECTION_DEMANDEE";
  ts.validatedById = undefined;
  ts.validatedAt = undefined;
  audit(s, { action: "timesheet.correct", entity: "Timesheet", entityId: id, label: `${empName(s, ts.employeeId)} — semaine du ${fmtDate(ts.weekStart)}`, before: { Statut: "VALIDE" }, after: { Statut: "CORRECTION_DEMANDEE" }, reason: reason.trim() });
  notify(s, userOfEmployee(s, ts.employeeId)?.id, "TIMESHEET", "Correction demandée sur une feuille validée", `Semaine du ${fmtDate(ts.weekStart)} — ${reason.trim()}`, "/app/timesheets");
  return ok(ts);
}

export function remindLate(s: AppState, id: string): Result {
  const ts = find(s, id);
  if (!ts) return fail("NOT_FOUND", "Feuille introuvable.");
  const denied = deny(s, "timesheet.validate", { employeeId: ts.employeeId });
  if (denied) return denied;
  notify(s, userOfEmployee(s, ts.employeeId)?.id, "TIMESHEET", `Rappel : timesheet non soumis`, `Semaine du ${fmtDate(ts.weekStart)} à soumettre.`, "/app/timesheets");
  audit(s, { action: "timesheet.remind", entity: "Timesheet", entityId: id, label: `${empName(s, ts.employeeId)} — rappel` });
  return ok(undefined);
}
void addDays;
