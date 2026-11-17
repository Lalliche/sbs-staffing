/* Skills read layer: per-person levels shown on the employee page. Skills themselves live on the employee record and
   feed matching, requests and capacity; there is no standalone skills module. */
import type { AppState, SkillLevel } from "../types";
import { employeeById } from "./core";

export const levelLabel = (s: AppState, level: number): string => s.settings.skillLevelLabels[level - 1] ?? "—";

export interface EmployeeSkillRow {
  skillId: string;
  name: string;
  categoryName: string;
  expectedLevel: SkillLevel;
  level: SkillLevel;
}

export function employeeSkillRows(s: AppState, employeeId: string): EmployeeSkillRow[] {
  if (!employeeById(s, employeeId)) return [];
  return s.employeeSkills
    .filter((x) => x.employeeId === employeeId)
    .map((x): EmployeeSkillRow => {
      const k = s.skills.find((y) => y.id === x.skillId);
      return {
        skillId: x.skillId,
        name: k?.name ?? x.skillId,
        categoryName: s.skillCategories.find((c) => c.id === k?.categoryId)?.name ?? "—",
        expectedLevel: k?.expectedLevel ?? 2,
        level: x.level,
      };
    })
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "fr"));
}
