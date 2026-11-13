/* Evaluations read layer (spec 8.13 — LIGHT). Access always goes through visibleEvaluations():
   confidential entries reach only RH / Partner / their evaluator; a collaborateur sees only own non-confidential ones.
   Synthesis = timeline + simple per-criterion averages. No global score, no weights, no anonymity logic. */
import { EVAL_CRITERIA, type AppState, type EvalCriterion, type Evaluation, type ISODate } from "../types";
import { canDo, nameOf, sessionUser, userName, visibleAssignments, visibleEvaluations } from "./core";

export const CRITERION_LABEL: Record<EvalCriterion, string> = {
  quality: "Qualité du travail",
  deadlines: "Respect des délais",
  technical: "Maîtrise technique",
  autonomy: "Autonomie",
  communication: "Communication",
  teamwork: "Esprit d’équipe",
  clientRelation: "Relation client",
  responsibility: "Prise de responsabilités",
};
export const RATING_LABEL = ["", "Insuffisant", "À renforcer", "Conforme", "Très bien", "Excellent"];

/* ------------------------------------------------------------------ to evaluate */
export interface PendingEvaluation {
  key: string;
  employeeId: string;
  employeeName: string;
  gradeName: string;
  projectId: string;
  projectName: string;
  reference: string;
  endDate: ISODate;
  /** Mission closed (status TERMINEE) vs. the person's assignment simply ended. */
  missionClosed: boolean;
}
/** People who finished a mission and have no evaluation for it yet (viewer must hold `evaluation.create` for them). */
export function pendingEvaluations(s: AppState): PendingEvaluation[] {
  const u = sessionUser(s);
  if (!u || !canDo(s, "evaluation.create")) return [];
  const done = new Set(s.evaluations.map((e) => `${e.employeeId}|${e.projectId}`));
  const out = new Map<string, PendingEvaluation>();
  for (const a of visibleAssignments(s)) {
    if (a.status === "ANNULEE" || a.status === "SOFT") continue;
    const p = s.projects.find((x) => x.id === a.projectId);
    if (!p) continue;
    const ended = a.status === "TERMINEE" || p.status === "TERMINEE" || a.endDate < s.now;
    if (!ended || a.employeeId === u.employeeId) continue;
    const emp = s.employees.find((e) => e.id === a.employeeId);
    if (!emp || emp.status === "ARCHIVE" || !canDo(s, "evaluation.create", { employeeId: a.employeeId })) continue;
    const key = `${a.employeeId}|${a.projectId}`;
    if (done.has(key)) continue;
    const prev = out.get(key);
    if (prev) {
      if (a.endDate > prev.endDate) prev.endDate = a.endDate;
      continue;
    }
    out.set(key, {
      key,
      employeeId: a.employeeId,
      employeeName: nameOf(s, a.employeeId),
      gradeName: s.grades.find((g) => g.id === emp.gradeId)?.name ?? "—",
      projectId: p.id,
      projectName: p.name,
      reference: p.reference,
      endDate: a.endDate,
      missionClosed: p.status === "TERMINEE",
    });
  }
  return [...out.values()].sort((a, b) => b.endDate.localeCompare(a.endDate) || a.employeeName.localeCompare(b.employeeName, "fr"));
}
/** May the viewer evaluate this person for this mission right now? (same rule as the pending list + no duplicate) */
export const canEvaluate = (s: AppState, employeeId: string, projectId: string): boolean => pendingEvaluations(s).some((p) => p.employeeId === employeeId && p.projectId === projectId);

/* ------------------------------------------------------------------ synthesis */
export interface CriterionAverage {
  criterion: EvalCriterion;
  label: string;
  /** Mean of the ratings given (1–5), null when no evaluation rated this criterion. */
  average: number | null;
  count: number;
}
export function criterionAverages(evals: Pick<Evaluation, "criteria">[]): CriterionAverage[] {
  return EVAL_CRITERIA.map((criterion) => {
    const v = evals.map((e) => e.criteria[criterion]).filter((x): x is NonNullable<typeof x> => typeof x === "number");
    return { criterion, label: CRITERION_LABEL[criterion], average: v.length ? v.reduce((a, b) => a + b, 0) / v.length : null, count: v.length };
  });
}
export interface TimelineEntry {
  id: string;
  date: ISODate;
  projectId: string;
  projectName: string;
  evaluatorName: string;
  confidential: boolean;
  ratings: Array<{ criterion: EvalCriterion; label: string; value: number }>;
  strengths: string;
  improvements: string;
  trainingRecommendation: string;
}
export interface Synthesis {
  employeeId: string;
  employeeName: string;
  count: number;
  confidentialCount: number;
  averages: CriterionAverage[];
  timeline: TimelineEntry[];
}
const entryOf = (s: AppState, e: Evaluation): TimelineEntry => ({
  id: e.id,
  date: e.createdAt,
  projectId: e.projectId,
  projectName: s.projects.find((p) => p.id === e.projectId)?.name ?? e.projectId,
  evaluatorName: userName(s, e.evaluatorId),
  confidential: e.confidential,
  ratings: EVAL_CRITERIA.filter((c) => typeof e.criteria[c] === "number").map((c) => ({ criterion: c, label: CRITERION_LABEL[c], value: e.criteria[c] as number })),
  strengths: e.strengths,
  improvements: e.improvements,
  trainingRecommendation: e.trainingRecommendation,
});
/** History synthesis of one person — only evaluations the viewer is allowed to read (visibleEvaluations). */
export function employeeSynthesis(s: AppState, employeeId: string): Synthesis | undefined {
  if (!s.employees.some((e) => e.id === employeeId)) return undefined;
  const list = visibleEvaluations(s, employeeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  return {
    employeeId,
    employeeName: nameOf(s, employeeId),
    count: list.length,
    confidentialCount: list.filter((e) => e.confidential).length,
    averages: criterionAverages(list),
    timeline: list.map((e) => entryOf(s, e)),
  };
}

export interface EvaluatedRow {
  employeeId: string;
  name: string;
  gradeName: string;
  departmentName: string;
  count: number;
  confidentialCount: number;
  lastDate: ISODate;
  lastProject: string;
}
/** One row per person with at least one readable evaluation. */
export function evaluatedPeople(s: AppState): EvaluatedRow[] {
  const by = new Map<string, Evaluation[]>();
  for (const e of visibleEvaluations(s)) by.set(e.employeeId, [...(by.get(e.employeeId) ?? []), e]);
  return [...by.entries()]
    .map(([employeeId, list]): EvaluatedRow => {
      const last = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0];
      const emp = s.employees.find((x) => x.id === employeeId);
      return {
        employeeId,
        name: nameOf(s, employeeId),
        gradeName: s.grades.find((g) => g.id === emp?.gradeId)?.name ?? "—",
        departmentName: s.departments.find((d) => d.id === emp?.departmentId)?.name ?? "—",
        count: list.length,
        confidentialCount: list.filter((e) => e.confidential).length,
        lastDate: last.createdAt,
        lastProject: s.projects.find((p) => p.id === last.projectId)?.name ?? last.projectId,
      };
    })
    .sort((a, b) => b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name, "fr"));
}
