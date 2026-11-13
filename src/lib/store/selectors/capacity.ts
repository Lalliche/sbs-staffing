/* Capacity planning view-model (spec 8.10). All numbers come from engine/forecast.ts. */
import { addDays, addMonths, monthEnd, monthStart } from "../../engine/dates";
import { demandHours, demandItems, deficitLabel, fteHours, forecastByGrade, forecastBySkill, horizonEnd, recruitmentNeeds, type ForecastParams } from "../../engine/forecast";
import { fmtMonthShort } from "../../engine/format";
import { statusOf, utilizationOf } from "../../engine/utilization";
import type { AppState, Certainty, PipelineItem } from "../types";
import { canDo } from "./core";

export interface CapacityInput { horizon: 1 | 3 | 6 | 12; dept?: string; weights: Record<Certainty, number>; extraItems: PipelineItem[]; extraHires: Record<string, number>; includeSoft: boolean }
export function capacityView(s: AppState, i: CapacityInput) {
  const p: ForecastParams = { from: s.now, horizonMonths: i.horizon, departmentId: i.dept, weights: i.weights, extraItems: i.extraItems, extraHires: i.extraHires, includeSoft: i.includeSoft };
  const grades = forecastByGrade(s, p);
  const skills = forecastBySkill(s, p).slice(0, 12);
  const needs = recruitmentNeeds(s, p);
  const items = demandItems(s, p);
  const to = horizonEnd(p);
  const monthStarts: string[] = [];
  for (let m = monthStart(s.now); m <= to; m = addMonths(m, 1)) monthStarts.push(m);
  const cert: Certainty[] = ["CONFIRMEE", "PROBABLE", "OPPORTUNITE"];
  const stacks = cert.map((c) => ({ name: { CONFIRMEE: "Confirmée", PROBABLE: "Probable", OPPORTUNITE: "Opportunité" }[c], values: monthStarts.map((m) => { const from = m < s.now ? s.now : m; const f = fteHours(s, from, monthEnd(m)); return f ? Math.round((items.filter((d) => d.certainty === c).reduce((a, d) => a + demandHours(s, d, from, monthEnd(m)), 0) / f) * 10) / 10 : 0; }) }));
  const capacity = monthStarts.map((_, idx) => Math.round(grades.reduce((a, g) => a + (g.months[idx]?.supplyFte ?? 0), 0) * 10) / 10);
  const gradeMonth = grades.map((g) => ({ gradeId: g.gradeId, name: g.gradeName, months: g.months.map((m) => ({ key: m.key, supply: m.supplyFte, demand: m.demandFte, balance: m.balanceFte })) }));
  const ahead = { from: s.now, to };
  const overload = s.employees.filter((e) => e.status !== "ARCHIVE" && (!i.dept || e.departmentId === i.dept) && canDo(s, "employee.view", { employeeId: e.id })).map((e) => ({ e, planned: utilizationOf(s, e, ahead.from, addDays(s.now, 90), { includeSoft: i.includeSoft }).planned })).filter((x) => statusOf(s, x.e, x.planned) === "OVER");
  return { grades, skills, needs, stacks, capacity, labels: monthStarts.map((m) => fmtMonthShort(m)), monthKeys: monthStarts.map((m) => m.slice(0, 7)), gradeMonth, overload, deficitChips: grades.filter((g) => g.deficitPersons > 0).map((g) => deficitLabel(g.gradeName, g.deficitPersons)), items };
}
