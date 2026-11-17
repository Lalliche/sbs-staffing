/* Analytics & reporting (spec 8.14): every report is a pure selector returning columns + rows (+ chart spec),
   so what is on screen, in the CSV/Excel export and in the printable PDF is identical. */
import { projectCoverage } from "../../engine/booking";
import { addDays } from "../../engine/dates";
import { forecastByGrade, recruitmentNeeds } from "../../engine/forecast";
import { fmtDate } from "../../engine/format";
import { statusOf, utilizationOf, utilizationOfGroup } from "../../engine/utilization";
import { presenceCount, presenceDays } from "../../engine/workmode";
import type { AppState } from "../types";
import { canDo } from "./core";
import { lastClosedWeekEnd, scopedEmployees } from "./dashboard";

export interface Report {
  id: string;
  title: string;
  description: string;
  head: string[];
  rows: (string | number)[][];
  chart?: { labels: string[]; series: { name: string; values: number[] }[]; unit?: string };
  cost?: boolean;
  source: string;
}
export interface ReportFilters { dept?: string; grade?: string; from?: string; to?: string }
export const REPORT_CATALOG: { id: string; title: string; cost?: boolean }[] = [
  { id: "utilisation-employe", title: "Utilisation par collaborateur" }, { id: "utilisation-departement", title: "Utilisation par département" }, { id: "presence", title: "Présence — présentiel / à distance" },
  { id: "charge-grade", title: "Charge par grade" }, { id: "disponibilites", title: "Disponibilités prévisionnelles" }, { id: "staffing-mission", title: "Staffing par mission" }, { id: "non-couvertes", title: "Missions non couvertes" },
  { id: "cout-mission", title: "Coût des ressources par mission", cost: true }, { id: "cout-grade", title: "Coût moyen par grade", cost: true }, { id: "rentabilite", title: "Rentabilité prévisionnelle", cost: true },
  { id: "historique", title: "Historique des affectations" }, { id: "competences", title: "Évolution des compétences" }, { id: "recrutement", title: "Prévision de recrutement" },
];
export const availableReports = (s: AppState) => REPORT_CATALOG.filter((r) => !r.cost || canDo(s, "analytics.cost"));
const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildReport(s: AppState, id: string, f: ReportFilters): Report | null {
  const def = REPORT_CATALOG.find((r) => r.id === id);
  if (!def || (def.cost && !canDo(s, "analytics.cost"))) return null;
  const to = f.to ?? lastClosedWeekEnd(s);
  const from = f.from ?? addDays(to, -27);
  const emps = scopedEmployees(s, { dept: f.dept, grade: f.grade });
  const gname = (gid: string) => s.grades.find((g) => g.id === gid)?.name ?? "";
  const dname = (did: string) => s.departments.find((d) => d.id === did)?.name ?? "";
  const base = { id, title: def.title, cost: def.cost };
  const src = `Basé sur ${emps.length} collaborateurs, ${fmtDate(from)} → ${fmtDate(to)}`;
  switch (id) {
    case "utilisation-employe": {
      const rows = emps.map((e) => ({ e, u: utilizationOf(s, e, from, to) }));
      return { ...base, description: "Heures planifiées ÷ capacité théorique, par personne.", head: ["Collaborateur", "Grade", "Département", "Capacité (h)", "Planifiée %", "Statut"], rows: rows.map(({ e, u }) => [`${e.firstName} ${e.lastName}`, gname(e.gradeId), dname(e.departmentId), Math.round(u.theoretical), Math.round(u.planned), { UNDER: "Sous-occupé", OK: "Normal", OVER: "Surchargé" }[statusOf(s, e, u.planned)]]), chart: { labels: rows.slice(0, 15).map(({ e }) => e.lastName), series: [{ name: "Planifiée", values: rows.slice(0, 15).map(({ u }) => Math.round(u.planned)) }], unit: "%" }, source: src };
    }
    case "utilisation-departement":
    case "charge-grade": {
      const byD = id === "utilisation-departement";
      const groups = byD ? s.departments.map((d) => ({ label: d.name, m: emps.filter((e) => e.departmentId === d.id) })) : s.grades.map((g) => ({ label: g.name, m: emps.filter((e) => e.gradeId === g.id) }));
      const rows = groups.filter((g) => g.m.length).map((g) => ({ g, u: utilizationOfGroup(s, g.m, from, to) }));
      return { ...base, description: byD ? "Agrégat Σ heures ÷ Σ capacité par département." : "Charge moyenne par grade.", head: [byD ? "Département" : "Grade", "Effectif", "Capacité (h)", "Planifiée %"], rows: rows.map(({ g, u }) => [g.label, g.m.length, Math.round(u.theoretical), Math.round(u.planned)]), chart: { labels: rows.map(({ g }) => g.label), series: [{ name: "Planifiée", values: rows.map(({ u }) => Math.round(u.planned)) }], unit: "%" }, source: src };
    }
    case "presence": {
      if (!canDo(s, "workmode.view")) return null;
      const ahead = { from: s.now, to: addDays(s.now, 27) };
      const rows = s.departments.map((d) => ({ d, m: emps.filter((e) => e.departmentId === d.id) })).filter((x) => x.m.length).map(({ d, m }) => ({ d, n: m.length, today: presenceCount(s, m, s.now), ahead: presenceDays(s, m, ahead.from, ahead.to) }));
      return { ...base, description: "Situation du jour et part des jours à distance sur les 4 prochaines semaines, par département.", head: ["Département", "Effectif", "Sur site (jour)", "À distance (jour)", "Absents (jour)", "Jours à distance (4 sem.) %"], rows: rows.map(({ d, n, today, ahead: a }) => [d.name, n, today.onsite, today.remote, today.absent, Math.round(a.remoteSharePct)]), chart: { labels: rows.map(({ d }) => d.name), series: [{ name: "Sur site", values: rows.map(({ today }) => today.onsite) }, { name: "À distance", values: rows.map(({ today }) => today.remote) }] }, source: `Basé sur ${emps.length} collaborateurs, jour de référence ${fmtDate(s.now)}` };
    }
    case "disponibilites": {
      const fc = forecastByGrade(s, { from: s.now, horizonMonths: 6, departmentId: f.dept });
      return { ...base, description: "Capacité disponible et besoins pondérés sur 6 mois, par grade.", head: ["Grade", "Capacité (ETP)", "Besoins (ETP)", "Déficit (pers.)", "Excédent (pers.)"], rows: fc.map((g) => [g.gradeName, r1(g.supplyFte), r1(g.demandFte), g.deficitPersons, g.surplusPersons]), chart: { labels: fc.map((g) => g.gradeName), series: [{ name: "Capacité", values: fc.map((g) => r1(g.supplyFte)) }, { name: "Besoins", values: fc.map((g) => r1(g.demandFte)) }] }, source: "Prévision à 6 mois — besoins pondérés par la certitude des missions." };
    }
    case "staffing-mission":
    case "non-couvertes": {
      const list = s.projects.filter((p) => p.status !== "TERMINEE" && p.status !== "ANNULEE" && canDo(s, "project.view", { projectId: p.id }) && (!f.dept || p.departmentId === f.dept)).map((p) => ({ p, c: projectCoverage(s, p.id) })).filter((x) => id === "staffing-mission" || x.c.missing > 0);
      return { ...base, description: id === "staffing-mission" ? "Taux de staffing = postes confirmés ÷ postes demandés." : "Missions avec des postes encore à pourvoir.", head: ["Mission", "Référence", "Début", "Postes demandés", "Confirmés", "Réservés", "Manquants", "Taux de staffing %"], rows: list.map(({ p, c }) => [p.name, p.reference, p.startDate, c.quantity, c.hard, c.soft, c.missing, Math.round(c.rate * 100)]), chart: { labels: list.slice(0, 12).map(({ p }) => p.reference), series: [{ name: "Taux de staffing", values: list.slice(0, 12).map(({ c }) => Math.round(c.rate * 100)) }], unit: "%" }, source: `Basé sur ${list.length} missions.` };
    }
    case "cout-mission":
    case "rentabilite": {
      const list = s.projects.filter((p) => canDo(s, "project.finance.read", { projectId: p.id }) && (!f.dept || p.departmentId === f.dept) && p.status !== "ANNULEE").map((p) => { let cost = 0; for (const a of s.assignments) { if (a.projectId !== p.id || (a.status !== "HARD" && a.status !== "TERMINEE")) continue; const e = s.employees.find((x) => x.id === a.employeeId); if (e) cost += (a.plannedHours / (e.weeklyHours / 5)) * e.dailyCost; } return { p, cost: Math.round(cost) }; });
      return { ...base, description: id === "cout-mission" ? "Coût planifié des affectations confirmées (heures × coût journalier)." : "Marge prévisionnelle = budget − coût planifié.", head: id === "cout-mission" ? ["Mission", "Budget ressources (DZD)", "Coût planifié (DZD)"] : ["Mission", "Budget (DZD)", "Coût planifié (DZD)", "Marge (DZD)", "Marge %"], rows: list.map(({ p, cost }) => (id === "cout-mission" ? [p.name, p.resourceBudget, cost] : [p.name, p.budget, cost, p.budget - cost, p.budget ? Math.round(((p.budget - cost) / p.budget) * 100) : 0])), chart: { labels: list.slice(0, 10).map(({ p }) => p.reference), series: [{ name: "Coût planifié (M DZD)", values: list.slice(0, 10).map(({ cost }) => r1(cost / 1e6)) }] }, source: "Réservé aux profils disposant des droits de coûts." };
    }
    case "cout-grade":
      return { ...base, description: "Coût journalier moyen par grade.", head: ["Grade", "Effectif", "Coût journalier moyen (DZD)"], rows: s.grades.map((g) => { const m = emps.filter((e) => e.gradeId === g.id); return [g.name, m.length, m.length ? Math.round(m.reduce((a, e) => a + e.dailyCost, 0) / m.length) : 0]; }), chart: { labels: s.grades.map((g) => g.name), series: [{ name: "Coût moyen (k DZD)", values: s.grades.map((g) => { const m = emps.filter((e) => e.gradeId === g.id); return m.length ? Math.round(m.reduce((a, e) => a + e.dailyCost, 0) / m.length / 1000) : 0; }) }] }, source: src };
    case "historique": {
      const list = s.assignments.filter((a) => canDo(s, "planning.view", { employeeId: a.employeeId }) && (!f.dept || s.employees.find((e) => e.id === a.employeeId)?.departmentId === f.dept)).sort((a, b) => b.startDate.localeCompare(a.startDate));
      return { ...base, description: "Toutes les affectations, y compris terminées et annulées.", head: ["Collaborateur", "Mission", "Début", "Fin", "%", "Heures", "Statut"], rows: list.map((a) => { const e = s.employees.find((x) => x.id === a.employeeId); return [e ? `${e.firstName} ${e.lastName}` : a.employeeId, s.projects.find((p) => p.id === a.projectId)?.name ?? "", a.startDate, a.endDate, a.allocationPct, Math.round(a.plannedHours), { HARD: "Confirmée", SOFT: "Réservation", ANNULEE: "Annulée", TERMINEE: "Terminée" }[a.status]]; }), source: `${list.length} affectations.` };
    }
    case "competences": {
      const rows = s.skills.map((k) => { const l = s.employeeSkills.filter((x) => x.skillId === k.id && emps.some((e) => e.id === x.employeeId)); return [k.name, l.length, l.filter((x) => x.level >= 3).length, l.filter((x) => x.validatedById).length, l.filter((x) => x.updatedAt >= addDays(s.now, -90)).length]; }).filter((r) => (r[1] as number) > 0);
      return { ...base, description: "Titulaires par compétence : niveau avancé, validés, mises à jour sur 90 jours.", head: ["Compétence", "Titulaires", "Niveau avancé ou expert", "Niveaux validés", "Mises à jour (90 j)"], rows, chart: { labels: rows.slice(0, 12).map((r) => String(r[0])), series: [{ name: "Titulaires", values: rows.slice(0, 12).map((r) => r[1] as number) }, { name: "Avancés", values: rows.slice(0, 12).map((r) => r[2] as number) }] }, source: src };
    }
    case "recrutement": {
      const needs = recruitmentNeeds(s, { from: s.now, horizonMonths: 12, departmentId: f.dept });
      return { ...base, description: "Recrutements nécessaires à 12 mois (pire mois), par grade.", head: ["Grade", "Personnes", "Premier mois de déficit", "Missions concernées"], rows: needs.map((n) => [n.gradeName, n.persons, n.firstDeficitMonth ?? "", n.drivers.map((d) => d.name).join(" ; ")]), chart: needs.length ? { labels: needs.map((n) => n.gradeName), series: [{ name: "Personnes à recruter", values: needs.map((n) => n.persons) }] } : undefined, source: "Besoins pondérés par certitude, capacité après absences et affectations." };
    }
  }
  return null;
}
