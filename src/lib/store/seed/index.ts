/* Deterministic seed (spec 9). Same input → same state. Four scenarios (spec 4). */
import { plannedHoursFor } from "../../engine/capacity";
import { addDays, weekStart } from "../../engine/dates";
import { blankState } from "../blank";
import type { AppState, Assignment, Scenario } from "../types";
import { seedLeaves, seedEvaluations, seedMarketplace, seedNotificationsAndAudit, seedRequests, seedTimesheets } from "./activity";
import { buildAssignments, buildMissions, documentsFor, pipelineBase, projectId } from "./missions";
import { buildPeople, users } from "./people";
import { certifications, clients, departments, grades, holidays, offices, skillCategories, skills } from "./referentials";

export const SCENARIO_NOW: Record<Scenario, string> = { 1: "2026-11-15", 2: "2026-11-15", 3: "2026-11-15", 4: "2026-12-13" };
export const SCENARIO_LABEL: Record<Scenario, string> = {
  1: "Démarrage — peu d’affectations",
  2: "Activité normale",
  3: "Pic de charge — conflits et déficits",
  4: "Fin d’année — prévisions de recrutement",
};

export function buildSeed(scenario: Scenario = 2, keepUserId: string | null = null): AppState {
  const s = blankState();
  s.scenario = scenario;
  s.now = SCENARIO_NOW[scenario];
  s.departments = structuredClone(departments);
  s.offices = structuredClone(offices);
  s.grades = structuredClone(grades);
  s.skillCategories = structuredClone(skillCategories);
  s.skills = structuredClone(skills);
  s.certifications = structuredClone(certifications);
  s.clients = structuredClone(clients);
  s.holidays = structuredClone(holidays);
  s.users = structuredClone(users);
  Object.assign(s, buildPeople());
  s.settings.utilizationTargets.byDepartment = { "d-aud": 80, "d-ec": 78, "d-cjf": 75, "d-sc": 78, "d-trx": 80 };
  const m = buildMissions();
  s.projects = m.projects;
  s.requirements = m.requirements;
  s.leaves = seedLeaves();
  s.assignments = buildAssignments(s.projects, s.requirements, (empId, st, en, pct) => {
    const e = s.employees.find((x) => x.id === empId)!;
    return plannedHoursFor(s, e, st, en, pct);
  });
  s.pipeline = structuredClone(pipelineBase);
  s.requests = seedRequests();
  s.evaluations = seedEvaluations();
  Object.assign(s, seedMarketplace());
  s.documents = documentsFor(s.projects);

  applyScenario(s, scenario);

  const toWeek = addDays(weekStart(s.now), -7);
  const weeks = scenario === 1 ? 3 : 8;
  const ts = seedTimesheets(s, addDays(toWeek, -(weeks - 1) * 7), toWeek);
  s.timesheets = ts.timesheets;
  s.entries = ts.entries;

  seedNotificationsAndAudit(s);
  s.users.forEach((u) => {
    s.notificationPrefs[u.id] = Object.fromEntries(["REQUEST", "ASSIGNMENT", "MISSION", "MARKETPLACE", "LEAVE", "TIMESHEET", "CONFLICT", "OVERLOAD", "CERTIFICATION", "UNSTAFFED"].map((k) => [k, { inApp: true, email: ["REQUEST", "TIMESHEET", "CERTIFICATION"].includes(k) }]));
  });
  s.session.userId = keepUserId;
  return s;
}

/* ---------- scenarios ---------- */
function applyScenario(s: AppState, scenario: Scenario) {
  const asg = (id: string, employeeId: string, projIdx: number, pct: number, status: Assignment["status"], start: string, end: string, extra: Partial<Assignment> = {}): Assignment => {
    const e = s.employees.find((x) => x.id === employeeId)!;
    return { id, employeeId, projectId: projectId(projIdx - 1), startDate: start, endDate: end, allocationPct: pct, plannedHours: plannedHoursFor(s, e, start, end, pct), status, createdAt: "2026-11-01", validatedById: status === "HARD" ? "u-amine" : undefined, ...extra };
  };
  if (scenario === 1) {
    // Few assignments: only the two audit missions and the due diligence are staffed.
    const keep = new Set([projectId(0), projectId(10), projectId(14)]);
    s.assignments = s.assignments.filter((a) => keep.has(a.projectId) || a.status === "TERMINEE").filter((a) => !(a.projectId === projectId(0) && ["e01", "e07"].includes(a.employeeId)));
    s.projects.forEach((p) => {
      if (p.status === "ACTIVE" && !keep.has(p.id)) p.status = p.startDate <= s.now ? "EN_ATTENTE_STAFFING" : "A_VENIR";
    });
    s.requests = s.requests.filter((r) => ["rqs-31", "rqs-27", "rqs-33"].includes(r.id));
    s.leaves = s.leaves.filter((l) => !["lv-02", "lv-08", "lv-14"].includes(l.id));
  }
  if (scenario === 3) {
    // Peak: overloads, unsatisfied urgent requests, pending leaves, bigger pipeline.
    s.assignments.push(
      asg("a-901", "e07", 3, 80, "HARD", "2026-12-06", "2027-02-25"),
      asg("a-902", "e04", 6, 50, "HARD", "2027-01-10", "2027-03-25"),
      asg("a-903", "e16", 6, 100, "HARD", "2027-01-10", "2027-04-29"),
      asg("a-904", "e24", 12, 60, "HARD", "2027-01-17", "2027-03-18"),
      asg("a-905", "e37", 12, 70, "HARD", "2027-01-17", "2027-03-18"),
      asg("a-906", "e31", 10, 100, "HARD", "2026-12-13", "2027-02-11"),
      asg("a-907", "e18", 6, 60, "HARD", "2027-01-10", "2027-03-31"),
    );
    s.projects.forEach((p) => {
      if (["p-06", "p-10", "p-12"].includes(p.id)) p.certainty = "CONFIRMEE";
    });
    ["rqs-31", "rqs-27", "rqs-33"].forEach((id) => {
      const r = s.requests.find((x) => x.id === id)!;
      r.priority = "URGENTE";
      if (r.status === "BROUILLON") r.status = "SOUMISE";
    });
    s.leaves.push({ id: "lv-90", employeeId: "e07", type: "CONGE_ANNUEL", startDate: "2026-12-20", endDate: "2027-01-03", status: "SOUMISE", createdAt: "2026-11-14" }, { id: "lv-91", employeeId: "e37", type: "FORMATION", startDate: "2027-01-10", endDate: "2027-01-14", status: "APPROUVEE", approverId: "e36", createdAt: "2026-11-10" });
    s.pipeline.push({ id: "pl-7", name: "Contrôle de gestion — Groupe R", clientLabel: "Groupe R", departmentId: "d-aud", sector: "Industrie", certainty: "CONFIRMEE", startDate: "2027-01-10", endDate: "2027-04-30", needs: [{ gradeId: "g-3", quantity: 2, skillIds: ["sk-audit-fin"], allocationPct: 100 }, { gradeId: "g-4", quantity: 1, skillIds: ["sk-audit-fin"], allocationPct: 60 }] });
  }
  if (scenario === 4) {
    s.assignments.forEach((a) => {
      if (a.status === "HARD" && a.endDate < s.now) a.status = "TERMINEE";
    });
    s.projects.forEach((p) => {
      if (p.endDate < s.now && p.status === "ACTIVE") p.status = "TERMINEE";
      if (p.startDate <= s.now && p.status === "A_VENIR") p.status = "ACTIVE";
    });
    s.assignments = s.assignments.filter((a) => !(a.status === "SOFT" && a.softExpiresAt && a.softExpiresAt < s.now));
    s.leaves.push({ id: "lv-92", employeeId: "e04", type: "CONGE_ANNUEL", startDate: "2026-12-20", endDate: "2027-01-02", status: "APPROUVEE", approverId: "e02", createdAt: "2026-11-20" });
    s.pipeline.push(
      { id: "pl-7", name: "Programme conformité bancaire 2027", clientLabel: "Groupe bancaire S", departmentId: "d-ec", sector: "Banque & assurance", certainty: "CONFIRMEE", startDate: "2027-02-01", endDate: "2027-07-30", needs: [{ gradeId: "g-3", quantity: 3, skillIds: ["sk-ifrs", "sk-banq"], allocationPct: 100 }, { gradeId: "g-4", quantity: 1, skillIds: ["sk-ifrs"], allocationPct: 60 }, { gradeId: "g-2", quantity: 3, skillIds: ["sk-compta"], allocationPct: 100 }] },
      { id: "pl-8", name: "Audit des filiales — Groupe T", clientLabel: "Groupe T", departmentId: "d-aud", sector: "Industrie", certainty: "PROBABLE", startDate: "2027-03-01", endDate: "2027-08-31", needs: [{ gradeId: "g-3", quantity: 3, skillIds: ["sk-audit-fin"], allocationPct: 100 }, { gradeId: "g-1", quantity: 3, skillIds: ["sk-compta"], allocationPct: 100 }] },
      { id: "pl-9", name: "Cession d’actifs — Fonds U", clientLabel: "Fonds U", departmentId: "d-trx", sector: "Immobilier", certainty: "OPPORTUNITE", startDate: "2027-04-01", endDate: "2027-07-15", needs: [{ gradeId: "g-4", quantity: 1, skillIds: ["sk-dd"], allocationPct: 60 }, { gradeId: "g-3", quantity: 2, skillIds: ["sk-dd"], allocationPct: 100 }] },
    );
  }
}
export { projectId };
