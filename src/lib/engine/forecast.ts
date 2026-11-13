/* Capacity planning / forecast (spec 7.8): available capacity vs certainty-weighted demand, by grade and by skill.
   Demand = UNFILLED seats of non-finished missions + pipeline needs, weighted by certainty (default 100 / 60 / 25 %).
   Seats already covered by HARD assignments are not demand any more — their hours are already deducted from supply. */
import type { AppState, Certainty, Grade, ISODate, PipelineItem } from "../store/types";
import { availableHours, workingDays } from "./capacity";
import { addMonths, maxD, minD, monthEnd, monthsBetween, monthStart, overlaps } from "./dates";
import { requirementCoverage } from "./booking";
import { eachDay } from "./dates";

type S = Pick<AppState, "employees" | "offices" | "holidays" | "leaves" | "assignments" | "settings" | "projects" | "requirements" | "pipeline" | "grades" | "employeeSkills" | "skills" | "departments" | "clients">;

export interface ForecastParams {
  from: ISODate;
  horizonMonths: 1 | 3 | 6 | 12;
  weights?: Record<Certainty, number>;
  /** Hypothetical items (what-if). */
  extraItems?: PipelineItem[];
  includeSoft?: boolean;
  departmentId?: string;
  /** Extra headcount per grade (what-if "add a hire"). */
  extraHires?: Record<string, number>;
}
export interface DemandItem {
  source: "PROJECT" | "PIPELINE";
  sourceId: string;
  name: string;
  certainty: Certainty;
  weight: number; // 0..1
  gradeId: string;
  skillIds: string[];
  seats: number;
  allocationPct: number;
  start: ISODate;
  end: ISODate;
  departmentId: string;
  sector: string;
}

export const horizonEnd = (p: Pick<ForecastParams, "from" | "horizonMonths">): ISODate => monthEnd(addMonths(monthStart(p.from), p.horizonMonths - 1));

export function demandItems(state: S, p: ForecastParams): DemandItem[] {
  const w = p.weights ?? state.settings.forecastWeights;
  const end = horizonEnd(p);
  const out: DemandItem[] = [];
  for (const r of state.requirements) {
    const proj = state.projects.find((x) => x.id === r.projectId);
    if (!proj || proj.status === "TERMINEE" || proj.status === "ANNULEE") continue;
    if (p.departmentId && proj.departmentId !== p.departmentId) continue;
    if (!overlaps(r.startDate, r.endDate, p.from, end)) continue;
    const cov = requirementCoverage(state, r);
    const covered = p.includeSoft ? Math.min(r.quantity, cov.hard + cov.soft) : cov.hard;
    const seats = Math.max(0, r.quantity - covered);
    if (!seats) continue;
    out.push({ source: "PROJECT", sourceId: r.id, name: proj.name, certainty: proj.certainty, weight: (w[proj.certainty] ?? 0) / 100, gradeId: r.gradeMin, skillIds: r.mandatorySkillIds, seats, allocationPct: r.allocationPct, start: r.startDate, end: r.endDate, departmentId: proj.departmentId, sector: proj.sector });
  }
  for (const it of [...state.pipeline, ...(p.extraItems ?? [])]) {
    if (p.departmentId && it.departmentId !== p.departmentId) continue;
    if (!overlaps(it.startDate, it.endDate, p.from, end)) continue;
    for (const n of it.needs) out.push({ source: "PIPELINE", sourceId: it.id, name: it.name, certainty: it.certainty, weight: (w[it.certainty] ?? 0) / 100, gradeId: n.gradeId, skillIds: n.skillIds, seats: n.quantity, allocationPct: n.allocationPct, start: it.startDate, end: it.endDate, departmentId: it.departmentId, sector: it.sector });
  }
  return out;
}

/** Standard office calendar (first office) for converting demand into hours. */
function standardDays(state: S, start: ISODate, end: ISODate): number {
  const office = state.offices[0];
  const wk = office?.workingWeekdays ?? [1, 2, 3, 4, 5];
  const hol = new Set(state.holidays.filter((h) => h.officeId === null || h.officeId === office?.id).map((h) => h.date));
  return eachDay(start, end).filter((d) => wk.includes(new Date(`${d}T00:00:00Z`).getUTCDay()) && !hol.has(d)).length;
}
const stdDailyHours = (state: S) => state.settings.standardWeeklyHours / (state.offices[0]?.workingWeekdays.length || 5);

export const demandHours = (state: S, d: DemandItem, from: ISODate, to: ISODate): number => {
  const s = maxD(d.start, from);
  const e = minD(d.end, to);
  if (s > e) return 0;
  return d.seats * (d.allocationPct / 100) * standardDays(state, s, e) * stdDailyHours(state) * d.weight;
};

export const fteHours = (state: S, from: ISODate, to: ISODate) => standardDays(state, from, to) * stdDailyHours(state);
const roundDeficit = (x: number) => Math.ceil(Math.round(x * 10) / 10 - 1e-9);

function supplyOf(state: S, empIds: string[], from: ISODate, to: ISODate, includeSoft?: boolean) {
  let h = 0;
  for (const id of empIds) {
    const e = state.employees.find((x) => x.id === id);
    if (e) h += availableHours(state, e, from, to, { includeSoft });
  }
  return h;
}
const activeEmps = (state: S, departmentId?: string) => state.employees.filter((e) => e.status !== "ARCHIVE" && (!departmentId || e.departmentId === departmentId));
const holdersOf = (state: S, skillId: string, departmentId?: string) =>
  activeEmps(state, departmentId).filter((e) => state.employeeSkills.some((x) => x.employeeId === e.id && x.skillId === skillId && x.level >= 2));

export interface MonthPoint {
  key: string;
  start: ISODate;
  supplyFte: number;
  demandFte: number;
  balanceFte: number;
}
interface SeriesFilter {
  gradeId?: string;
  skillId?: string;
}
/** Month-by-month supply vs demand (FTE). The deficit of a horizon is its WORST month, not an average. */
function series(state: S, p: ForecastParams, f: SeriesFilter = {}): MonthPoint[] {
  const to = horizonEnd(p);
  const items = demandItems(state, p).filter((d) => (!f.gradeId || d.gradeId === f.gradeId) && (!f.skillId || d.skillIds.includes(f.skillId)));
  const emps = f.skillId ? holdersOf(state, f.skillId, p.departmentId) : activeEmps(state, p.departmentId).filter((e) => !f.gradeId || e.gradeId === f.gradeId);
  return monthsBetween(p.from, to).map((m) => {
    const from = maxD(m.start, p.from);
    const fte = fteHours(state, from, m.end);
    const extra = f.gradeId ? p.extraHires?.[f.gradeId] ?? 0 : f.skillId ? 0 : Object.values(p.extraHires ?? {}).reduce((a, b) => a + b, 0);
    const supply = supplyOf(state, emps.map((e) => e.id), from, m.end, p.includeSoft) + extra * fte;
    const demand = items.reduce((sum, d) => sum + demandHours(state, d, from, m.end), 0);
    return { key: m.key, start: m.start, supplyFte: fte ? supply / fte : 0, demandFte: fte ? demand / fte : 0, balanceFte: fte ? (supply - demand) / fte : 0 };
  });
}
export const monthlySeries = (state: S, p: ForecastParams, gradeId?: string): MonthPoint[] => series(state, p, { gradeId });

export interface GradeForecast {
  gradeId: string;
  gradeName: string;
  headcount: number;
  /** Averages over the months where demand exists (display). */
  supplyFte: number;
  demandFte: number;
  /** Worst month. */
  peakDeficitFte: number;
  peakMonth: string | null;
  deficitPersons: number;
  /** Persons that stay free in every month. */
  surplusPersons: number;
  months: MonthPoint[];
}
function summarise(months: MonthPoint[]) {
  const active = months.filter((m) => m.demandFte > 0.01);
  const avg = (k: "supplyFte" | "demandFte") => (active.length ? active.reduce((a, m) => a + m[k], 0) / active.length : months.length ? months.reduce((a, m) => a + m[k], 0) / months.length : 0);
  const worst = months.reduce<MonthPoint | null>((w, m) => (!w || m.balanceFte < w.balanceFte ? m : w), null);
  const peakDeficit = worst && worst.balanceFte < 0 ? -worst.balanceFte : 0;
  const minBal = worst ? worst.balanceFte : 0;
  return { supplyFte: avg("supplyFte"), demandFte: avg("demandFte"), peakDeficitFte: peakDeficit, peakMonth: peakDeficit > 0 ? worst!.key : null, deficitPersons: peakDeficit > 0 ? roundDeficit(peakDeficit) : 0, surplusPersons: minBal > 0 ? Math.floor(Math.round(minBal * 10) / 10 + 1e-9) : 0 };
}

export function forecastByGrade(state: S, p: ForecastParams): GradeForecast[] {
  return [...state.grades]
    .sort((a, b) => a.rank - b.rank)
    .map((g: Grade) => {
      const months = series(state, p, { gradeId: g.id });
      return { gradeId: g.id, gradeName: g.name, headcount: activeEmps(state, p.departmentId).filter((e) => e.gradeId === g.id).length, months, ...summarise(months) };
    });
}

export interface SkillForecast {
  skillId: string;
  skillName: string;
  supplyFte: number;
  demandFte: number;
  peakDeficitFte: number;
  deficitPersons: number;
  holders: number;
}
/** Per skill. NOT additive across skills (one person can hold several). A holder = level ≥ 2. */
export function forecastBySkill(state: S, p: ForecastParams): SkillForecast[] {
  const items = demandItems(state, p);
  const wanted = new Set(items.flatMap((d) => d.skillIds));
  const out: SkillForecast[] = [];
  for (const sk of state.skills) {
    if (!wanted.has(sk.id)) continue;
    const months = series(state, p, { skillId: sk.id });
    const sm = summarise(months);
    out.push({ skillId: sk.id, skillName: sk.name, supplyFte: sm.supplyFte, demandFte: sm.demandFte, peakDeficitFte: sm.peakDeficitFte, deficitPersons: sm.deficitPersons, holders: holdersOf(state, sk.id, p.departmentId).length });
  }
  return out.sort((a, b) => b.peakDeficitFte - a.peakDeficitFte);
}

export interface RecruitmentNeed {
  gradeId: string;
  gradeName: string;
  persons: number;
  /** First month where the monthly balance is negative. */
  firstDeficitMonth: string | null;
  drivers: { name: string; certainty: Certainty; fte: number }[];
}
export function recruitmentNeeds(state: S, p: ForecastParams): RecruitmentNeed[] {
  const to = horizonEnd(p);
  const items = demandItems(state, p);
  const fte = fteHours(state, p.from, to);
  return forecastByGrade(state, p)
    .filter((g) => g.deficitPersons > 0)
    .map((g) => {
      const first = g.months.find((m) => m.balanceFte < -0.1);
      const drivers = items
        .filter((d) => d.gradeId === g.gradeId)
        .map((d) => ({ name: d.name, certainty: d.certainty, fte: fte ? demandHours(state, d, p.from, to) / fte : 0 }))
        .sort((a, b) => b.fte - a.fte)
        .slice(0, 4);
      return { gradeId: g.gradeId, gradeName: g.gradeName, persons: g.deficitPersons, firstDeficitMonth: first?.key ?? null, drivers };
    });
}

const PLURAL_EXCEPTIONS: Record<string, string> = {};
/** "Déficit : 2 Seniors" */
export function deficitLabel(gradeName: string, n: number): string {
  const base = PLURAL_EXCEPTIONS[gradeName] ?? (n > 1 ? `${gradeName}s` : gradeName);
  return `Déficit : ${n} ${base}`;
}
export function availableCountByGrade(state: S, gradeId: string, from: ISODate, to: ISODate, minFreePct = 50): number {
  // "free" Seniors in a period = people whose free capacity share ≥ minFreePct
  const emps = activeEmps(state).filter((e) => e.gradeId === gradeId);
  let n = 0;
  for (const e of emps) {
    const total = workingDays(state, e, from, to).length;
    if (!total) continue;
    const avail = availableHours(state, e, from, to);
    const theo = (e.weeklyHours / (state.offices.find((o) => o.id === e.officeId)?.workingWeekdays.length || 5)) * total;
    if (theo && (avail / theo) * 100 >= minFreePct) n++;
  }
  return n;
}
