/* CV analysis (SIMULATED parsing) → validation screen → only then this audited write (spec 8.15). */
import { audit, deny, empName, fail, ok, type Result } from "./core";
import type { AppState, SkillLevel } from "../types";

export interface CvResult {
  experiences: { label: string; years: number }[];
  skills: { skillId: string; level: SkillLevel }[];
  diplomas: string[];
  certificationIds: string[];
  sectors: string[];
}
/** Deterministic « parsing » keyed on the file name + size: the same file always gives the same extraction. */
export function simulateCvParse(fileName: string, size: number): CvResult {
  const h = [...fileName].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, size);
  const pick = <T,>(a: T[], n: number) => Array.from({ length: n }, (_, i) => a[(h + i * 7) % a.length]);
  const skills = [...new Set(pick(["sk-audit-fin", "sk-ifrs", "sk-compta", "sk-fin-an", "sk-ctrl-int", "sk-data", "sk-conso", "sk-strat"], 5))];
  return {
    experiences: [{ label: "Auditeur senior — cabinet d’audit (fictif)", years: 3 + (h % 4) }, { label: "Consultant — missions de conseil financier (fictif)", years: 2 + (h % 3) }],
    skills: skills.map((skillId, i) => ({ skillId, level: ((2 + ((h + i) % 3)) as SkillLevel) })),
    diplomas: ["Master en finance et comptabilité", "Diplôme d’expertise (fictif)"],
    certificationIds: h % 2 ? ["ce-ifrs"] : ["ce-ai"],
    sectors: ["Banque & assurance", h % 2 ? "Industrie" : "Énergie"],
  };
}
export function applyCvAnalysis(s: AppState, employeeId: string, r: CvResult): Result<{ addedSkills: number }> {
  const denied = deny(s, "employee.create", { employeeId });
  if (denied) return denied;
  const e = s.employees.find((x) => x.id === employeeId);
  if (!e) return fail("NOT_FOUND", "Collaborateur introuvable.");
  let added = 0;
  const before = { compétences: s.employeeSkills.filter((x) => x.employeeId === employeeId).length, diplômes: e.diplomas.length, secteurs: e.sectors.length };
  for (const k of r.skills) {
    if (!s.skills.some((x) => x.id === k.skillId)) continue;
    const row = s.employeeSkills.find((x) => x.employeeId === employeeId && x.skillId === k.skillId);
    if (row) { row.selfLevel = k.level; row.updatedAt = s.now; } // never lowers a validated level
    else { s.employeeSkills.push({ employeeId, skillId: k.skillId, level: k.level, selfLevel: k.level, updatedAt: s.now, evidence: "Extrait d’un CV (validé par un utilisateur)" }); added++; }
  }
  e.diplomas = [...new Set([...e.diplomas, ...r.diplomas])];
  e.sectors = [...new Set([...e.sectors, ...r.sectors])];
  audit(s, { action: "ai.cv.apply", entity: "Collaborateur", entityId: employeeId, label: `${empName(s, employeeId)} — profil enrichi depuis un CV`, before, after: { compétences: s.employeeSkills.filter((x) => x.employeeId === employeeId).length, diplômes: e.diplomas.length, secteurs: e.sectors.length } });
  return ok({ addedSkills: added });
}
