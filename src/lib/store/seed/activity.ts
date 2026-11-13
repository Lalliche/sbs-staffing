/* Leaves, timesheets, requests, evaluations, marketplace, notifications and audit seed. */
import { calendarOf, dailyHours, isWorkingDay, absenceDaySet } from "../../engine/capacity";
import { addDays, eachDay, weekStart } from "../../engine/dates";
import { writeAudit } from "../../engine/audit";
import { nextId } from "../../engine/ids";
import type { ActivityType, AppState, Application, Evaluation, LeaveRequest, Notification, NotificationKind, Opportunity, StaffingRequest, Timesheet, TimesheetEntry } from "../types";
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

export function seedLeaves(): LeaveRequest[] {
  return [
    L("lv-01", "e05", "CONGE_ANNUEL", "2026-12-01", "2027-01-07", "APPROUVEE", { approverId: "e03", createdAt: "2026-10-20", comment: "Congé de fin d’année validé." }),
    L("lv-02", "e16", "CONGE_ANNUEL", "2026-12-14", "2027-01-20", "SOUMISE", { createdAt: "2026-11-12" }),
    L("lv-03", "e08", "MALADIE", "2026-11-10", "2026-11-11", "APPROUVEE", { approverId: "e02", createdAt: "2026-11-10" }),
    L("lv-04", "e11", "CONGE_ANNUEL", "2026-12-27", "2027-01-07", "SOUMISE", { createdAt: "2026-11-13" }),
    L("lv-05", "e17", "FORMATION", "2026-11-22", "2026-11-24", "APPROUVEE", { approverId: "e15", createdAt: "2026-10-30" }),
    L("lv-06", "e24", "CONGE_ANNUEL", "2026-12-06", "2026-12-17", "REFUSEE", { approverId: "e23", createdAt: "2026-11-02", comment: "Période de clôture fiscale : merci de proposer d’autres dates." }),
    L("lv-07", "e31", "CONGE_ANNUEL", "2026-12-20", "2026-12-31", "APPROUVEE", { approverId: "e30", createdAt: "2026-10-12" }),
    L("lv-08", "e09", "EXCEPTIONNEL", "2026-11-24", "2026-11-24", "SOUMISE", { createdAt: "2026-11-14" }),
    L("lv-09", "e20", "CONGE_ANNUEL", "2026-10-11", "2026-10-15", "APPROUVEE", { approverId: "e17", createdAt: "2026-09-10" }),
    L("lv-10", "e38", "CONGE_ANNUEL", "2026-10-25", "2026-10-29", "APPROUVEE", { approverId: "e37", createdAt: "2026-09-20" }),
    L("lv-11", "e04", "CONGE_ANNUEL", "2027-01-24", "2027-01-28", "APPROUVEE", { approverId: "e02", createdAt: "2026-11-05" }),
    L("lv-12", "e04", "FORMATION", "2027-02-14", "2027-02-15", "BROUILLON", { createdAt: "2026-11-14" }),
    L("lv-13", "e27", "CONGE_ANNUEL", "2026-11-29", "2026-12-03", "APPROUVEE", { approverId: "e25", createdAt: "2026-10-28" }),
    L("lv-14", "e13", "DEPLACEMENT", "2026-12-08", "2026-12-09", "SOUMISE", { createdAt: "2026-11-14" }),
  ];
}

/* ---------------- Timesheets ---------------- */
const INTERNAL: { code: string; type: ActivityType; label: string }[] = [
  { code: "INT-ADM", type: "ADMINISTRATIF", label: "Administratif interne" },
  { code: "INT-FORM", type: "FORMATION", label: "Formation interne" },
  { code: "INT-BD", type: "COMMERCIAL", label: "Développement commercial" },
];
const ACT: ActivityType[] = ["REALISATION", "REALISATION", "REVUE", "PREPARATION", "REUNION_CLIENT"];
const DESC = ["Travaux de contrôle", "Revue des dossiers", "Préparation des livrables", "Réunion avec le client", "Analyse des écritures", "Mise à jour du planning mission"];

export function seedTimesheets(s: AppState, fromWeek: string, toWeek: string) {
  const rnd = mulberry32(20261115);
  const timesheets: Timesheet[] = [];
  const entries: TimesheetEntry[] = [];
  let ei = 0;
  const managerUser = (empId: string) => {
    const mgr = s.employees.find((e) => e.id === empId)?.managerId;
    return s.users.find((u) => u.employeeId === mgr)?.id ?? "u-thomas";
  };
  for (const emp of s.employees) {
    if (emp.status === "ARCHIVE") continue;
    for (let w = fromWeek; w <= toWeek; w = addDays(w, 7)) {
      const days = eachDay(w, addDays(w, 6));
      const cal = calendarOf(s, emp);
      const dh = dailyHours(emp, cal);
      const tsId = `ts-${emp.id}-${w}`;
      const abs = absenceDaySet(s, emp.id, w, addDays(w, 6));
      const rows: TimesheetEntry[] = [];
      for (const d of days) {
        if (!isWorkingDay(emp, cal, d) || abs.has(d)) continue;
        const active = s.assignments.filter((a) => a.employeeId === emp.id && (a.status === "HARD" || a.status === "TERMINEE") && a.startDate <= d && a.endDate >= d);
        let used = 0;
        for (const a of active) {
          const h = Math.round(((dh * a.allocationPct) / 100) * (0.92 + rnd() * 0.16) * 2) / 2;
          if (h <= 0) continue;
          used += h;
          rows.push({ id: `te-${++ei}`, timesheetId: tsId, projectId: a.projectId, date: d, hours: h, billable: true, activityType: ACT[Math.floor(rnd() * ACT.length)], description: DESC[Math.floor(rnd() * DESC.length)] });
        }
        const room = dh - used;
        if (room >= 1) {
          const target = active.length ? Math.min(room, 1) : Math.min(room, 3 + Math.floor(rnd() * 2));
          const it = INTERNAL[active.length ? 0 : Math.floor(rnd() * 3)];
          rows.push({ id: `te-${++ei}`, timesheetId: tsId, projectId: it.code, date: d, hours: Math.round(target * 2) / 2, billable: false, activityType: it.type, description: it.label });
        }
      }
      const last = w === toWeek;
      let status: Timesheet["status"] = "VALIDE";
      if (last) status = emp.managerId && ["e02", "e03", "e15", "e23"].includes(emp.managerId) ? "SOUMIS" : "VALIDE";
      if (emp.id === "e11" && last) status = "BROUILLON"; // Lucas has not submitted last week → reminder
      if (emp.id === "e12" && last) status = "BROUILLON";
      const ts: Timesheet = {
        id: tsId,
        employeeId: emp.id,
        weekStart: w,
        status,
        submittedAt: status !== "BROUILLON" ? addDays(w, 7) : undefined,
        validatedById: status === "VALIDE" ? managerUser(emp.id) : undefined,
        validatedAt: status === "VALIDE" ? addDays(w, 8) : undefined,
        corrections: [],
      };
      // Storyline anomalies on the last week
      if (last && emp.id === "e08") rows.push({ id: `te-${++ei}`, timesheetId: tsId, projectId: projectId(0), date: "2026-11-10", hours: 8, billable: true, activityType: "REALISATION", description: "Travaux de contrôle (saisi pendant le congé maladie)" });
      if (last && emp.id === "e06") rows.push({ id: `te-${++ei}`, timesheetId: tsId, projectId: projectId(12), date: "2026-11-09", hours: 4, billable: true, activityType: "REALISATION", description: "Heures supplémentaires — clôture" });
      timesheets.push(ts);
      entries.push(...rows);
    }
  }
  return { timesheets, entries };
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

/* ---------------- Evaluations (light) ---------------- */
export function seedEvaluations(): Evaluation[] {
  const c = (q: number, d: number, t: number, a: number, m: number, e: number, r: number, p: number) => ({ quality: q, deadlines: d, technical: t, autonomy: a, communication: m, teamwork: e, clientRelation: r, responsibility: p }) as Evaluation["criteria"];
  const mk = (id: string, employeeId: string, projIdx: number, evaluatorId: string, criteria: Evaluation["criteria"], strengths: string, improvements: string, training: string, confidential: boolean, createdAt: string): Evaluation => ({
    id, employeeId, projectId: projectId(projIdx), evaluatorId, criteria, strengths, improvements, trainingRecommendation: training, confidential, createdAt,
  });
  return [
    mk("ev-1", "e04", 14, "u-thomas", c(5, 4, 5, 4, 4, 5, 4, 4), "Rigueur et autonomie sur les travaux de consolidation.", "Déléguer davantage aux consultants.", "Formation IFRS — renouvellement.", false, "2026-07-08"),
    mk("ev-2", "e05", 14, "u-thomas", c(4, 4, 4, 5, 4, 4, 3, 4), "Excellente maîtrise technique.", "Renforcer la relation client.", "", false, "2026-07-08"),
    mk("ev-3", "e08", 14, "u-thomas", c(3, 4, 3, 3, 4, 5, 3, 3), "Très bon esprit d’équipe.", "Gagner en autonomie sur les tests de détail.", "Atelier d’audit des cycles clés.", true, "2026-07-09"),
    mk("ev-4", "e11", 14, "u-thomas", c(3, 3, 3, 3, 4, 4, undefined as never, 3), "Apprend vite, curieux.", "Soigner la documentation des travaux.", "Parcours d’intégration audit.", false, "2026-07-09"),
    mk("ev-5", "e32", 13, "u-yacine", c(4, 4, 4, 4, 5, 4, 5, 4), "Aisance dans les ateliers clients.", "Structurer davantage les synthèses.", "", false, "2026-10-20"),
    mk("ev-6", "e33", 13, "u-yacine", c(4, 3, 4, 4, 4, 4, 4, 3), "Bonne analyse de données.", "Respect des délais intermédiaires.", "Formation avancée en BI.", true, "2026-10-20"),
    mk("ev-7", "e34", 13, "u-yacine", c(3, 4, 3, 3, 4, 5, 3, 3), "Fiable et appliquée.", "Prendre l’initiative en réunion.", "", false, "2026-10-21"),
    mk("ev-8", "e02", 14, "u-samira", c(5, 5, 5, 5, 5, 5, 5, 5), "Pilotage exemplaire de la mission.", "—", "", true, "2026-07-10"),
  ];
}

/* ---------------- Marketplace ---------------- */
export function seedMarketplace(): { opportunities: Opportunity[]; applications: Application[] } {
  const opportunities: Opportunity[] = [
    { id: "op-1", projectId: projectId(9), title: "Étude de marché — agroalimentaire (Consultant)", publisherId: "u-yacine", departmentId: "d-sc", description: "Entretiens experts, benchmark concurrentiel et sizing du marché national. Équipe de 4 personnes.", skillIds: ["sk-etude", "sk-bi"], startDate: "2026-12-13", endDate: "2027-02-11", allocationPct: 100, deadline: "2026-11-25", status: "OUVERTE", createdAt: "2026-11-08" },
    { id: "op-2", projectId: projectId(2), title: "Audit interne — assurance (Senior ou Consultant)", publisherId: "u-nabil", departmentId: "d-aud", description: "Cartographie des processus, tests de contrôle et restitution au comité d’audit.", skillIds: ["sk-audit-int", "sk-ctrl-int"], startDate: "2026-12-06", endDate: "2027-02-25", allocationPct: 100, deadline: "2026-11-27", status: "OUVERTE", createdAt: "2026-11-09" },
    { id: "op-3", title: "Appui analyse de données — audit SI (Junior)", publisherId: "u-thomas", departmentId: "d-aud", projectId: projectId(12), description: "Extraction et contrôle de volumes de données, restitution sous forme de tableaux de bord.", skillIds: ["sk-data", "sk-bi"], startDate: "2026-12-01", endDate: "2027-01-21", allocationPct: 40, deadline: "2026-11-22", status: "OUVERTE", createdAt: "2026-11-11" },
  ];
  const applications: Application[] = [
    { id: "ap-1", opportunityId: "op-2", employeeId: "e09", motivation: "Je souhaite développer mes compétences en audit interne.", status: "ENVOYEE", createdAt: "2026-11-12" },
    { id: "ap-2", opportunityId: "op-1", employeeId: "e33", motivation: "Mon expérience sur le plan stratégique télécoms est directement transposable.", status: "ENVOYEE", createdAt: "2026-11-13" },
  ];
  return { opportunities, applications };
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
  N("u-amine", "LEAVE", "Demande de congé en attente", "Sofiane Djebbar — du 14 déc. au 20 janv. (impacte le matching).", "/app/disponibilites", { createdAt: "2026-11-12" });
  N("u-thomas", "TIMESHEET", "Timesheets à valider", "7 feuilles de temps de la semaine du 8 novembre attendent votre validation.", "/app/timesheets", { createdAt: "2026-11-14", email: true });
  N("u-thomas", "LEAVE", "Demande de congé", "Lucas Bernard demande un congé du 27 décembre au 7 janvier.", "/app/disponibilites", { createdAt: "2026-11-13" });
  N("u-thomas", "MARKETPLACE", "Nouvelle candidature", "Imane Zerrouki a postulé à « Audit interne — assurance ».", "/app/marketplace", { createdAt: "2026-11-12" });
  N("u-sophie", "CERTIFICATION", "Certification expirant bientôt", "Certificat IFRS — niveau avancé de Claire Moreau expire le 5 décembre (20 jours).", "/app/collaborateurs/e04", { createdAt: "2026-11-15", email: true });
  N("u-sophie", "CERTIFICATION", "Certification expirant bientôt", "Certificat IFRS — niveau avancé de Yanis Khelifi expire le 12 décembre.", "/app/collaborateurs/e08", { createdAt: "2026-11-15" });
  N("u-sophie", "LEAVE", "Demandes de congé à examiner", "4 demandes en attente.", "/app/disponibilites", { createdAt: "2026-11-14" });
  N("u-claire", "CERTIFICATION", "Votre certification IFRS expire le 5 décembre", "Pensez à planifier le renouvellement.", "/app/collaborateurs/e04", { createdAt: "2026-11-15" });
  N("u-claire", "ASSIGNMENT", "Affectation confirmée", "Audit légal 2026 — Groupe bancaire A, 60 % jusqu’au 25 mars.", `/app/missions/${pid(0)}`, { createdAt: "2026-10-02", read: true });
  N("u-claire", "LEAVE", "Congé approuvé", "Du 24 au 28 janvier 2027.", "/app/disponibilites", { createdAt: "2026-11-06", read: true });
  N("u-lucas", "TIMESHEET", "Timesheet non soumis", "La semaine du 8 novembre n’est pas encore soumise.", "/app/timesheets", { createdAt: "2026-11-14", email: true });
  N("u-lucas", "MARKETPLACE", "Nouvelle opportunité", "« Appui analyse de données — audit SI » correspond à votre profil.", "/app/marketplace", { createdAt: "2026-11-11" });
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
  A("u-thomas", "leave.approve", "Congé", "lv-03", "Yanis Khelifi — maladie du 10 au 11 nov.", "2026-11-10", { before: { status: "SOUMISE" }, after: { status: "APPROUVEE" } });
  A("u-nabil", "leave.approve", "Congé", "lv-01", "Rania Mekki — congé annuel du 1er déc. au 7 janv.", "2026-10-22", { before: { status: "SOUMISE" }, after: { status: "APPROUVEE" } });
  A("u-karim", "role.update", "Rôle", "MANAGER", "Rôle Manager — permission « timesheet.validate » activée", "2026-09-30", { before: { "timesheet.validate": false }, after: { "timesheet.validate": true } });
  A("u-sophie", "employee.update", "Collaborateur", "e12", "Meriem Tazi — fin de CDD reportée au 31 mars 2027", "2026-10-15", { before: { endDate: "2026-12-31" }, after: { endDate: "2027-03-31" } });
  A("u-amine", "assignment.softbook", "Affectation", "a-011", "Anis Benali → Audit interne Assureur C (réservation 100 %)", "2026-11-13", { after: { status: "SOFT", softExpiresAt: "2026-11-20" } });
  A("u-thomas", "timesheet.validate", "Timesheet", "ts-e04-2026-11-01", "Claire Moreau — semaine du 1er novembre", "2026-11-09", { before: { status: "SOUMIS" }, after: { status: "VALIDE" } });
  A("u-sophie", "import.employees", "Import", "imp-1", "Import de 6 collaborateurs (1 erreur corrigée)", "2026-09-05", { after: { importes: 6, erreurs: 1 } });
}

export { weekStart };
