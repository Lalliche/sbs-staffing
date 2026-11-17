/* UI-facing labels, tones and colours for domain enums (French). Single source — no copy elsewhere. */
import type { AssignmentStatus, Certainty, Priority, ProjectStatus, RequestStatus, Role, WorkMode } from "./store/types";
import type { Tone } from "@/components/ui/Badge";

export const DEPT_COLOR: Record<string, string> = {
  "d-aud": "var(--color-dept-aud)",
  "d-ec": "var(--color-dept-ec)",
  "d-cjf": "var(--color-dept-cjf)",
  "d-sc": "var(--color-dept-sc)",
  "d-trx": "var(--color-dept-trx)",
};
export const deptColor = (id: string) => DEPT_COLOR[id] ?? "var(--color-s7)";
export const initials = (p: { firstName: string; lastName: string }) => `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();

type L = { label: string; tone: Tone };
export const PROJECT_STATUS: Record<ProjectStatus, L> = {
  EN_ATTENTE_STAFFING: { label: "En attente de staffing", tone: "alert" },
  A_VENIR: { label: "À venir", tone: "info" },
  ACTIVE: { label: "En cours", tone: "ok" },
  TERMINEE: { label: "Terminée", tone: "neutral" },
  ANNULEE: { label: "Annulée", tone: "neutral" },
};
export const ASSIGNMENT_STATUS: Record<AssignmentStatus, L> = {
  HARD: { label: "Confirmée", tone: "ok" },
  SOFT: { label: "Réservation", tone: "info" },
  ANNULEE: { label: "Annulée", tone: "neutral" },
  TERMINEE: { label: "Terminée", tone: "neutral" },
};
export const REQUEST_STATUS: Record<RequestStatus, L> = {
  BROUILLON: { label: "Brouillon", tone: "neutral" },
  SOUMISE: { label: "Soumise", tone: "info" },
  EN_ANALYSE: { label: "En analyse", tone: "primary" },
  PROPOSITION_ENVOYEE: { label: "Proposition envoyée", tone: "primary" },
  EN_ATTENTE_VALIDATION: { label: "En attente de validation", tone: "alert" },
  APPROUVEE: { label: "Approuvée", tone: "ok" },
  REJETEE: { label: "Rejetée", tone: "conflict" },
  ANNULEE: { label: "Annulée", tone: "neutral" },
  SATISFAITE: { label: "Satisfaite", tone: "ok" },
};
export const WORK_MODE: Record<WorkMode, { label: string; short: string }> = {
  ONSITE: { label: "Présentiel", short: "Sur site" },
  REMOTE: { label: "À distance", short: "À distance" },
};
export const PRIORITY: Record<Priority, L> = {
  BASSE: { label: "Basse", tone: "neutral" },
  NORMALE: { label: "Normale", tone: "neutral" },
  HAUTE: { label: "Haute", tone: "alert" },
  URGENTE: { label: "Urgente", tone: "conflict" },
};
export const CERTAINTY: Record<Certainty, L> = {
  CONFIRMEE: { label: "Confirmée", tone: "ok" },
  PROBABLE: { label: "Probable", tone: "info" },
  OPPORTUNITE: { label: "Opportunité", tone: "neutral" },
};
export const SKILL_LEVEL_LABEL = ["", "Débutant", "Intermédiaire", "Avancé", "Expert"];
export type { Role };
