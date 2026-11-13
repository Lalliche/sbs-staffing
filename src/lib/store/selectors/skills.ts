/* Skills read layer (spec 8.6): referential, per-person levels, advanced search, heat-coloured matrix. */
import { availableHours, theoreticalHours } from "../../engine/capacity";
import { addDays, diffDays } from "../../engine/dates";
import type { AppState, Certification, EmployeeSkill, ISODate, Skill, SkillLevel } from "../types";
import { canDo, employeeById, myEmployee, userName, visibleEmployees, type EmployeeView } from "./core";
import { availabilityOf, certStateOf, normalize, weeklyAvailability, type AvailabilityInfo, type WeekAvailability } from "./people";

export const LEVELS: SkillLevel[] = [1, 2, 3, 4];
export const levelLabel = (s: AppState, level: number): string => s.settings.skillLevelLabels[level - 1] ?? "—";

/* ------------------------------------------------------------------ referential */
export interface SkillRow {
  skill: Skill;
  categoryName: string;
  certifications: Certification[];
  /** People the viewer may see who hold the skill (any level). */
  holders: number;
  /** Of which at or above the expected level. */
  atExpected: number;
}
export interface SkillFilters {
  q?: string;
  category?: string;
  includeInactive?: boolean;
}
export function skillRows(s: AppState, f: SkillFilters = {}): SkillRow[] {
  if (!canDo(s, "skill.view")) return [];
  const q = normalize(f.q ?? "");
  const people = new Set(visibleEmployees(s).map((e) => e.id));
  return s.skills
    .filter((k) => (f.includeInactive ? true : k.active) && (!f.category || k.categoryId === f.category))
    .map((skill): SkillRow => {
      const held = s.employeeSkills.filter((x) => x.skillId === skill.id && people.has(x.employeeId));
      return {
        skill,
        categoryName: s.skillCategories.find((c) => c.id === skill.categoryId)?.name ?? "—",
        certifications: skill.certificationIds.map((id) => s.certifications.find((c) => c.id === id)).filter((c): c is Certification => !!c),
        holders: held.length,
        atExpected: held.filter((x) => x.level >= skill.expectedLevel).length,
      };
    })
    .filter((r) => !q || normalize(`${r.skill.name} ${r.categoryName} ${r.skill.description} ${r.certifications.map((c) => c.name).join(" ")}`).includes(q))
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, "fr") || a.skill.name.localeCompare(b.skill.name, "fr"));
}
export function categoryCounts(s: AppState, f: Pick<SkillFilters, "includeInactive"> = {}): Array<{ id: string; name: string; count: number }> {
  return s.skillCategories.map((c) => ({ id: c.id, name: c.name, count: s.skills.filter((k) => k.categoryId === c.id && (f.includeInactive || k.active)).length }));
}

/* ------------------------------------------------------------------ per person */
export interface EmployeeSkillRow {
  skillId: string;
  name: string;
  categoryName: string;
  expectedLevel: SkillLevel;
  /** Level on the record: validated by a manager when `validated`, otherwise declared. */
  level: SkillLevel;
  selfLevel?: SkillLevel;
  validated: boolean;
  validatedByName?: string;
  validatedAt?: ISODate;
  updatedAt: ISODate;
  evidence?: string;
  experienceNote?: string;
  /** Self-assessment (or a first declaration) not yet reviewed by a manager. */
  needsValidation: boolean;
  /** Self-assessment above the validated level. */
  gap: boolean;
  active: boolean;
}
export const needsValidation = (x: Pick<EmployeeSkill, "validatedById" | "validatedAt" | "updatedAt">): boolean => !x.validatedById || (!!x.validatedAt && x.updatedAt > x.validatedAt);

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
        selfLevel: x.selfLevel,
        validated: !!x.validatedById,
        validatedByName: x.validatedById ? userName(s, x.validatedById) : undefined,
        validatedAt: x.validatedAt,
        updatedAt: x.updatedAt,
        evidence: x.evidence,
        experienceNote: x.experienceNote,
        needsValidation: needsValidation(x),
        gap: x.selfLevel !== undefined && x.selfLevel > x.level,
        active: k?.active ?? true,
      };
    })
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "fr"));
}
/** The viewer's own level on a skill (for the « Mon niveau » column). */
export function myLevels(s: AppState): Map<string, EmployeeSkillRow> {
  const me = myEmployee(s);
  return new Map(me ? employeeSkillRows(s, me.id).map((r) => [r.skillId, r]) : []);
}
/** People whose declared levels still await a manager (limited to the viewer's validation scope). */
export function pendingValidations(s: AppState): Array<{ employeeId: string; name: string; count: number }> {
  if (!canDo(s, "skill.validate")) return [];
  const me = myEmployee(s);
  const by = new Map<string, number>();
  for (const x of s.employeeSkills) {
    if (!needsValidation(x) || x.employeeId === me?.id) continue;
    if (!canDo(s, "skill.validate", { employeeId: x.employeeId }) || !employeeById(s, x.employeeId)) continue;
    if (s.employees.find((e) => e.id === x.employeeId)?.status === "ARCHIVE") continue;
    by.set(x.employeeId, (by.get(x.employeeId) ?? 0) + 1);
  }
  return [...by.entries()].map(([employeeId, count]) => ({ employeeId, count, name: userName(s, employeeId) })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
}

/* ------------------------------------------------------------------ advanced search */
export interface SkillCriterion {
  skillId: string;
  minLevel: SkillLevel;
}
export interface SearchCriteria {
  skills: SkillCriterion[];
  sector?: string;
  certificationId?: string;
  gradeId?: string;
  departmentId?: string;
  from?: ISODate;
  to?: ISODate;
  /** Keep only people whose free share of the window reaches settings.minAvailabilityRatio. */
  availableOnly?: boolean;
  /** `all`: every condition must match; `any`: at least one. */
  mode?: "all" | "any";
  q?: string;
}
export interface SkillMatch {
  skillId: string;
  name: string;
  required: SkillLevel;
  level: SkillLevel | 0;
  ok: boolean;
  validated: boolean;
}
export interface SearchHit {
  employee: EmployeeView;
  gradeName: string;
  departmentName: string;
  skills: SkillMatch[];
  sector: { wanted: string; ok: boolean } | null;
  certification: { wanted: string; ok: boolean; state?: "VALID" | "EXPIRING" | "EXPIRED"; expiresAt?: ISODate } | null;
  matched: number;
  total: number;
  /** Free share of the window (0..1), from the engine. */
  freeRatio: number;
  freeHours: number;
  availability: AvailabilityInfo;
  weeks: WeekAvailability[];
}
export const defaultWindow = (s: AppState): { from: ISODate; to: ISODate } => ({ from: s.now, to: addDays(s.now, 27) });

export function sectorsOf(s: AppState): string[] {
  return [...new Set([...s.employees.flatMap((e) => e.sectors), ...s.clients.map((c) => c.sector)])].sort((a, b) => a.localeCompare(b, "fr"));
}

export function searchPeople(s: AppState, c: SearchCriteria): SearchHit[] {
  if (!canDo(s, "skill.search")) return [];
  const win = { from: c.from || defaultWindow(s).from, to: c.to || defaultWindow(s).to };
  const to = win.to < win.from ? win.from : win.to;
  const q = normalize(c.q ?? "");
  const total = c.skills.length + (c.sector ? 1 : 0) + (c.certificationId ? 1 : 0);
  const cert = c.certificationId ? s.certifications.find((x) => x.id === c.certificationId) : undefined;
  const weeks = Math.min(6, Math.max(1, Math.ceil((diffDays(win.from, to) + 1) / 7)));
  const hits: SearchHit[] = [];
  for (const emp of visibleEmployees(s)) {
    if (emp.status === "ARCHIVE") continue;
    if (c.gradeId && emp.gradeId !== c.gradeId) continue;
    if (c.departmentId && emp.departmentId !== c.departmentId) continue;
    const gradeName = s.grades.find((g) => g.id === emp.gradeId)?.name ?? "—";
    const departmentName = s.departments.find((d) => d.id === emp.departmentId)?.name ?? "—";
    if (q && !normalize(`${emp.firstName} ${emp.lastName} ${emp.matricule} ${emp.jobTitle} ${departmentName}`).includes(q)) continue;
    const skills = c.skills.map((cr): SkillMatch => {
      const held = s.employeeSkills.find((x) => x.employeeId === emp.id && x.skillId === cr.skillId);
      const level = (held?.level ?? 0) as SkillLevel | 0;
      return { skillId: cr.skillId, name: s.skills.find((k) => k.id === cr.skillId)?.name ?? cr.skillId, required: cr.minLevel, level, ok: level >= cr.minLevel, validated: !!held?.validatedById };
    });
    const sector = c.sector ? { wanted: c.sector, ok: emp.sectors.includes(c.sector) } : null;
    const owned = cert ? s.employeeCertifications.find((x) => x.employeeId === emp.id && x.certificationId === cert.id) : undefined;
    const st = owned ? certStateOf(owned.expiresAt, s.now).state : undefined;
    const certification = cert ? { wanted: cert.name, ok: !!owned && st !== "EXPIRED", state: st, expiresAt: owned?.expiresAt } : null;
    const matched = skills.filter((x) => x.ok).length + (sector?.ok ? 1 : 0) + (certification?.ok ? 1 : 0);
    if (total > 0 && (c.mode === "any" ? matched === 0 : matched < total)) continue;
    const raw = s.employees.find((e) => e.id === emp.id)!;
    const theo = theoreticalHours(s, raw, win.from, to);
    const free = availableHours(s, raw, win.from, to);
    const freeRatio = theo > 0 ? free / theo : 0;
    if (c.availableOnly && freeRatio < s.settings.minAvailabilityRatio) continue;
    hits.push({
      employee: emp,
      gradeName,
      departmentName,
      skills,
      sector,
      certification,
      matched,
      total,
      freeRatio,
      freeHours: free,
      availability: availabilityOf(s, emp.id, win.from, to),
      weeks: weeklyAvailability(s, emp.id, win.from, weeks),
    });
  }
  const strength = (h: SearchHit) => h.skills.reduce((n, x) => n + x.level, 0);
  return hits.sort((a, b) => b.matched - a.matched || strength(b) - strength(a) || b.freeRatio - a.freeRatio || a.employee.lastName.localeCompare(b.employee.lastName, "fr"));
}

/* ------------------------------------------------------------------ matrix */
export type MatrixAxis = "department" | "grade" | "sector";
export const AXIS_LABEL: Record<MatrixAxis, string> = { department: "Département", grade: "Grade", sector: "Secteur" };
export type MatrixMetric = "count" | "avg";
export interface MatrixOptions {
  rows: MatrixAxis;
  cols: MatrixAxis;
  /** A skill id, `cat:<categoryId>` or `all`. */
  skill: string;
  minLevel: SkillLevel;
  metric: MatrixMetric;
  /** Restrict to one sector, one department or one grade (any of the three axes). */
  sector?: string;
  department?: string;
  grade?: string;
}
export interface MatrixPerson {
  id: string;
  name: string;
  level: SkillLevel;
}
export interface MatrixCell {
  rowKey: string;
  colKey: string;
  count: number;
  avg: number | null;
  value: number;
  people: MatrixPerson[];
}
export interface Matrix {
  rows: Array<{ key: string; label: string }>;
  cols: Array<{ key: string; label: string }>;
  cells: MatrixCell[][];
  max: number;
  /** Distinct people counted at least once (a person with two sectors appears in two cells but is counted once here). */
  people: number;
  skillLabel: string;
}
export function skillSelection(s: AppState, sel: string): { ids: string[]; label: string } {
  if (sel === "all") return { ids: s.skills.filter((k) => k.active).map((k) => k.id), label: "Toutes les compétences" };
  if (sel.startsWith("cat:")) {
    const id = sel.slice(4);
    return { ids: s.skills.filter((k) => k.categoryId === id && k.active).map((k) => k.id), label: `Catégorie ${s.skillCategories.find((c) => c.id === id)?.name ?? id}` };
  }
  return { ids: s.skills.some((k) => k.id === sel) ? [sel] : [], label: s.skills.find((k) => k.id === sel)?.name ?? sel };
}
/** Heat step 1..8 for the `--color-ramp-*` tokens; 0 = empty cell. */
export function rampStep(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(8, Math.max(1, Math.ceil((value / max) * 8)));
}
export function skillMatrix(s: AppState, o: MatrixOptions): Matrix {
  const sel = skillSelection(s, o.skill);
  const axisKeys = (axis: MatrixAxis) =>
    axis === "department"
      ? s.departments.map((d) => ({ key: d.id, label: d.name }))
      : axis === "grade"
        ? [...s.grades].sort((a, b) => a.rank - b.rank).map((g) => ({ key: g.id, label: g.name }))
        : sectorsOf(s).map((x) => ({ key: x, label: x }));
  const keysOf = (e: EmployeeView, axis: MatrixAxis): string[] => (axis === "department" ? [e.departmentId] : axis === "grade" ? [e.gradeId] : e.sectors);
  const rows = axisKeys(o.rows);
  const cols = axisKeys(o.cols);
  const empty = { rows, cols, cells: rows.map((r) => cols.map((c) => ({ rowKey: r.key, colKey: c.key, count: 0, avg: null, value: 0, people: [] as MatrixPerson[] }))), max: 0, people: 0, skillLabel: sel.label };
  if (!canDo(s, "skill.search")) return empty;
  const buckets = new Map<string, MatrixPerson[]>();
  const counted = new Set<string>();
  for (const e of visibleEmployees(s)) {
    if (e.status === "ARCHIVE") continue;
    if (o.sector && !e.sectors.includes(o.sector)) continue;
    if (o.department && e.departmentId !== o.department) continue;
    if (o.grade && e.gradeId !== o.grade) continue;
    const best = s.employeeSkills.filter((x) => x.employeeId === e.id && sel.ids.includes(x.skillId)).reduce((m, x) => Math.max(m, x.level), 0);
    if (best < o.minLevel) continue;
    const person: MatrixPerson = { id: e.id, name: `${e.firstName} ${e.lastName}`, level: best as SkillLevel };
    counted.add(e.id);
    for (const r of keysOf(e, o.rows)) for (const c of keysOf(e, o.cols)) {
      const k = `${r}|${c}`;
      const l = buckets.get(k);
      if (l) l.push(person);
      else buckets.set(k, [person]);
    }
  }
  let max = 0;
  const cells = rows.map((r) =>
    cols.map((c): MatrixCell => {
      const people = (buckets.get(`${r.key}|${c.key}`) ?? []).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "fr"));
      const avg = people.length ? people.reduce((n, p) => n + p.level, 0) / people.length : null;
      const value = o.metric === "avg" ? avg ?? 0 : people.length;
      max = Math.max(max, value);
      return { rowKey: r.key, colKey: c.key, count: people.length, avg, value, people };
    }),
  );
  // Level scale is absolute for the average (1..4), so the ramp reads the same whatever the filter.
  return { rows, cols, cells, max: o.metric === "avg" ? 4 : max, people: counted.size, skillLabel: sel.label };
}
