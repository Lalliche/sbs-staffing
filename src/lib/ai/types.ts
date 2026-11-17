/* SBS Staffing Intelligence — answer model. Every answer is a STRUCTURED object (text + figures + source line),
   never free generated prose: the prototype is a deterministic router over real store queries (spec 8.15). */

export type IntentId =
  | "staffing"
  | "availability_grade"
  | "who_available"
  | "overloaded_dept"
  | "unstaffed"
  | "skills_gap"
  | "utilization"
  | "presence"
  | "risks"
  | "cost"
  | "person"
  | "assign_refuse"
  | "cv"
  | "help";

export interface AiFigure {
  label: string;
  /** Formatted for display (fr-FR). */
  value: string;
  /** Machine value, kept for tests and exports. */
  raw?: number;
  hint?: string;
}
export interface AiTableColumn {
  key: string;
  label: string;
  align?: "start" | "end";
}
export interface AiTable {
  caption: string;
  columns: AiTableColumn[];
  rows: { cells: Record<string, string>; href?: string; tone?: "ok" | "alert" | "conflict" }[];
}
export interface AiLink {
  label: string;
  href: string;
}

export interface AiAnswer {
  /** `refusal`: RBAC or policy refusal · `unknown`: honest « je ne sais pas ». */
  kind: "answer" | "refusal" | "unknown";
  intent: IntentId | null;
  title?: string;
  text: string;
  figures: AiFigure[];
  /** « Basé sur 12 collaborateurs, période …, heures … » — mandatory on every data answer. */
  source: string;
  links: AiLink[];
  table?: AiTable;
  /** Inputs inferred or defaulted by the router, always SHOWN to the user. */
  assumptions?: string[];
  suggestions?: string[];
  /** Ask the UI to open the CV analysis flow. */
  action?: "cv";
}
