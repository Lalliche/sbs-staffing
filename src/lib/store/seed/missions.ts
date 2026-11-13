/* 15 fictional missions with their staffing requirements and (hand-placed) assignments. */
import type { Assignment, Certainty, DocumentMeta, PipelineItem, Priority, Project, ProjectStatus, StaffingRequirement } from "../types";

type Req = [gradeRank: number, qty: number, pct: number, mand: string, desired: string, minExp: number, fullTime?: boolean, start?: string, end?: string];
interface P {
  n: number; // seq for ref/otp
  year: 2026 | 2027;
  name: string;
  client: string;
  dept: string;
  lead: string;
  type: string;
  prio: Priority;
  start: string;
  end: string;
  days: number;
  budgetM: number; // millions DZD
  cert: Certainty;
  status: ProjectStatus;
  sector: string;
  reqs: Req[];
}
const S = (codes: string) => (codes ? codes.split(",").map((c) => `sk-${c}`) : []);

const PROJECTS: P[] = [
  { n: 1, year: 2026, name: "Audit légal 2026 — Groupe bancaire A", client: "cl-a", dept: "d-aud", lead: "e02", type: "Audit légal", prio: "HAUTE", start: "2026-10-04", end: "2027-03-25", days: 310, budgetM: 38, cert: "CONFIRMEE", status: "ACTIVE", sector: "Banque & assurance", reqs: [[4, 1, 40, "audit-fin", "banq", 8], [3, 2, 60, "audit-fin,ifrs", "banq", 5], [2, 1, 100, "audit-fin", "data", 2], [1, 1, 60, "compta", "", 0]] },
  { n: 2, year: 2026, name: "Audit des comptes — Banque régionale B", client: "cl-b", dept: "d-aud", lead: "e03", type: "Audit légal", prio: "NORMALE", start: "2026-11-01", end: "2027-02-25", days: 190, budgetM: 21, cert: "CONFIRMEE", status: "ACTIVE", sector: "Banque & assurance", reqs: [[4, 1, 30, "audit-fin", "", 8], [3, 1, 100, "audit-fin,ifrs", "banq", 5], [2, 1, 100, "audit-fin", "", 2]] },
  { n: 3, year: 2026, name: "Audit interne — Assureur C", client: "cl-c", dept: "d-aud", lead: "e03", type: "Audit interne", prio: "NORMALE", start: "2026-12-06", end: "2027-02-25", days: 120, budgetM: 14, cert: "CONFIRMEE", status: "A_VENIR", sector: "Banque & assurance", reqs: [[3, 1, 100, "audit-int,ctrl-int", "risk", 5], [1, 1, 100, "compta", "", 0]] },
  { n: 4, year: 2026, name: "Revue des comptes consolidés — Groupe bancaire A", client: "cl-a", dept: "d-aud", lead: "e02", type: "Audit contractuel", prio: "URGENTE", start: "2026-12-01", end: "2027-01-28", days: 70, budgetM: 11, cert: "CONFIRMEE", status: "EN_ATTENTE_STAFFING", sector: "Banque & assurance", reqs: [[3, 1, 60, "audit-fin,ifrs", "banq", 5], [2, 1, 100, "audit-fin", "conso", 2]] },
  { n: 5, year: 2026, name: "Tenue et révision comptable — Industriel D", client: "cl-d", dept: "d-ec", lead: "e15", type: "Tenue comptable", prio: "NORMALE", start: "2026-09-06", end: "2027-06-30", days: 520, budgetM: 26, cert: "CONFIRMEE", status: "ACTIVE", sector: "Industrie", reqs: [[3, 1, 40, "compta,ifrs", "", 5], [2, 2, 100, "compta", "tva", 2], [1, 1, 100, "compta", "", 0]] },
  { n: 12, year: 2027, name: "Mise en conformité IFRS 9 — Banque régionale B", client: "cl-b", dept: "d-ec", lead: "e15", type: "Conseil comptable", prio: "HAUTE", start: "2027-02-07", end: "2027-05-27", days: 150, budgetM: 19, cert: "PROBABLE", status: "A_VENIR", sector: "Banque & assurance", reqs: [[4, 1, 50, "ifrs", "banq", 8], [3, 2, 100, "ifrs,audit-fin", "banq", 5]] },
  { n: 7, year: 2026, name: "Conseil fiscal — Groupe énergétique E", client: "cl-e", dept: "d-cjf", lead: "e23", type: "Conseil fiscal", prio: "NORMALE", start: "2026-10-18", end: "2027-01-28", days: 110, budgetM: 12, cert: "CONFIRMEE", status: "ACTIVE", sector: "Énergie", reqs: [[4, 1, 40, "fisc-ent", "fisc-int", 8], [3, 1, 100, "fisc-ent", "tva", 5], [2, 1, 60, "fisc-ent", "", 2]] },
  { n: 8, year: 2026, name: "Restructuration juridique — Distributeur G", client: "cl-g", dept: "d-cjf", lead: "e22", type: "Juridique", prio: "NORMALE", start: "2026-11-08", end: "2027-02-18", days: 95, budgetM: 10, cert: "CONFIRMEE", status: "ACTIVE", sector: "Distribution", reqs: [[3, 1, 60, "soc,com", "", 5], [2, 1, 100, "com", "", 2]] },
  { n: 9, year: 2026, name: "Plan stratégique — Opérateur télécoms F", client: "cl-f", dept: "d-sc", lead: "e30", type: "Stratégie", prio: "HAUTE", start: "2026-09-20", end: "2027-01-14", days: 140, budgetM: 24, cert: "CONFIRMEE", status: "ACTIVE", sector: "Télécoms", reqs: [[4, 1, 50, "strat", "pm", 8], [3, 1, 100, "strat,bp", "fin-mod", 5], [2, 1, 100, "etude", "bi", 2], [1, 1, 30, "etude", "", 0]] },
  { n: 10, year: 2026, name: "Étude de marché — Groupe agroalimentaire I", client: "cl-i", dept: "d-sc", lead: "e30", type: "Étude de marché", prio: "NORMALE", start: "2026-12-13", end: "2027-02-11", days: 60, budgetM: 8, cert: "PROBABLE", status: "A_VENIR", sector: "Agroalimentaire", reqs: [[3, 1, 100, "etude", "strat", 5], [2, 1, 100, "etude", "bi", 2]] },
  { n: 11, year: 2026, name: "Due diligence — Promoteur immobilier J", client: "cl-j", dept: "d-trx", lead: "e36", type: "Due diligence", prio: "HAUTE", start: "2026-11-01", end: "2026-12-23", days: 55, budgetM: 16, cert: "CONFIRMEE", status: "ACTIVE", sector: "Immobilier", reqs: [[4, 1, 40, "dd", "valo", 8], [3, 1, 100, "dd,fin-an", "", 5], [2, 1, 100, "dd", "fin-mod", 2]] },
  { n: 3, year: 2027, name: "Évaluation d’entreprise — Industriel D", client: "cl-d", dept: "d-trx", lead: "e35", type: "Évaluation", prio: "NORMALE", start: "2027-01-17", end: "2027-03-18", days: 70, budgetM: 13, cert: "CONFIRMEE", status: "A_VENIR", sector: "Industrie", reqs: [[3, 1, 100, "valo,fin-mod", "", 5], [2, 1, 100, "valo", "", 2]] },
  { n: 13, year: 2026, name: "Audit SI et contrôle interne — Établissement public H", client: "cl-h", dept: "d-aud", lead: "e03", type: "Audit SI", prio: "NORMALE", start: "2026-10-25", end: "2027-01-21", days: 130, budgetM: 15, cert: "CONFIRMEE", status: "ACTIVE", sector: "Secteur public", reqs: [[3, 1, 70, "si,ctrl-int", "pub", 5], [2, 1, 100, "ctrl-int", "", 2], [1, 1, 40, "compta", "data", 0]] },
  { n: 14, year: 2026, name: "Diagnostic organisationnel — Établissement public H", client: "cl-h", dept: "d-sc", lead: "e30", type: "Organisation", prio: "BASSE", start: "2026-06-14", end: "2026-09-15", days: 80, budgetM: 9, cert: "CONFIRMEE", status: "TERMINEE", sector: "Secteur public", reqs: [[3, 1, 100, "orga", "", 5], [2, 1, 100, "etude", "", 2], [1, 1, 100, "etude", "", 0]] },
  { n: 15, year: 2026, name: "Audit légal 2025 — Assureur C", client: "cl-c", dept: "d-aud", lead: "e02", type: "Audit légal", prio: "NORMALE", start: "2026-02-01", end: "2026-06-30", days: 220, budgetM: 17, cert: "CONFIRMEE", status: "TERMINEE", sector: "Banque & assurance", reqs: [[4, 1, 40, "audit-fin", "", 8], [3, 1, 100, "audit-fin", "", 5], [2, 1, 100, "audit-fin", "", 2], [1, 1, 100, "compta", "", 0]] },
];

/** Stable ids: p-<index+1> */
export const projectId = (i: number) => `p-${String(i + 1).padStart(2, "0")}`;
/** Seed id of the mission waiting for staffing (the matching demo). */
export const UNSTAFFED_PROJECT = projectId(3);

export function buildMissions() {
  const projects: Project[] = [];
  const requirements: StaffingRequirement[] = [];
  PROJECTS.forEach((p, i) => {
    const id = projectId(i);
    const budget = p.budgetM * 1_000_000;
    projects.push({
      id,
      reference: `MIS-${p.year}-${String(400 + p.n * 9 + i).padStart(4, "0")}`,
      otp: `OTP-${String(p.year).slice(2)}-${String(4000 + i * 37 + p.n)}`,
      name: p.name,
      clientId: p.client,
      description: `Mission « ${p.name} » — ${p.type.toLowerCase()}. Description fictive pour la démonstration.`,
      departmentId: p.dept,
      leadId: p.lead,
      createdById: p.lead,
      type: p.type,
      priority: p.prio,
      startDate: p.start,
      endDate: p.end,
      estimatedDays: p.days,
      budget,
      currency: "DZD",
      resourceBudget: Math.round(budget * 0.58),
      estimatedDailyCost: Math.round((budget * 0.58) / p.days / 500) * 500,
      dailySellPrice: Math.round(budget / p.days / 1000) * 1000,
      certainty: p.cert,
      status: p.status,
      phases: [
        { id: `${id}-ph1`, name: "Cadrage et planification", startDate: p.start, endDate: addApprox(p.start, p.end, 0.2) },
        { id: `${id}-ph2`, name: "Exécution", startDate: addApprox(p.start, p.end, 0.2), endDate: addApprox(p.start, p.end, 0.8) },
        { id: `${id}-ph3`, name: "Restitution", startDate: addApprox(p.start, p.end, 0.8), endDate: p.end },
      ],
      milestones: [
        { id: `${id}-ms1`, name: "Revue de lancement", date: addApprox(p.start, p.end, 0.1), done: p.status === "ACTIVE" || p.status === "TERMINEE" },
        { id: `${id}-ms2`, name: "Point d’étape client", date: addApprox(p.start, p.end, 0.5), done: p.status === "TERMINEE" },
        { id: `${id}-ms3`, name: "Livrable final", date: p.end, done: p.status === "TERMINEE" },
      ],
      sector: p.sector,
    });
    p.reqs.forEach(([rank, qty, pct, mand, des, minExp, fullTime, s, e], j) => {
      requirements.push({
        id: `rq-${String(i + 1).padStart(2, "0")}-${j + 1}`,
        projectId: id,
        gradeMin: `g-${rank}`,
        quantity: qty,
        mandatorySkillIds: S(mand),
        desiredSkillIds: S(des),
        minExperienceYears: minExp,
        startDate: s ?? p.start,
        endDate: e ?? p.end,
        allocationPct: pct,
        priority: p.prio,
        fullTime,
      });
    });
  });
  return { projects, requirements };
}
function addApprox(a: string, b: string, f: number): string {
  const ms = Date.parse(a) + (Date.parse(b) - Date.parse(a)) * f;
  return new Date(ms).toISOString().slice(0, 10);
}

type A = [emp: string, projIdx: number, req: number | null, pct: number, status: Assignment["status"], start?: string, end?: string, extra?: Partial<Assignment>];
/** projIdx is the 1-based position in PROJECTS. req is the 1-based requirement index. */
const ASSIGN: A[] = [
  // P01 Audit légal — Groupe bancaire A
  ["e02", 1, 1, 40, "HARD"], ["e04", 1, 2, 60, "HARD"], ["e07", 1, 2, 60, "HARD"], ["e08", 1, 3, 100, "HARD"], ["e11", 1, 4, 60, "HARD"], ["e01", 1, null, 25, "HARD"],
  // P02 Banque régionale B
  ["e03", 2, 1, 30, "HARD"], ["e05", 2, 2, 100, "HARD"], ["e09", 2, 3, 100, "HARD"],
  ["e06", 2, null, 50, "HARD", undefined, undefined, { exceptionReason: "Besoin client critique : continuité de l’équipe d’audit pendant la clôture. Surcharge acceptée jusqu’au 31 janvier." }],
  // P03 Audit interne Assureur C — junior seat soft-booked
  ["e13", 3, 2, 100, "SOFT", undefined, undefined, { softExpiresAt: "2026-11-20" }],
  ["e12", 13, null, 75, "HARD"], ["e02", 13, null, 30, "HARD"], ["e03", 13, null, 30, "HARD"],
  // P05 Tenue comptable
  ["e16", 5, 1, 40, "HARD"], ["e18", 5, 2, 100, "HARD"], ["e19", 5, 2, 100, "HARD"], ["e20", 5, 3, 100, "HARD"], ["e15", 5, null, 30, "HARD"], ["e14", 5, null, 25, "HARD"], ["e17", 5, null, 80, "HARD"], ["e15", 5, null, 30, "HARD", "2026-09-06", "2027-06-30"],
  // P07 Conseil fiscal E
  ["e23", 7, 1, 40, "HARD"], ["e24", 7, 2, 100, "HARD"], ["e26", 7, 3, 75, "HARD"], ["e22", 7, null, 15, "HARD"], ["e22", 8, null, 10, "HARD"], ["e23", 8, null, 20, "HARD"], ["e28", 8, null, 75, "HARD"],
  // P08 Restructuration juridique G
  ["e25", 8, 1, 60, "HARD"], ["e27", 8, 2, 100, "HARD"],
  // P09 Plan stratégique F
  ["e30", 9, 1, 50, "HARD"], ["e31", 9, 2, 100, "HARD"], ["e33", 9, 3, 100, "HARD"], ["e34", 9, 4, 75, "HARD"], ["e29", 9, null, 25, "HARD"], ["e32", 9, null, 70, "HARD"],
  // P10 Étude de marché I — probable, soft
  ["e32", 10, 1, 100, "SOFT", undefined, undefined, { softExpiresAt: "2026-11-27" }],
  // P11 Due diligence J
  ["e36", 11, 1, 40, "HARD"], ["e37", 11, 2, 100, "HARD"], ["e38", 11, 3, 100, "HARD"], ["e39", 11, null, 70, "HARD"], ["e35", 11, null, 25, "HARD"], ["e36", 11, null, 20, "HARD"],
  // P13 Audit SI — établissement public H
  ["e06", 13, 1, 70, "HARD"], ["e10", 13, 2, 100, "HARD"], ["e11", 13, 3, 40, "HARD"], ["e07", 13, null, 30, "HARD"],
  // P14 / P15 finished
  ["e32", 14, 1, 100, "TERMINEE"], ["e33", 14, 2, 100, "TERMINEE"], ["e34", 14, 3, 100, "TERMINEE"],
  ["e02", 15, 1, 40, "TERMINEE"], ["e04", 15, 2, 100, "TERMINEE"], ["e05", 15, 2, 100, "TERMINEE", undefined, undefined, { requirementId: undefined }], ["e08", 15, 3, 100, "TERMINEE"], ["e11", 15, 4, 100, "TERMINEE"], ["e16", 15, null, 40, "TERMINEE"],
];

export function buildAssignments(projects: Project[], requirements: StaffingRequirement[], hoursFor: (empId: string, start: string, end: string, pct: number) => number): Assignment[] {
  return ASSIGN.map(([emp, pi, rq, pct, status, start, end, extra], i) => {
    const project = projects[pi - 1];
    const req = rq ? requirements.find((r) => r.projectId === project.id && r.id.endsWith(`-${rq}`)) : undefined;
    const s = start ?? req?.startDate ?? project.startDate;
    const e = end ?? req?.endDate ?? project.endDate;
    return {
      id: `a-${String(i + 1).padStart(3, "0")}`,
      employeeId: emp,
      projectId: project.id,
      requirementId: req?.id,
      startDate: s,
      endDate: e,
      allocationPct: pct,
      plannedHours: hoursFor(emp, s, e, pct),
      status,
      validatedById: status === "HARD" || status === "TERMINEE" ? "u-amine" : undefined,
      createdAt: s < "2026-10-01" ? s : "2026-10-01",
      fullTime: req?.fullTime,
      ...extra,
    } as Assignment;
  });
}

export const pipelineBase: PipelineItem[] = [
  { id: "pl-1", name: "Campagne d’audits bancaires T1 2027 — lot 1", clientLabel: "Groupe bancaire K (appel d’offres)", departmentId: "d-aud", sector: "Banque & assurance", certainty: "CONFIRMEE", startDate: "2027-01-11", endDate: "2027-03-31", needs: [{ gradeId: "g-3", quantity: 2, skillIds: S("audit-fin,ifrs"), allocationPct: 100 }, { gradeId: "g-2", quantity: 2, skillIds: S("audit-fin"), allocationPct: 100 }] },
  { id: "pl-2", name: "Campagne d’audits bancaires T1 2027 — lot 2", clientLabel: "Banque L (renouvellement)", departmentId: "d-aud", sector: "Banque & assurance", certainty: "PROBABLE", startDate: "2027-01-11", endDate: "2027-03-31", needs: [{ gradeId: "g-3", quantity: 2, skillIds: S("audit-fin,banq"), allocationPct: 100 }, { gradeId: "g-1", quantity: 1, skillIds: S("compta"), allocationPct: 100 }] },
  { id: "pl-3", name: "Campagne d’audits bancaires T1 2027 — lot 3", clientLabel: "Assureur M (appel d’offres)", departmentId: "d-aud", sector: "Banque & assurance", certainty: "PROBABLE", startDate: "2027-01-11", endDate: "2027-03-31", needs: [{ gradeId: "g-3", quantity: 1, skillIds: S("audit-fin"), allocationPct: 100 }] },
  { id: "pl-4", name: "Programme de transformation — Industriel N", clientLabel: "Industriel N", departmentId: "d-sc", sector: "Industrie", certainty: "PROBABLE", startDate: "2027-02-01", endDate: "2027-07-30", needs: [{ gradeId: "g-4", quantity: 1, skillIds: S("strat,pm"), allocationPct: 50 }, { gradeId: "g-3", quantity: 2, skillIds: S("strat"), allocationPct: 100 }, { gradeId: "g-2", quantity: 2, skillIds: S("etude"), allocationPct: 100 }] },
  { id: "pl-5", name: "Acquisition cible — Fonds P", clientLabel: "Fonds P", departmentId: "d-trx", sector: "Distribution", certainty: "OPPORTUNITE", startDate: "2027-03-01", endDate: "2027-05-28", needs: [{ gradeId: "g-3", quantity: 2, skillIds: S("dd,valo"), allocationPct: 100 }, { gradeId: "g-2", quantity: 2, skillIds: S("dd"), allocationPct: 100 }] },
  { id: "pl-6", name: "Contrôle fiscal — Groupe Q", clientLabel: "Groupe Q", departmentId: "d-cjf", sector: "Énergie", certainty: "PROBABLE", startDate: "2027-02-15", endDate: "2027-06-30", needs: [{ gradeId: "g-3", quantity: 1, skillIds: S("fisc-ent"), allocationPct: 100 }, { gradeId: "g-2", quantity: 1, skillIds: S("fisc-ent"), allocationPct: 100 }] },
];

export const documentsFor = (projects: Project[]): DocumentMeta[] =>
  projects.slice(0, 11).flatMap((p, i) => [
    { id: `doc-${i}-1`, entity: "PROJECT" as const, entityId: p.id, name: `Lettre de mission — ${p.reference}.pdf`, kind: "Contrat", sizeKb: 180 + i * 7, uploadedById: "u-thomas", createdAt: p.startDate },
    { id: `doc-${i}-2`, entity: "PROJECT" as const, entityId: p.id, name: `Plan de mission — ${p.reference}.xlsx`, kind: "Planning", sizeKb: 64 + i * 3, uploadedById: "u-thomas", createdAt: p.startDate },
  ]);
