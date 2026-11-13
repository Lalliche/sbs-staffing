/* End-of-mission evaluation (LIGHT, spec 8.13): 8 optional ratings, free text, confidentiality flag. No weights, no global score. */
import { nextId } from "../../engine/ids";
import { EVAL_CRITERIA, type AppState, type Evaluation } from "../types";
import { actorOf, audit, deny, empName, fail, notify, ok, userOfEmployee, type Result } from "./core";

export interface EvaluationInput {
  employeeId: string;
  projectId: string;
  criteria: Evaluation["criteria"];
  strengths: string;
  improvements: string;
  trainingRecommendation: string;
  confidential: boolean;
}
export function createEvaluation(s: AppState, i: EvaluationInput): Result<Evaluation> {
  const denied = deny(s, "evaluation.create", { employeeId: i.employeeId });
  if (denied) return denied;
  const u = actorOf(s)!;
  if (u.employeeId === i.employeeId) return fail("FORBIDDEN", "Vous ne pouvez pas vous évaluer vous-même.");
  if (!s.projects.some((p) => p.id === i.projectId)) return fail("NOT_FOUND", "Mission introuvable.");
  if (s.evaluations.some((e) => e.employeeId === i.employeeId && e.projectId === i.projectId && e.evaluatorId === u.id)) return fail("INVALID", "Vous avez déjà évalué cette personne sur cette mission.");
  for (const c of EVAL_CRITERIA) { const v = i.criteria[c]; if (v !== undefined && !(v >= 1 && v <= 5)) return fail("INVALID", "Chaque note est comprise entre 1 et 5."); }
  const e: Evaluation = { id: nextId(s, "ev"), employeeId: i.employeeId, projectId: i.projectId, evaluatorId: u.id, criteria: i.criteria, strengths: i.strengths.trim(), improvements: i.improvements.trim(), trainingRecommendation: i.trainingRecommendation.trim(), confidential: i.confidential, createdAt: s.now };
  s.evaluations.push(e);
  audit(s, { action: "evaluation.create", entity: "Évaluation", entityId: e.id, label: `${empName(s, i.employeeId)} — ${s.projects.find((p) => p.id === i.projectId)?.name}${i.confidential ? " (confidentielle)" : ""}`, after: { Confidentielle: i.confidential, Critères: Object.keys(i.criteria).length } });
  if (!i.confidential) notify(s, userOfEmployee(s, i.employeeId)?.id, "SYSTEM", "Nouvelle évaluation de fin de mission", s.projects.find((p) => p.id === i.projectId)?.name ?? "", "/app/evaluations");
  return ok(e);
}
