/* Matching score 0–100 (spec 7.3). Weighted breakdown + BLOCKING criteria kept separate from the score.
   Never invents skills or experience: everything comes from the employee's recorded profile. */
import type { AppState, Employee, ISODate, Project, Settings, SkillLevel, StaffingRequirement } from "../store/types";
import { absenceDaySet, assignmentsOf, calendarOf, dailyHours, workingDays } from "./capacity";
import { checkBooking, type Conflict } from "./conflicts";
import { eachDay } from "./dates";

type S = Pick<AppState, "employees" | "offices" | "holidays" | "leaves" | "assignments" | "settings" | "projects" | "skills" | "grades" | "employeeSkills" | "certifications" | "employeeCertifications" | "requirements">;

export type CriterionKey = "skills" | "availability" | "sector" | "grade" | "certifications" | "history";
export const CRITERION_LABEL: Record<CriterionKey, string> = {
  skills: "Compétences",
  availability: "Disponibilité",
  sector: "Expérience sectorielle",
  grade: "Grade",
  certifications: "Certifications",
  history: "Historique pertinent",
};
export interface CriterionScore {
  key: CriterionKey;
  label: string;
  ratio: number; // 0..1
  points: number; // after weighting
  max: number;
  detail: string;
  notApplicable?: boolean;
}
export type BlockKind = "MISSING_MANDATORY_SKILL" | "GRADE_BELOW_MINIMUM" | "UNAVAILABLE";
export interface BlockReason {
  kind: BlockKind;
  label: string;
  detail: string;
}
export interface MatchResult {
  employeeId: string;
  score: number;
  criteria: CriterionScore[];
  strengths: string[];
  missingSkillIds: string[];
  weakSkillIds: string[];
  blocking: BlockReason[];
  /** false when blocked → "Non compatible", never auto-selectable. */
  compatible: boolean;
  availability: { ratio: number; freeHours: number; neededHours: number; absentDays: number };
  conflicts: Conflict[];
  warnings: string[];
  /** Estimated cost of this person on the requirement. RESTRICTED: selectors strip it. */
  estimatedCost: number;
  currentProjectIds: string[];
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export interface RequirementLike {
  gradeMin: string;
  mandatorySkillIds: string[];
  desiredSkillIds: string[];
  minExperienceYears: number;
  startDate: ISODate;
  endDate: ISODate;
  allocationPct: number;
  fullTime?: boolean;
  projectId?: string;
  sector?: string;
  departmentId?: string;
  type?: string;
}
export const requirementLike = (r: StaffingRequirement, p?: Project): RequirementLike => ({ ...r, sector: p?.sector, departmentId: p?.departmentId, type: p?.type });

const levelOf = (state: S, empId: string, skillId: string): SkillLevel | 0 => state.employeeSkills.find((s) => s.employeeId === empId && s.skillId === skillId)?.level ?? 0;
const gradeRank = (state: S, gradeId: string) => state.grades.find((g) => g.id === gradeId)?.rank ?? 0;

function normalisedWeights(w: Settings["scoringWeights"]): Record<CriterionKey, number> {
  const sum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  const out = {} as Record<CriterionKey, number>;
  (Object.keys(w) as CriterionKey[]).forEach((k) => (out[k] = (w[k] / sum) * 100));
  return out;
}

export function scoreCandidate(state: S, emp: Employee, req: RequirementLike): MatchResult {
  const weights = normalisedWeights(state.settings.scoringWeights);
  const cal = calendarOf(state, emp);
  const skillName = (id: string) => state.skills.find((s) => s.id === id)?.name ?? id;
  const criteria: CriterionScore[] = [];
  const strengths: string[] = [];
  const warnings: string[] = [];

  /* 1 — skills: mandatory (70 %) then desired (30 %), each weighted by level vs expected level */
  const credit = (ids: string[]) =>
    ids.map((id) => {
      const lvl = levelOf(state, emp.id, id);
      const expected = state.skills.find((s) => s.id === id)?.expectedLevel ?? 2;
      return { id, lvl, ratio: lvl === 0 ? 0 : clamp01(lvl / expected) };
    });
  const mand = credit(req.mandatorySkillIds);
  const des = credit(req.desiredSkillIds);
  const avg = (l: { ratio: number }[]) => (l.length ? l.reduce((s, x) => s + x.ratio, 0) / l.length : 1);
  const skillRatio = req.mandatorySkillIds.length && req.desiredSkillIds.length ? avg(mand) * 0.7 + avg(des) * 0.3 : req.mandatorySkillIds.length ? avg(mand) : avg(des);
  const missingSkillIds = mand.filter((x) => x.lvl === 0).map((x) => x.id);
  const weakSkillIds = [...mand, ...des].filter((x) => x.lvl > 0 && x.ratio < 1).map((x) => x.id);
  const heldMand = mand.filter((x) => x.lvl > 0).length;
  criteria.push({
    key: "skills",
    label: CRITERION_LABEL.skills,
    ratio: skillRatio,
    points: skillRatio * weights.skills,
    max: weights.skills,
    detail: req.mandatorySkillIds.length ? `${heldMand}/${req.mandatorySkillIds.length} compétences obligatoires, ${des.filter((x) => x.lvl > 0).length}/${req.desiredSkillIds.length} souhaitées` : "Aucune compétence obligatoire demandée",
    notApplicable: !req.mandatorySkillIds.length && !req.desiredSkillIds.length,
  });
  mand.filter((x) => x.ratio >= 1).forEach((x) => strengths.push(`${skillName(x.id)} maîtrisé (niveau ${x.lvl})`));

  /* 2 — availability: share of the requested period × allocation actually free (absences + HARD + SOFT) */
  const days = workingDays(state, emp, req.startDate, req.endDate);
  const abs = absenceDaySet(state, emp.id, req.startDate, req.endDate);
  const others = assignmentsOf(state, emp.id).filter((a) => a.endDate >= req.startDate && a.startDate <= req.endDate);
  let freeCredit = 0;
  let freeHours = 0;
  let absentDays = 0;
  const dh = dailyHours(emp, cal);
  for (const d of days) {
    if (abs.has(d)) {
      absentDays++;
      continue;
    }
    let used = 0;
    for (const a of others) if (a.startDate <= d && a.endDate >= d) used += a.allocationPct;
    const free = Math.max(0, 100 - used);
    freeCredit += clamp01(free / Math.max(1, req.allocationPct));
    freeHours += (free / 100) * dh;
  }
  const totalReqDays = eachDay(req.startDate, req.endDate).filter((d) => cal.workingWeekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()) && !cal.holidays.has(d)).length;
  const availRatio = totalReqDays ? clamp01(freeCredit / totalReqDays) : 0;
  const neededHours = totalReqDays * dh * (req.allocationPct / 100);
  criteria.push({
    key: "availability",
    label: CRITERION_LABEL.availability,
    ratio: availRatio,
    points: availRatio * weights.availability,
    max: weights.availability,
    detail: `${Math.round(availRatio * 100)} % de la période libre${absentDays ? `, ${absentDays} j d’absence` : ""}`,
  });
  if (availRatio >= 0.9) strengths.push("Disponible sur l’ensemble de la période");

  /* 3 — sector experience: profile (60 %) + past missions in the sector (40 %) */
  const projectOf = (id: string) => state.projects.find((p) => p.id === id);
  const past = state.assignments.filter((a) => a.employeeId === emp.id && (a.status === "TERMINEE" || a.status === "HARD") && a.projectId !== req.projectId);
  const sectorMissions = req.sector ? past.filter((a) => projectOf(a.projectId)?.sector === req.sector) : [];
  const profileHit = req.sector ? emp.sectors.includes(req.sector) : true;
  const sectorRatio = req.sector ? (profileHit ? 0.6 : 0) + clamp01(sectorMissions.length / 2) * 0.4 : 1;
  criteria.push({
    key: "sector",
    label: CRITERION_LABEL.sector,
    ratio: sectorRatio,
    points: sectorRatio * weights.sector,
    max: weights.sector,
    detail: req.sector ? `${profileHit ? "Secteur au profil" : "Secteur absent du profil"}, ${sectorMissions.length} mission(s) dans le secteur` : "Secteur non précisé",
    notApplicable: !req.sector,
  });
  if (req.sector && profileHit && sectorMissions.length) strengths.push(`Expérience ${req.sector.toLowerCase()} (${sectorMissions.length} mission${sectorMissions.length > 1 ? "s" : ""})`);

  /* 4 — grade: full points at/above minimum, decreasing below */
  const rank = gradeRank(state, emp.gradeId);
  const minRank = gradeRank(state, req.gradeMin);
  const gap = minRank - rank;
  const gradeRatio = gap <= 0 ? 1 : gap === 1 ? 0.5 : gap === 2 ? 0.2 : 0;
  criteria.push({
    key: "grade",
    label: CRITERION_LABEL.grade,
    ratio: gradeRatio,
    points: gradeRatio * weights.grade,
    max: weights.grade,
    detail: gap <= 0 ? (gap <= -2 ? "Grade nettement supérieur au minimum" : "Grade conforme au minimum") : `${gap} grade${gap > 1 ? "s" : ""} sous le minimum requis`,
  });
  if (gap <= -2) warnings.push("Sur-qualification : grade très supérieur au besoin");

  /* 5 — certifications associated with the requested skills, held and valid over the period */
  const certIds = new Set<string>();
  [...req.mandatorySkillIds, ...req.desiredSkillIds].forEach((sid) => state.skills.find((s) => s.id === sid)?.certificationIds.forEach((c) => certIds.add(c)));
  const certList = [...certIds];
  let certRatio = 1;
  if (certList.length) {
    let sum = 0;
    for (const cid of certList) {
      const held = state.employeeCertifications.find((c) => c.employeeId === emp.id && c.certificationId === cid);
      if (!held) continue;
      if (held.expiresAt < req.startDate) continue;
      sum += held.expiresAt < req.endDate ? 0.5 : 1;
      if (held.expiresAt < req.endDate) warnings.push(`Certification « ${state.certifications.find((c) => c.id === cid)?.name} » expire pendant la mission`);
    }
    certRatio = sum / certList.length;
  }
  criteria.push({
    key: "certifications",
    label: CRITERION_LABEL.certifications,
    ratio: certRatio,
    points: certRatio * weights.certifications,
    max: weights.certifications,
    detail: certList.length ? `${Math.round(certRatio * certList.length * 10) / 10}/${certList.length} certification(s) valides` : "Aucune certification associée",
    notApplicable: !certList.length,
  });
  if (certList.length && certRatio === 1) strengths.push("Certifications associées valides");

  /* 6 — relevant history: past missions in the same department / type / sector */
  const similar = past.filter((a) => {
    const p = projectOf(a.projectId);
    return !!p && ((req.departmentId && p.departmentId === req.departmentId) || (req.type && p.type === req.type) || (req.sector && p.sector === req.sector));
  });
  const histRatio = clamp01(similar.length / 2);
  criteria.push({ key: "history", label: CRITERION_LABEL.history, ratio: histRatio, points: histRatio * weights.history, max: weights.history, detail: `${similar.length} mission(s) similaire(s)` });

  if (emp.yearsExperience < req.minExperienceYears) warnings.push(`Expérience (${emp.yearsExperience} ans) inférieure au minimum souhaité (${req.minExperienceYears} ans)`);

  /* Blocking criteria (configurable) */
  const b = state.settings.blocking;
  const blocking: BlockReason[] = [];
  if (b.missingMandatorySkill && missingSkillIds.length)
    blocking.push({ kind: "MISSING_MANDATORY_SKILL", label: "Compétence obligatoire manquante", detail: missingSkillIds.map((id) => state.skills.find((s) => s.id === id)?.name ?? id).join(", ") });
  if (b.gradeBelowMinimum && gap > 0) blocking.push({ kind: "GRADE_BELOW_MINIMUM", label: "Grade inférieur au minimum", detail: `${state.grades.find((g) => g.id === emp.gradeId)?.name} < ${state.grades.find((g) => g.id === req.gradeMin)?.name}` });
  if (b.unavailable && availRatio < state.settings.minAvailabilityRatio)
    blocking.push({ kind: "UNAVAILABLE", label: "Indisponible", detail: absentDays ? `Absent(e) ${absentDays} j sur la période (congé approuvé)` : `Disponibilité de ${Math.round(availRatio * 100)} % seulement` });

  // Non-blocking flags still shown (never hide a problem because the toggle is off)
  if (!b.missingMandatorySkill && missingSkillIds.length) warnings.push("Compétence obligatoire manquante (critère bloquant désactivé)");

  const conflicts = checkBooking(state, { employeeId: emp.id, projectId: req.projectId ?? "", startDate: req.startDate, endDate: req.endDate, allocationPct: req.allocationPct, status: "HARD", fullTime: req.fullTime });
  const score = Math.round(criteria.reduce((s, c) => s + c.points, 0));
  const estimatedCost = Math.round(totalReqDays * (req.allocationPct / 100) * emp.dailyCost);
  const currentProjectIds = [...new Set(others.filter((a) => a.endDate >= req.startDate).map((a) => a.projectId))];

  return {
    employeeId: emp.id,
    score,
    criteria,
    strengths: strengths.slice(0, 4),
    missingSkillIds,
    weakSkillIds,
    blocking,
    compatible: blocking.length === 0,
    availability: { ratio: availRatio, freeHours: Math.round(freeHours * 10) / 10, neededHours: Math.round(neededHours * 10) / 10, absentDays },
    conflicts,
    warnings,
    estimatedCost,
    currentProjectIds,
  };
}

/** Rank every active employee (compatible first, then by score). Candidates are never dropped: blocked ones are flagged. */
export function rankCandidates(state: S, req: RequirementLike, opts: { excludeEmployeeIds?: string[]; employeeIds?: string[] } = {}): MatchResult[] {
  const pool = state.employees.filter((e) => e.status !== "ARCHIVE" && !opts.excludeEmployeeIds?.includes(e.id) && (!opts.employeeIds || opts.employeeIds.includes(e.id)));
  return pool
    .map((e) => scoreCandidate(state, e, req))
    .sort((a, b) => Number(b.compatible) - Number(a.compatible) || b.score - a.score || a.employeeId.localeCompare(b.employeeId));
}


/** Default candidate pool: the requested grade and one grade above (Partners and the mission lead are not offered
 *  for a Senior seat unless `includeHigherGrades`). Blocked candidates stay in the pool and are flagged. */
export function candidatePool(state: Pick<S, "employees" | "grades">, req: { gradeMin: string; projectLeadId?: string }, opts: { includeHigherGrades?: boolean } = {}): string[] {
  const min = state.grades.find((g) => g.id === req.gradeMin)?.rank ?? 1;
  return state.employees
    .filter((e) => e.status !== "ARCHIVE" && e.id !== req.projectLeadId)
    .filter((e) => {
      const r = state.grades.find((g) => g.id === e.gradeId)?.rank ?? 0;
      return opts.includeHigherGrades || r <= min + 1;
    })
    .map((e) => e.id);
}
