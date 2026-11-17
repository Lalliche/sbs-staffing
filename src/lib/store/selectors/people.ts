/* People read layer (spec 8.5). Everything the Collaborateurs list and the fiche show is derived here:
   scope + sensitive fields come from core.ts (visibleEmployees / employeeById), numbers from the engine. */
import { averageLoadPct, availableHours, dayLoads, peakLoadPct, theoreticalHours, workingDays, type DayLoad } from "../../engine/capacity";
import { addDays, diffDays, monthEnd, monthStart, weekStart } from "../../engine/dates";
import { statusOf, utilizationOf, type UtilizationStatus } from "../../engine/utilization";
import type { AppState, Assignment, DocumentMeta, Employee, EmployeeStatus, ISODate, SkillLevel } from "../types";
import { presenceOfEmployeeOn } from "./presence";
import type { Presence } from "../../engine/workmode";
import { employeeById, visibleAssignments, visibleEmployees, type EmployeeView } from "./core";

/* ------------------------------------------------------------------ availability */
export type Availability = "LIBRE" | "PARTIELLE" | "PLEINE" | "SURCHARGEE" | "INDISPONIBLE";
export const AVAILABILITY_LABEL: Record<Availability, string> = { LIBRE: "Libre", PARTIELLE: "Partielle", PLEINE: "Pleine", SURCHARGEE: "Surchargée", INDISPONIBLE: "Indisponible" };
/** Design-system bands (docs/design-system.md §2): 0–49 % libre, 50–84 % partielle, 85–100 % pleine, above the overload threshold surchargée. */
export function availabilityBand(loadPct: number, overload = 100): Exclude<Availability, "INDISPONIBLE"> {
  if (loadPct > overload) return "SURCHARGEE";
  if (loadPct >= 85) return "PLEINE";
  if (loadPct >= 50) return "PARTIELLE";
  return "LIBRE";
}
export interface AvailabilityInfo {
  status: Availability;
  /** Mean load on the days the person is present (hard, +soft when settings say so). */
  avgPct: number;
  peakPct: number;
  from: ISODate;
  to: ISODate;
}
const raw = (s: AppState, id: string): Employee | undefined => s.employees.find((e) => e.id === id);

/** Availability of one person over a window. Engine does the load maths; this only classifies it. */
export function availabilityOf(s: AppState, employeeId: string, from: ISODate, to: ISODate): AvailabilityInfo {
  const e = raw(s, employeeId);
  const base = { avgPct: 0, peakPct: 0, from, to };
  if (!e || e.status === "ARCHIVE") return { status: "INDISPONIBLE", ...base };
  const present = dayLoads(s, e, from, to).filter((l) => l.working && !l.absent);
  if (!present.length) return { status: "INDISPONIBLE", ...base };
  const soft = s.settings.includeSoftInUtilization;
  const avgPct = averageLoadPct(s, e, from, to, soft);
  const peakPct = peakLoadPct(s, e, from, to, soft);
  const status = peakPct > s.settings.thresholds.overload ? "SURCHARGEE" : availabilityBand(avgPct, s.settings.thresholds.overload);
  return { status, avgPct, peakPct, from, to };
}
/** The horizon of the list column: the next four weeks from the demo clock. */
export const horizonOf = (s: AppState): { from: ISODate; to: ISODate } => ({ from: s.now, to: addDays(s.now, 27) });

export interface WeekAvailability {
  weekStart: ISODate;
  weekEnd: ISODate;
  info: AvailabilityInfo;
}
/** Week-by-week availability (search results, fiche). */
export function weeklyAvailability(s: AppState, employeeId: string, from: ISODate, weeks: number): WeekAvailability[] {
  const first = weekStart(from);
  return Array.from({ length: weeks }, (_, i) => {
    const ws = addDays(first, i * 7);
    const we = addDays(ws, 6);
    return { weekStart: ws, weekEnd: we, info: availabilityOf(s, employeeId, ws, we) };
  });
}

/* ------------------------------------------------------------------ list */
export interface TopSkill {
  skillId: string;
  name: string;
  level: SkillLevel;
}
export interface PeopleRow {
  id: string;
  emp: EmployeeView;
  fullName: string;
  gradeName: string;
  gradeRank: number;
  departmentName: string;
  officeName: string;
  managerId: string | null;
  managerName: string;
  topSkills: TopSkill[];
  skillIds: string[];
  /** Planned utilization of the current month (null for archived people). */
  utilization: number | null;
  utilizationStatus: UtilizationStatus | null;
  availability: AvailabilityInfo;
  /** Présentiel / à distance on the demo « today » (null when the viewer may not see presence). */
  presence: Presence | null;
}

export function topSkillsOf(s: AppState, employeeId: string, n = 3): TopSkill[] {
  return s.employeeSkills
    .filter((x) => x.employeeId === employeeId)
    .map((x) => ({ skillId: x.skillId, name: s.skills.find((k) => k.id === x.skillId)?.name ?? x.skillId, level: x.level }))
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "fr"))
    .slice(0, n);
}

/** Every person the viewer may open (archived included — the list filters them by saved view). */
export function peopleRows(s: AppState): PeopleRow[] {
  const { from, to } = horizonOf(s);
  const m0 = monthStart(s.now);
  const m1 = monthEnd(s.now);
  return visibleEmployees(s, { includeArchived: true }).map((emp) => {
    const r = raw(s, emp.id)!;
    const grade = s.grades.find((g) => g.id === emp.gradeId);
    const archived = emp.status === "ARCHIVE";
    const planned = archived ? null : utilizationOf(s, r, m0, m1, { includeSoft: s.settings.includeSoftInUtilization }).planned;
    const mgr = s.employees.find((x) => x.id === emp.managerId);
    return {
      id: emp.id,
      emp,
      fullName: `${emp.firstName} ${emp.lastName}`,
      gradeName: grade?.name ?? "—",
      gradeRank: grade?.rank ?? 0,
      departmentName: s.departments.find((d) => d.id === emp.departmentId)?.name ?? "—",
      officeName: s.offices.find((o) => o.id === emp.officeId)?.name ?? "—",
      managerId: emp.managerId,
      managerName: mgr ? `${mgr.firstName} ${mgr.lastName}` : "—",
      topSkills: topSkillsOf(s, emp.id),
      skillIds: s.employeeSkills.filter((x) => x.employeeId === emp.id).map((x) => x.skillId),
      utilization: planned,
      utilizationStatus: planned === null ? null : statusOf(s, r, planned),
      availability: availabilityOf(s, emp.id, from, to),
      presence: presenceOfEmployeeOn(s, r, s.now),
    };
  });
}

export type PeopleView = "tous" | "actifs" | "sous-occupes" | "surcharges" | "archives";
export const PEOPLE_VIEWS: Array<{ value: PeopleView; label: string }> = [
  { value: "tous", label: "Tous" },
  { value: "actifs", label: "Actifs" },
  { value: "sous-occupes", label: "Sous-occupés" },
  { value: "surcharges", label: "Surchargés" },
  { value: "archives", label: "Archivés" },
];
export interface PeopleFilters {
  q?: string;
  dept?: string;
  grade?: string;
  office?: string;
  status?: string;
  skill?: string;
  view?: PeopleView;
}
export const normalize = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function inView(row: PeopleRow, view: PeopleView, explicitArchive = false): boolean {
  const archived = row.emp.status === "ARCHIVE";
  switch (view) {
    case "archives":
      return archived;
    case "actifs":
      return row.emp.status === "ACTIF";
    case "sous-occupes":
      return !archived && row.utilizationStatus === "UNDER";
    case "surcharges":
      return !archived && row.utilizationStatus === "OVER";
    default:
      return explicitArchive || !archived;
  }
}
/** Instant search + multi-criteria filters + saved view. */
export function filterPeople(rows: PeopleRow[], f: PeopleFilters): PeopleRow[] {
  const q = normalize(f.q ?? "");
  return rows.filter((r) => {
    if (!inView(r, f.view ?? "tous", f.status === "ARCHIVE")) return false;
    if (f.dept && r.emp.departmentId !== f.dept) return false;
    if (f.grade && r.emp.gradeId !== f.grade) return false;
    if (f.office && r.emp.officeId !== f.office) return false;
    if (f.status && r.emp.status !== (f.status as EmployeeStatus)) return false;
    if (f.skill && !r.skillIds.includes(f.skill)) return false;
    if (q) {
      const hay = normalize([r.fullName, r.emp.matricule, r.emp.jobTitle, r.emp.email, r.departmentName, r.gradeName, r.officeName, r.topSkills.map((k) => k.name).join(" ")].join(" "));
      if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}
/** Counts shown on the saved-view chips (they honour the other filters). */
export function viewCounts(rows: PeopleRow[], f: PeopleFilters): Record<PeopleView, number> {
  const out = {} as Record<PeopleView, number>;
  for (const v of PEOPLE_VIEWS) out[v.value] = filterPeople(rows, { ...f, view: v.value }).length;
  return out;
}
export const STATUS_LABEL: Record<EmployeeStatus, string> = { ACTIF: "Actif", CONGE_LONG: "Congé longue durée", ARCHIVE: "Archivé" };

export function peopleFilterOptions(s: AppState) {
  const opt = (a: Array<{ id: string; name: string }>) => a.map((x) => ({ value: x.id, label: x.name }));
  return {
    dept: opt(s.departments),
    grade: opt([...s.grades].sort((a, b) => a.rank - b.rank)),
    office: opt(s.offices),
    status: (Object.keys(STATUS_LABEL) as EmployeeStatus[]).map((v) => ({ value: v, label: STATUS_LABEL[v] })),
    skill: opt(s.skills.filter((k) => k.active).sort((a, b) => a.name.localeCompare(b.name, "fr"))),
  };
}
/** Can the viewer see cost columns at all? (only when the selector left the field in place) */
export const showsCost = (rows: PeopleRow[]) => rows.some((r) => typeof r.emp.dailyCost === "number");

/* ------------------------------------------------------------------ fiche */
export type FicheAccess = { kind: "ok"; emp: EmployeeView } | { kind: "forbidden" } | { kind: "missing" };
export function ficheAccess(s: AppState, id: string): FicheAccess {
  const e = employeeById(s, id);
  if (e) return { kind: "ok", emp: e };
  return s.employees.some((x) => x.id === id) ? { kind: "forbidden" } : { kind: "missing" };
}

export type CertState = "VALID" | "EXPIRING" | "EXPIRED";
export const EXPIRING_DAYS = 30;
export const certStateOf = (expiresAt: ISODate, now: ISODate): { state: CertState; daysLeft: number } => {
  const daysLeft = diffDays(now, expiresAt);
  return { state: daysLeft < 0 ? "EXPIRED" : daysLeft <= EXPIRING_DAYS ? "EXPIRING" : "VALID", daysLeft };
};
export interface CertRow {
  certificationId: string;
  name: string;
  issuer: string;
  obtainedAt: ISODate;
  expiresAt: ISODate;
  state: CertState;
  daysLeft: number;
}
export function employeeCertRows(s: AppState, employeeId: string): CertRow[] {
  if (!employeeById(s, employeeId)) return [];
  return s.employeeCertifications
    .filter((c) => c.employeeId === employeeId)
    .map((c) => {
      const cert = s.certifications.find((x) => x.id === c.certificationId);
      return { certificationId: c.certificationId, name: cert?.name ?? c.certificationId, issuer: cert?.issuer ?? "—", obtainedAt: c.obtainedAt, expiresAt: c.expiresAt, ...certStateOf(c.expiresAt, s.now) };
    })
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
}

export interface MissionRow {
  assignmentId: string;
  projectId: string;
  name: string;
  reference: string;
  clientName: string;
  start: ISODate;
  end: ISODate;
  allocationPct: number;
  plannedHours: number;
  status: Assignment["status"];
  projectStatus: string;
}
/** Current/upcoming vs past missions of one person (assignments the viewer may see). */
export function employeeMissions(s: AppState, employeeId: string): { current: MissionRow[]; past: MissionRow[] } {
  if (!employeeById(s, employeeId)) return { current: [], past: [] };
  const rows = visibleAssignments(s)
    .filter((a) => a.employeeId === employeeId && a.status !== "ANNULEE")
    .map((a): MissionRow => {
      const p = s.projects.find((x) => x.id === a.projectId);
      return {
        assignmentId: a.id,
        projectId: a.projectId,
        name: p?.name ?? a.projectId,
        reference: p?.reference ?? "—",
        clientName: s.clients.find((c) => c.id === p?.clientId)?.name ?? "—",
        start: a.startDate,
        end: a.endDate,
        allocationPct: a.allocationPct,
        plannedHours: a.plannedHours,
        status: a.status,
        projectStatus: p?.status ?? "",
      };
    });
  const isPast = (r: MissionRow) => r.status === "TERMINEE" || r.end < s.now;
  return { current: rows.filter((r) => !isPast(r)).sort((a, b) => a.start.localeCompare(b.start)), past: rows.filter(isPast).sort((a, b) => b.end.localeCompare(a.end)) };
}

export interface LoadCell {
  date: ISODate;
  working: boolean;
  absent: boolean;
  hardPct: number;
  softPct: number;
  totalPct: number;
  band: Availability;
}
/** Personal planning strip: per-day load straight from the engine (dayLoads). */
export function employeeLoadStrip(s: AppState, employeeId: string, from: ISODate, to: ISODate): LoadCell[] {
  const e = raw(s, employeeId);
  if (!e || !employeeById(s, employeeId)) return [];
  return dayLoads(s, e, from, to).map((l: DayLoad) => {
    const totalPct = l.hardPct + l.softPct;
    return { date: l.date, working: l.working, absent: l.absent, hardPct: l.hardPct, softPct: l.softPct, totalPct, band: !l.working || l.absent ? "INDISPONIBLE" : availabilityBand(totalPct, s.settings.thresholds.overload) };
  });
}

export function employeeDocuments(s: AppState, employeeId: string): DocumentMeta[] {
  if (!employeeById(s, employeeId)) return [];
  return s.documents.filter((d) => d.entity === "EMPLOYEE" && d.entityId === employeeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface FicheSummary {
  plannedMonthPct: number;
  /** Planned utilization over the 8 weeks that precede the current one. */
  windowPlannedPct: number;
  availability: AvailabilityInfo;
  currentMissions: number;
  expiringCerts: number;
  expiredCerts: number;
  theoreticalMonthHours: number;
  freeHoursNext4Weeks: number;
}
export function ficheSummary(s: AppState, employeeId: string): FicheSummary | undefined {
  const e = raw(s, employeeId);
  if (!e || !employeeById(s, employeeId)) return undefined;
  const soft = s.settings.includeSoftInUtilization;
  const m = utilizationOf(s, e, monthStart(s.now), monthEnd(s.now), { includeSoft: soft });
  const w1 = addDays(weekStart(s.now), -1);
  const w0 = addDays(w1, -55);
  const win = utilizationOf(s, e, w0, w1, { includeSoft: soft });
  const certs = employeeCertRows(s, employeeId);
  const h = horizonOf(s);
  return {
    plannedMonthPct: m.planned,
    windowPlannedPct: win.planned,
    availability: availabilityOf(s, employeeId, h.from, h.to),
    currentMissions: employeeMissions(s, employeeId).current.length,
    expiringCerts: certs.filter((c) => c.state === "EXPIRING").length,
    expiredCerts: certs.filter((c) => c.state === "EXPIRED").length,
    theoreticalMonthHours: m.theoretical,
    freeHoursNext4Weeks: availableHours(s, e, h.from, h.to),
  };
}
/** Working days of the horizon — helper for « jours ouvrés » captions. */
export const horizonWorkingDays = (s: AppState, employeeId: string): number => {
  const e = raw(s, employeeId);
  const h = horizonOf(s);
  return e ? workingDays(s, e, h.from, h.to).length : 0;
};
export const horizonTheoreticalHours = (s: AppState, employeeId: string): number => {
  const e = raw(s, employeeId);
  const h = horizonOf(s);
  return e ? theoreticalHours(s, e, h.from, h.to) : 0;
};

/** Default daily cost of an import/creation without an explicit value: median of the same grade (0 when none). */
export function defaultDailyCost(s: AppState, gradeId: string): number {
  const v = s.employees.filter((e) => e.gradeId === gradeId && e.dailyCost > 0).map((e) => e.dailyCost).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2);
}
