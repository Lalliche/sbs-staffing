/* Absences, work modes, requests, notifications and audit seed. */
import { addDays, weekStart } from "../../engine/dates";
import { writeAudit } from "../../engine/audit";
import { nextId } from "../../engine/ids";
import type { AppState, LeaveRequest, Notification, NotificationKind, StaffingRequest, WorkModeEntry } from "../types";
import { projectId, UNSTAFFED_PROJECT } from "./missions";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const L = (id: string, employeeId: string, type: LeaveRequest["type"], startDate: string, endDate: string, status: LeaveRequest["status"], extra: Partial<LeaveRequest> = {}): LeaveRequest => ({
  id, employeeId, type, startDate, endDate, status, createdAt: addDays(startDate, -30 > 0 ? -30 : -30), ...extra,
});

/** Approved absences only: the leave workflow is not part of the product, these rows are read-only data fed by the client's HR system. */
export function seedLeaves(): LeaveRequest[] {
  return [
    L("lv-01", "e05", "CONGE_ANNUEL", "2026-12-01", "2027-01-07", "APPROUVEE", { approverId: "e03", createdAt: "2026-10-20", comment: "Congé de fin d’année validé." }),
    L("lv-03", "e08", "MALADIE", "2026-11-10", "2026-11-11", "APPROUVEE", { approverId: "e02", createdAt: "2026-11-10" }),
    L("lv-05", "e17", "FORMATION", "2026-11-22", "2026-11-24", "APPROUVEE", { approverId: "e15", createdAt: "2026-10-30" }),
    L("lv-07", "e31", "CONGE_ANNUEL", "2026-12-20", "2026-12-31", "APPROUVEE", { approverId: "e30", createdAt: "2026-10-12" }),
    L("lv-09", "e20", "CONGE_ANNUEL", "2026-10-11", "2026-10-15", "APPROUVEE", { approverId: "e17", createdAt: "2026-09-10" }),
    L("lv-10", "e38", "CONGE_ANNUEL", "2026-10-25", "2026-10-29", "APPROUVEE", { approverId: "e37", createdAt: "2026-09-20" }),
    L("lv-11", "e04", "CONGE_ANNUEL", "2027-01-24", "2027-01-28", "APPROUVEE", { approverId: "e02", createdAt: "2026-11-05" }),
    L("lv-13", "e27", "CONGE_ANNUEL", "2026-11-29", "2026-12-03", "APPROUVEE", { approverId: "e25", createdAt: "2026-10-28" }),
  ];
}

/* ---------------- Work mode (présentiel / à distance) ---------------- */
/** One-off exceptions to the usual weekly pattern (`Employee.remoteWeekdays`), around the demo date. */
export function seedWorkModes(): WorkModeEntry[] {
  const W = (n: number, employeeId: string, date: string, mode: WorkModeEntry["mode"]): WorkModeEntry => ({ id: `wm-${n}`, employeeId, date, mode, setById: "u-amine" });
  return [
    W(1, "e04", "2026-11-15", "REMOTE"),
    W(2, "e07", "2026-11-15", "ONSITE"),
    W(3, "e11", "2026-11-16", "REMOTE"),
    W(4, "e12", "2026-11-15", "REMOTE"),
    W(5, "e18", "2026-11-15", "ONSITE"),
    W(6, "e24", "2026-11-16", "REMOTE"),
    W(7, "e33", "2026-11-17", "ONSITE"),
    W(8, "e36", "2026-11-15", "REMOTE"),
  ];
}

/* ---------------- Staffing requests ---------------- */
export function seedRequests(): StaffingRequest[] {
  const h = (ts: string, actorId: string, status: StaffingRequest["status"], note?: string) => ({ ts, actorId, status, note });
  const base = (o: Partial<StaffingRequest> & Pick<StaffingRequest, "id" | "reference" | "projectId" | "requesterId" | "gradeId" | "status">): StaffingRequest => ({
    quantity: 1, skillIds: [], startDate: "2026-12-01", endDate: "2027-01-28", allocationPct: 100, estimatedLoad: 40, priority: "NORMALE", justification: "", proposedEmployeeIds: [], createdAt: "2026-11-10", comments: [], history: [], ...o,
  });
  return [
    base({ id: "rqs-31", reference: "DS-2026-031", projectId: UNSTAFFED_PROJECT, requirementId: "rq-04-1", requesterId: "e02", gradeId: "g-3", skillIds: ["sk-audit-fin", "sk-ifrs"], allocationPct: 60, estimatedLoad: 34, priority: "URGENTE", justification: "Revue des comptes consolidés du groupe bancaire A : un Senior avec IFRS est requis dès le 1er décembre.", status: "SOUMISE", createdAt: "2026-11-13", history: [h("2026-11-13", "u-thomas", "SOUMISE")] }),
    base({ id: "rqs-32", reference: "DS-2026-032", projectId: UNSTAFFED_PROJECT, requirementId: "rq-04-2", requesterId: "e02", gradeId: "g-2", skillIds: ["sk-audit-fin"], estimatedLoad: 40, priority: "HAUTE", justification: "Appui à la revue de consolidation.", status: "EN_ANALYSE", handledById: "u-amine", createdAt: "2026-11-12", history: [h("2026-11-12", "u-thomas", "SOUMISE"), h("2026-11-13", "u-amine", "EN_ANALYSE", "Pris en charge — recherche de profils.")], comments: [{ id: "c1", authorId: "u-amine", ts: "2026-11-13", text: "Je lance le matching ; retour sous 48 h." }] }),
    base({ id: "rqs-27", reference: "DS-2026-027", projectId: projectId(11), requirementId: "rq-12-1", requesterId: "e35", gradeId: "g-3", skillIds: ["sk-valo", "sk-fin-mod"], startDate: "2027-01-17", endDate: "2027-03-18", estimatedLoad: 44, priority: "NORMALE", justification: "Mission d’évaluation confirmée pour janvier.", status: "SOUMISE", createdAt: "2026-11-09", history: [h("2026-11-09", "u-yacine", "SOUMISE")] }),
    base({ id: "rqs-25", reference: "DS-2026-025", projectId: projectId(5), requirementId: "rq-06-2", requesterId: "e15", gradeId: "g-3", quantity: 2, skillIds: ["sk-ifrs", "sk-audit-fin"], startDate: "2027-01-10", endDate: "2027-04-29", estimatedLoad: 150, priority: "HAUTE", justification: "Programme IFRS 9 : deux Seniors dès le démarrage.", status: "PROPOSITION_ENVOYEE", handledById: "u-amine", proposedEmployeeIds: ["e16", "e17"], createdAt: "2026-11-02", history: [h("2026-11-02", "u-sophie", "SOUMISE"), h("2026-11-05", "u-amine", "EN_ANALYSE"), h("2026-11-09", "u-amine", "PROPOSITION_ENVOYEE", "Deux profils proposés.")] }),
    base({ id: "rqs-21", reference: "DS-2026-021", projectId: projectId(9), requirementId: "rq-10-1", requesterId: "e30", gradeId: "g-3", skillIds: ["sk-etude"], startDate: "2026-12-13", endDate: "2027-02-11", estimatedLoad: 44, justification: "Étude de marché, démarrage 13 décembre.", status: "EN_ATTENTE_VALIDATION", handledById: "u-amine", proposedEmployeeIds: ["e32"], createdAt: "2026-10-28", history: [h("2026-10-28", "u-sophie", "SOUMISE"), h("2026-11-04", "u-amine", "PROPOSITION_ENVOYEE"), h("2026-11-10", "u-amine", "EN_ATTENTE_VALIDATION", "Réservation soft créée — validation du Partner attendue.")] }),
    base({ id: "rqs-18", reference: "DS-2026-018", projectId: projectId(12), requirementId: "rq-13-3", requesterId: "e03", gradeId: "g-1", skillIds: ["sk-compta"], allocationPct: 40, startDate: "2026-10-25", endDate: "2027-01-21", estimatedLoad: 38, status: "SATISFAITE", handledById: "u-amine", proposedEmployeeIds: ["e11"], createdAt: "2026-10-12", history: [h("2026-10-12", "u-nabil", "SOUMISE"), h("2026-10-15", "u-amine", "APPROUVEE"), h("2026-10-16", "u-amine", "SATISFAITE", "Besoin couvert par une affectation confirmée.")] }),
    base({ id: "rqs-15", reference: "DS-2026-015", projectId: projectId(8), requirementId: "rq-09-3", requesterId: "e30", gradeId: "g-2", skillIds: ["sk-etude"], startDate: "2026-12-01", endDate: "2027-01-14", estimatedLoad: 30, justification: "Renfort ponctuel.", status: "REJETEE", handledById: "u-amine", createdAt: "2026-10-20", history: [h("2026-10-20", "u-yacine", "SOUMISE"), h("2026-10-24", "u-amine", "REJETEE", "Besoin reporté par le client — demande clôturée.")] }),
    base({ id: "rqs-33", reference: "DS-2026-033", projectId: projectId(2), requirementId: "rq-03-1", requesterId: "e02", gradeId: "g-3", skillIds: ["sk-audit-int", "sk-ctrl-int"], startDate: "2026-12-06", endDate: "2027-02-25", estimatedLoad: 55, justification: "Brouillon — à finaliser avec les compétences attendues.", status: "BROUILLON", createdAt: "2026-11-14", history: [] }),
  ];
}

/* ---------------- Notifications & audit ---------------- */
export function pushNotification(s: AppState, userId: string, kind: NotificationKind, title: string, body: string, href: string, opts: { read?: boolean; email?: boolean; createdAt?: string } = {}) {
  const n: Notification = { id: nextId(s, "nt"), userId, kind, title, body, href, createdAt: opts.createdAt ?? s.now, read: opts.read ?? false, email: opts.email };
  s.notifications.unshift(n);
  if (opts.email) s.emailLog.unshift({ id: nextId(s, "em"), ts: n.createdAt, toUserId: userId, subject: title });
  return n;
}

export function seedNotificationsAndAudit(s: AppState) {
  const pid = (i: number) => projectId(i);
  const N = (u: string, k: NotificationKind, t: string, b: string, h: string, o: { read?: boolean; email?: boolean; createdAt?: string } = {}) => pushNotification(s, u, k, t, b, h, o);
  N("u-amine", "REQUEST", "Nouvelle demande de staffing DS-2026-031", "Revue des comptes consolidés — 1 Senior (IFRS), urgent.", "/app/demandes", { email: true, createdAt: "2026-11-13" });
  N("u-amine", "UNSTAFFED", "Mission sans équipe complète", "« Revue des comptes consolidés » démarre le 1er décembre et n’a aucun collaborateur affecté.", `/app/missions/${pid(3)}`, { createdAt: "2026-11-14" });
  N("u-amine", "CONFLICT", "Conflit de planning — Rania Mekki", "Congé approuvé du 1er déc. au 7 janv. sur la mission Banque régionale B.", "/app/planning", { createdAt: "2026-11-14" });
  N("u-amine", "OVERLOAD", "Surcharge — Hakim Ouali", "120 % de charge planifiée jusqu’au 21 janvier (exception enregistrée).", "/app/planning", { createdAt: "2026-11-10", read: true });
  N("u-amine", "ASSIGNMENT", "Réservation à expirer", "La réservation d’Anis Benali expire le 20 novembre.", "/app/planning", { createdAt: "2026-11-14" });
  N("u-sophie", "CERTIFICATION", "Certification expirant bientôt", "Certificat IFRS — niveau avancé de Claire Moreau expire le 5 décembre (20 jours).", "/app/collaborateurs/e04", { createdAt: "2026-11-15", email: true });
  N("u-sophie", "CERTIFICATION", "Certification expirant bientôt", "Certificat IFRS — niveau avancé de Yanis Khelifi expire le 12 décembre.", "/app/collaborateurs/e08", { createdAt: "2026-11-15" });
  N("u-claire", "CERTIFICATION", "Votre certification IFRS expire le 5 décembre", "Pensez à planifier le renouvellement.", "/app/collaborateurs/e04", { createdAt: "2026-11-15" });
  N("u-claire", "ASSIGNMENT", "Affectation confirmée", "Audit légal 2026 — Groupe bancaire A, 60 % jusqu’au 25 mars.", `/app/missions/${pid(0)}`, { createdAt: "2026-10-02", read: true });
  N("u-yacine", "REQUEST", "Demande urgente ouverte", "DS-2026-031 — Revue des comptes consolidés.", "/app/demandes", { createdAt: "2026-11-13" });
  N("u-samira", "REQUEST", "Proposition à approuver", "DS-2026-021 — Étude de marché : proposition de Nawel Hammoudi.", "/app/demandes", { createdAt: "2026-11-10" });
  N("u-karim", "SYSTEM", "Sauvegarde du journal d’audit", "Le journal d’audit est conservé sans limite (fonction de démonstration).", "/app/admin/audit", { createdAt: "2026-11-01", read: true });

  const A = (actor: string, action: string, entity: string, id: string, label: string, ts: string, extra: { before?: Record<string, unknown>; after?: Record<string, unknown>; reason?: string } = {}) => {
    const keep = s.now;
    s.now = ts;
    writeAudit(s, { actorId: actor, action, entity, entityId: id, label, ...extra });
    s.now = keep;
  };
  A("u-amine", "assignment.create", "Affectation", "a-001", "Thomas Dubois → Audit légal 2026 (40 %)", "2026-10-01", { after: { status: "HARD", allocationPct: 40 } });
  A("u-amine", "assignment.create", "Affectation", "a-005", "Lucas Bernard → Audit légal 2026 (60 %)", "2026-10-01", { after: { status: "HARD", allocationPct: 60 } });
  A("u-amine", "assignment.exception", "Affectation", "a-010", "Hakim Ouali → Banque régionale B (50 %) — dépassement 120 %", "2026-11-03", { before: { totalAllocation: 70 }, after: { totalAllocation: 120, status: "HARD" }, reason: "Besoin client critique : continuité de l’équipe d’audit pendant la clôture. Surcharge acceptée jusqu’au 31 janvier." });
  A("u-karim", "role.update", "Rôle", "MANAGER", "Rôle Manager — permission « planning.edit » activée", "2026-09-30", { before: { "planning.edit": false }, after: { "planning.edit": true } });
  A("u-sophie", "employee.update", "Collaborateur", "e12", "Meriem Tazi — fin de CDD reportée au 31 mars 2027", "2026-10-15", { before: { endDate: "2026-12-31" }, after: { endDate: "2027-03-31" } });
  A("u-amine", "assignment.softbook", "Affectation", "a-011", "Anis Benali → Audit interne Assureur C (réservation 100 %)", "2026-11-13", { after: { status: "SOFT", softExpiresAt: "2026-11-20" } });
  A("u-sophie", "import.employees", "Import", "imp-1", "Import de 6 collaborateurs (1 erreur corrigée)", "2026-09-05", { after: { importes: 6, erreurs: 1 } });
}

export { weekStart };
