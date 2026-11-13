/* Skill levels: self-assessment by the person, validation by a manager (spec 8.6). */
import { fmtDate } from "../../engine/format";
import { can } from "../../engine/permissions";
import type { AppState, SkillLevel } from "../types";
import { actorOf, audit, deny, empName, fail, notify, ok, userOfEmployee, type Result } from "./core";

export function selfAssess(s: AppState, skillId: string, level: SkillLevel, note?: string): Result {
  const u = actorOf(s);
  const empId = u?.employeeId;
  if (!u || !empId) return fail("FORBIDDEN", "Aucun profil collaborateur associé.");
  if (!s.skills.some((k) => k.id === skillId && k.active)) return fail("NOT_FOUND", "Compétence introuvable.");
  let row = s.employeeSkills.find((x) => x.employeeId === empId && x.skillId === skillId);
  const before = row ? { "Auto-évaluation": row.selfLevel ?? null, Niveau: row.level } : undefined;
  if (!row) { row = { employeeId: empId, skillId, level, selfLevel: level, updatedAt: s.now }; s.employeeSkills.push(row); }
  else { row.selfLevel = level; row.updatedAt = s.now; }
  if (note) row.experienceNote = note;
  audit(s, { action: "skill.self", entity: "Compétence", entityId: `${empId}:${skillId}`, label: `${empName(s, empId)} — ${s.skills.find((k) => k.id === skillId)?.name}`, before, after: { "Auto-évaluation": level } });
  const mgr = s.employees.find((e) => e.id === empId)?.managerId;
  notify(s, mgr ? userOfEmployee(s, mgr)?.id : undefined, "SYSTEM", "Compétence à valider", `${empName(s, empId)} a déclaré une compétence.`, `/app/collaborateurs/${empId}?tab=competences`);
  return ok(undefined);
}

export function validateSkill(s: AppState, employeeId: string, skillId: string, level: SkillLevel, evidence?: string): Result {
  const denied = deny(s, "skill.validate", { employeeId });
  if (denied) return denied;
  if (actorOf(s)?.employeeId === employeeId) return fail("FORBIDDEN", "Vous ne pouvez pas valider vos propres compétences.");
  const row = s.employeeSkills.find((x) => x.employeeId === employeeId && x.skillId === skillId);
  if (!row) return fail("NOT_FOUND", "Cette compétence n’est pas déclarée.");
  const before = { Niveau: row.level, Validé: !!row.validatedById };
  row.level = level;
  row.validatedById = actorOf(s)?.employeeId ?? actorOf(s)?.id;
  row.validatedAt = s.now;
  row.updatedAt = s.now;
  if (evidence?.trim()) row.evidence = evidence.trim();
  audit(s, { action: "skill.validate", entity: "Compétence", entityId: `${employeeId}:${skillId}`, label: `${empName(s, employeeId)} — ${s.skills.find((k) => k.id === skillId)?.name} (validé le ${fmtDate(s.now)})`, before, after: { Niveau: level, Validé: true } });
  notify(s, userOfEmployee(s, employeeId)?.id, "SYSTEM", "Compétence validée", `${s.skills.find((k) => k.id === skillId)?.name} — niveau ${level}.`, `/app/collaborateurs/${employeeId}?tab=competences`);
  return ok(undefined);
}
void can;
