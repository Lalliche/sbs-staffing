/* Timesheets read layer (spec 7.7, 8.9). Every number shown on the timesheet screens comes from here or from the
   engine (`anomalies`, `utilizationOf`, capacity). Access follows RBAC: own sheets (`timesheet.own`) and the sheets of
   people inside the viewer's scope (`timesheet.view`); decisions need `timesheet.validate` inside the scope. */
import { absenceDaySet, assignmentsOf, calendarOf, dailyHours, getEmployee, isConfirmed, isWorkingDay } from "../../engine/capacity";
import { addDays, eachDay, monthStart, weekStart } from "../../engine/dates";
import { fmtDate } from "../../engine/format";
import { LEAVE_LABEL } from "../../engine/leave";
import { anomalies, billableHours, entriesOf, INTERNAL_CODES, isEditable, isInternalCode, totalHours, TS_LABEL, type Anomaly } from "../../engine/timesheet";
import { targetFor, utilizationOf, type UtilizationResult } from "../../engine/utilization";
import type { ActivityType, AppState, Employee, ISODate, Timesheet, TimesheetEntry, TimesheetStatus } from "../types";
import { canDo, nameOf, sessionUser } from "./core";

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  REALISATION: "Réalisation",
  REVUE: "Revue",
  PREPARATION: "Préparation",
  REUNION_CLIENT: "Réunion client",
  ADMINISTRATIF: "Administratif",
  FORMATION: "Formation",
  DEPLACEMENT: "Déplacement",
  COMMERCIAL: "Développement commercial",
};
export const ACTIVITY_TYPES = Object.keys(ACTIVITY_LABEL) as ActivityType[];
/** Default activity of an internal code. */
export const INTERNAL_ACTIVITY: Record<string, ActivityType> = { "INT-FORM": "FORMATION", "INT-ADM": "ADMINISTRATIF", "INT-BD": "COMMERCIAL" };
export const MAX_HOURS_PER_DAY_INPUT = 24;

/* ---------- access ---------- */
export const canOwn = (s: AppState, employeeId: string) => {
  const u = sessionUser(s);
  return !!u && u.employeeId === employeeId && canDo(s, "timesheet.own", { employeeId });
};
export const canSee = (s: AppState, employeeId: string) => canOwn(s, employeeId) || canDo(s, "timesheet.view", { employeeId });
export const canDecide = (s: AppState, employeeId: string) => {
  const u = sessionUser(s);
  return !!u && u.employeeId !== employeeId && canDo(s, "timesheet.validate", { employeeId });
};
export const canCorrect = (s: AppState, employeeId: string) => canDo(s, "timesheet.correct", { employeeId });

/* ---------- plain-French anomaly copy (the engine messages carry raw ISO dates) ---------- */
export const ANOMALY_LABEL: Record<Anomaly["kind"], string> = {
  DAILY_MAX: "Plus d’heures que le maximum quotidien",
  WEEKLY_MAX: "Plus d’heures que le maximum hebdomadaire",
  ON_LEAVE: "Heures un jour de congé",
  NOT_ASSIGNED: "Mission sans affectation",
  NON_WORKING_DAY: "Heures un jour non travaillé",
  EMPTY: "Semaine vide",
};
export interface AnomalyView {
  kind: Anomaly["kind"];
  severity: Anomaly["severity"];
  label: string;
  message: string;
  date?: ISODate;
  projectId?: string;
}
export function anomalyViews(s: AppState, ts: Timesheet): AnomalyView[] {
  return anomalies(s, ts).map((a) => {
    const pname = a.projectId ? s.projects.find((p) => p.id === a.projectId)?.name : undefined;
    const message = (() => {
      switch (a.kind) {
        case "ON_LEAVE": return `Des heures sont saisies le ${fmtDate(a.date!)}, pendant un congé approuvé.`;
        case "DAILY_MAX": return `Plus de ${s.settings.maxDailyHours} h saisies le ${fmtDate(a.date!)} (maximum quotidien).`;
        case "WEEKLY_MAX": return `Plus de ${s.settings.maxWeeklyHours} h saisies sur la semaine (maximum hebdomadaire).`;
        case "NON_WORKING_DAY": return `Des heures sont saisies le ${fmtDate(a.date!)}, un jour non travaillé.`;
        case "NOT_ASSIGNED": return `Heures sur « ${pname ?? "une mission"} » sans affectation à cette période.`;
        case "EMPTY": return "Aucune heure saisie cette semaine.";
      }
    })();
    return { kind: a.kind, severity: a.severity, label: ANOMALY_LABEL[a.kind], message, date: a.date, projectId: a.projectId };
  });
}

/* ---------- week model (grid) ---------- */
export interface DayInfo {
  date: ISODate;
  working: boolean;
  /** Public holiday name */
  holiday?: string;
  /** Approved leave label */
  leave?: string;
  /** Why the day is greyed out (holiday, leave, weekend, outside contract) */
  reason?: string;
  /** Hours expected that day (capacity, 0 when off) */
  expected: number;
  total: number;
}
export interface GridCell {
  hours: number;
  entryIds: string[];
  billable: boolean;
  activityType: ActivityType;
  description: string;
}
export interface GridRow {
  projectId: string;
  label: string;
  sub: string;
  internal: boolean;
  /** Has an active assignment overlapping the week */
  assigned: boolean;
  billable: boolean;
  activityType: ActivityType;
  cells: Record<ISODate, GridCell | undefined>;
  total: number;
  billableTotal: number;
}
export interface WeekModel {
  employee: Employee;
  employeeName: string;
  week: ISODate;
  end: ISODate;
  timesheet?: Timesheet;
  status: TimesheetStatus;
  statusLabel: string;
  days: DayInfo[];
  rows: GridRow[];
  total: number;
  billable: number;
  expected: number;
  /** total − expected (hours) */
  delta: number;
  anomalies: AnomalyView[];
  own: boolean;
  /** The viewer may edit entries right now (owner + editable status) */
  canEdit: boolean;
  locked: boolean;
  lockReason?: string;
  /** Manager's comment to show when rejected / correction requested */
  banner?: { tone: "alert" | "danger" | "info"; title: string; comment?: string };
  isFuture: boolean;
  /** Project ids the person may add (missions with an assignment or visible to the viewer) */
  addableProjects: { id: string; label: string; sub: string; assigned: boolean }[];
}

const projectLabel = (s: AppState, id: string) => {
  if (isInternalCode(id)) return { label: INTERNAL_CODES[id] ?? id, sub: `Code interne ${id}` };
  const p = s.projects.find((x) => x.id === id);
  return { label: p?.name ?? id, sub: p?.reference ?? "" };
};

export function weekDaysInfo(s: AppState, emp: Employee, week: ISODate, entries: TimesheetEntry[]): DayInfo[] {
  const cal = calendarOf(s, emp);
  const dh = dailyHours(emp, cal);
  const end = addDays(week, 6);
  const abs = absenceDaySet(s, emp.id, week, end);
  return eachDay(week, end).map((date) => {
    const working = isWorkingDay(emp, cal, date);
    const holiday = s.holidays.find((h) => h.date === date && (h.officeId === null || h.officeId === emp.officeId))?.name;
    const leaveReq = abs.has(date) ? s.leaves.find((l) => l.employeeId === emp.id && l.status === "APPROUVEE" && l.startDate <= date && l.endDate >= date) : undefined;
    const leave = leaveReq ? LEAVE_LABEL[leaveReq.type] : undefined;
    let reason: string | undefined;
    if (holiday) reason = `Jour férié — ${holiday}`;
    else if (leave) reason = `Congé approuvé — ${leave}`;
    else if (date < emp.startDate || (emp.endDate && date > emp.endDate)) reason = "Hors contrat";
    else if (!working) reason = "Jour non travaillé";
    const expected = working && !leave ? dh : 0;
    return { date, working, holiday, leave, reason, expected, total: entries.filter((e) => e.date === date).reduce((a, e) => a + e.hours, 0) };
  });
}

export function lockReason(ts: Pick<Timesheet, "status" | "submittedAt" | "validatedAt">): string | undefined {
  if (ts.status === "SOUMIS") return `Feuille soumise${ts.submittedAt ? ` le ${fmtDate(ts.submittedAt)}` : ""} : elle est verrouillée jusqu’à la décision de votre manager.`;
  if (ts.status === "VALIDE") return `Feuille validée${ts.validatedAt ? ` le ${fmtDate(ts.validatedAt)}` : ""} : elle est verrouillée. Une correction tracée, avec motif écrit, est nécessaire pour la rouvrir.`;
  return undefined;
}

/** Everything the weekly grid needs, for any person the viewer may open. */
export function weekModel(s: AppState, employeeId: string, weekAny: ISODate): WeekModel | undefined {
  const employee = getEmployee(s, employeeId);
  if (!employee || !canSee(s, employeeId)) return undefined;
  const week = weekStart(weekAny);
  const end = addDays(week, 6);
  const timesheet = s.timesheets.find((t) => t.employeeId === employeeId && t.weekStart === week);
  const entries = timesheet ? entriesOf(s, timesheet.id) : [];
  const days = weekDaysInfo(s, employee, week, entries);
  const mine = assignmentsOf(s, employeeId).filter((a) => isConfirmed(a) && a.startDate <= end && a.endDate >= week);
  const assignedIds = new Set(mine.map((a) => a.projectId));

  const ids: string[] = [];
  for (const a of [...mine].sort((x, y) => projectLabel(s, x.projectId).label.localeCompare(projectLabel(s, y.projectId).label))) if (!ids.includes(a.projectId)) ids.push(a.projectId);
  for (const e of entries) if (!isInternalCode(e.projectId) && !ids.includes(e.projectId)) ids.push(e.projectId);
  for (const code of Object.keys(INTERNAL_CODES)) ids.push(code);

  const rows: GridRow[] = ids.map((projectId) => {
    const own = entries.filter((e) => e.projectId === projectId);
    const internal = isInternalCode(projectId);
    const cells: Record<ISODate, GridCell | undefined> = {};
    for (const d of days) {
      const here = own.filter((e) => e.date === d.date);
      if (!here.length) continue;
      cells[d.date] = { hours: here.reduce((a, e) => a + e.hours, 0), entryIds: here.map((e) => e.id), billable: here[0].billable, activityType: here[0].activityType, description: here[0].description };
    }
    const first = own[0];
    return {
      projectId,
      ...(() => {
        const l = projectLabel(s, projectId);
        return { label: l.label, sub: l.sub };
      })(),
      internal,
      assigned: internal || assignedIds.has(projectId),
      billable: first ? first.billable : !internal,
      activityType: first ? first.activityType : internal ? INTERNAL_ACTIVITY[projectId] : "REALISATION",
      cells,
      total: own.reduce((a, e) => a + e.hours, 0),
      billableTotal: own.filter((e) => e.billable).reduce((a, e) => a + e.hours, 0),
    };
  });

  const status: TimesheetStatus = timesheet?.status ?? "BROUILLON";
  const own = canOwn(s, employeeId);
  const editable = isEditable({ status });
  const total = totalHours(entries);
  const expected = days.reduce((a, d) => a + d.expected, 0);
  let banner: WeekModel["banner"];
  if (status === "REJETE") banner = { tone: "danger", title: "Feuille rejetée par votre manager", comment: timesheet?.comment };
  else if (status === "CORRECTION_DEMANDEE") banner = { tone: "alert", title: timesheet && timesheet.corrections.length && !timesheet.comment ? "Correction ouverte sur une feuille validée" : "Correction demandée", comment: timesheet?.comment ?? timesheet?.corrections.at(-1)?.reason };

  const addable = new Map<string, { id: string; label: string; sub: string; assigned: boolean }>();
  for (const r of rows) addable.set(r.projectId, { id: r.projectId, label: r.label, sub: r.sub, assigned: r.assigned });
  if (own) for (const p of s.projects) if (!addable.has(p.id) && p.status !== "ANNULEE" && p.startDate <= end && p.endDate >= week && canDo(s, "project.view", { projectId: p.id })) addable.set(p.id, { id: p.id, label: p.name, sub: p.reference, assigned: false });

  return {
    employee,
    employeeName: nameOf(s, employeeId),
    week,
    end,
    timesheet,
    status,
    statusLabel: TS_LABEL[status],
    days,
    rows,
    total,
    billable: billableHours(entries),
    expected,
    delta: total - expected,
    anomalies: timesheet ? anomalyViews(s, timesheet) : [],
    own,
    canEdit: own && editable,
    locked: !editable,
    lockReason: !editable && timesheet ? lockReason(timesheet) : undefined,
    banner,
    isFuture: week > s.now,
    addableProjects: [...addable.values()],
  };
}

/** What « Pré-remplir d’après mes affectations » would add: confirmed assignments × allocation, 0.5 h steps, on days actually worked. */
export function prefillPlan(s: AppState, employeeId: string, weekAny: ISODate): { projectId: string; date: ISODate; hours: number }[] {
  const emp = getEmployee(s, employeeId);
  if (!emp) return [];
  const week = weekStart(weekAny);
  const cal = calendarOf(s, emp);
  const dh = dailyHours(emp, cal);
  const abs = absenceDaySet(s, employeeId, week, addDays(week, 6));
  const out: { projectId: string; date: ISODate; hours: number }[] = [];
  for (const date of eachDay(week, addDays(week, 6))) {
    if (!isWorkingDay(emp, cal, date) || abs.has(date)) continue;
    for (const a of assignmentsOf(s, employeeId)) {
      if (!isConfirmed(a) || a.startDate > date || a.endDate < date) continue;
      const hours = Math.round(((dh * a.allocationPct) / 100) * 2) / 2;
      if (hours > 0) out.push({ projectId: a.projectId, date, hours });
    }
  }
  return out;
}

/* ---------- utilization effect (header) ---------- */
export interface MonthUtilization extends UtilizationResult {
  from: ISODate;
  to: ISODate;
  target: number;
  /** Hours on SOUMIS sheets: they count in real utilization only once validated. */
  pendingHours: number;
}
export function monthUtilization(s: AppState, employeeId: string): MonthUtilization | undefined {
  const emp = getEmployee(s, employeeId);
  if (!emp || !canSee(s, employeeId)) return undefined;
  const from = monthStart(s.now);
  const to = s.now;
  const u = utilizationOf(s, emp, from, to);
  const pending = new Set(s.timesheets.filter((t) => t.employeeId === employeeId && t.status === "SOUMIS").map((t) => t.id));
  const pendingHours = s.entries.filter((e) => pending.has(e.timesheetId) && e.date >= from && e.date <= to).reduce((a, e) => a + e.hours, 0);
  return { ...u, from, to, target: targetFor(s.settings, emp), pendingHours };
}

/* ---------- lists: validation queue, late drafts, history ---------- */
export interface SheetSummary {
  id: string;
  employeeId: string;
  employeeName: string;
  firstName: string;
  lastName: string;
  departmentId: string;
  matricule: string;
  weekStart: ISODate;
  status: TimesheetStatus;
  total: number;
  billable: number;
  expected: number;
  anomalies: AnomalyView[];
  alertCount: number;
  /** No ALERT anomaly: can be validated in bulk */
  clean: boolean;
  submittedAt?: ISODate;
  validatedAt?: ISODate;
  validatedBy?: string;
  comment?: string;
  corrections: number;
  decide: boolean;
}
export interface SheetFilter {
  q?: string;
  departmentId?: string;
  employeeId?: string;
  status?: TimesheetStatus | "";
  from?: ISODate;
  to?: ISODate;
}

export function sheetSummary(s: AppState, ts: Timesheet): SheetSummary | undefined {
  const emp = getEmployee(s, ts.employeeId);
  if (!emp || !canSee(s, ts.employeeId)) return undefined;
  const entries = entriesOf(s, ts.id);
  const an = anomalyViews(s, ts);
  const alertCount = an.filter((a) => a.severity === "ALERT").length;
  const days = weekDaysInfo(s, emp, ts.weekStart, entries);
  const by = ts.validatedById ? (s.users.find((u) => u.id === ts.validatedById) ?? undefined) : undefined;
  return {
    id: ts.id,
    employeeId: emp.id,
    employeeName: `${emp.firstName} ${emp.lastName}`,
    firstName: emp.firstName,
    lastName: emp.lastName,
    departmentId: emp.departmentId,
    matricule: emp.matricule,
    weekStart: ts.weekStart,
    status: ts.status,
    total: totalHours(entries),
    billable: billableHours(entries),
    expected: days.reduce((a, d) => a + d.expected, 0),
    anomalies: an,
    alertCount,
    clean: alertCount === 0,
    submittedAt: ts.submittedAt,
    validatedAt: ts.validatedAt,
    validatedBy: by ? `${by.firstName} ${by.lastName}` : ts.validatedById ? nameOf(s, ts.validatedById) : undefined,
    comment: ts.comment,
    corrections: ts.corrections.length,
    decide: canDecide(s, ts.employeeId),
  };
}

const matches = (x: SheetSummary, f: SheetFilter) => {
  if (f.departmentId && x.departmentId !== f.departmentId) return false;
  if (f.employeeId && x.employeeId !== f.employeeId) return false;
  if (f.status && x.status !== f.status) return false;
  if (f.from && x.weekStart < f.from) return false;
  if (f.to && x.weekStart > f.to) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (!`${x.employeeName} ${x.matricule}`.toLowerCase().includes(q)) return false;
  }
  return true;
};
const byWeekThenName = (a: SheetSummary, b: SheetSummary) => a.weekStart.localeCompare(b.weekStart) || a.lastName.localeCompare(b.lastName);

/** SOUMIS sheets the viewer can see (decide flag says whether they can act). Oldest week first. */
export function validationQueue(s: AppState, f: SheetFilter = {}): SheetSummary[] {
  if (!canDo(s, "timesheet.view") && !canDo(s, "timesheet.validate")) return [];
  return s.timesheets
    .filter((t) => t.status === "SOUMIS")
    .map((t) => sheetSummary(s, t))
    .filter((x): x is SheetSummary => !!x && x.employeeId !== sessionUser(s)?.employeeId && matches(x, f))
    .sort(byWeekThenName);
}
/** BROUILLON sheets of weeks that are over, for people the viewer validates (reminders). */
export function lateDrafts(s: AppState, f: SheetFilter = {}): SheetSummary[] {
  const limit = weekStart(s.now);
  return s.timesheets
    .filter((t) => t.status === "BROUILLON" && t.weekStart < limit && canDecide(s, t.employeeId))
    .map((t) => sheetSummary(s, t))
    .filter((x): x is SheetSummary => !!x && matches(x, f))
    .sort(byWeekThenName);
}
/** Decided sheets (validated, rejected, correction in progress), newest first. Own sheets always included. */
export function historySheets(s: AppState, f: SheetFilter = {}): SheetSummary[] {
  return s.timesheets
    .filter((t) => t.status === "VALIDE" || t.status === "REJETE" || t.status === "CORRECTION_DEMANDEE")
    .map((t) => sheetSummary(s, t))
    .filter((x): x is SheetSummary => !!x && matches(x, f))
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.lastName.localeCompare(b.lastName));
}
/** Compact list of the last weeks of one person (jump list on « Mes timesheets »). */
export function recentWeeks(s: AppState, employeeId: string, count = 8): { week: ISODate; status: TimesheetStatus; total: number; exists: boolean }[] {
  if (!canSee(s, employeeId)) return [];
  const current = weekStart(s.now);
  return Array.from({ length: count }, (_, i) => addDays(current, -7 * i)).map((week) => {
    const ts = s.timesheets.find((t) => t.employeeId === employeeId && t.weekStart === week);
    return { week, status: ts?.status ?? "BROUILLON", total: ts ? totalHours(entriesOf(s, ts.id)) : 0, exists: !!ts };
  });
}

export function queueStats(s: AppState) {
  const queue = validationQueue(s);
  return { pending: queue.length, clean: queue.filter((x) => x.clean && x.decide).length, withAnomalies: queue.filter((x) => !x.clean).length, late: lateDrafts(s).length };
}

/* ---------- exports (CSV « ; » and .xls-compatible HTML table) ---------- */
export function exportSheets(s: AppState, sheets: SheetSummary[]): { header: string[]; rows: (string | number)[][] } {
  const dept = (id: string) => s.departments.find((d) => d.id === id)?.name ?? id;
  return {
    header: ["Collaborateur", "Matricule", "Département", "Semaine du", "Statut", "Heures saisies", "Heures facturables", "Heures attendues", "Anomalies", "Soumise le", "Validée le", "Validée par", "Commentaire"],
    rows: sheets.map((x) => [x.employeeName, x.matricule, dept(x.departmentId), x.weekStart, TS_LABEL[x.status], x.total, x.billable, x.expected, x.anomalies.filter((a) => a.severity === "ALERT").map((a) => a.label).join(" | "), x.submittedAt ?? "", x.validatedAt ?? "", x.validatedBy ?? "", x.comment ?? ""]),
  };
}
export function exportLines(s: AppState, sheets: SheetSummary[]): { header: string[]; rows: (string | number)[][] } {
  const rows: (string | number)[][] = [];
  for (const sh of sheets) {
    const ts = s.timesheets.find((t) => t.id === sh.id)!;
    for (const e of entriesOf(s, ts.id).sort((a, b) => a.date.localeCompare(b.date))) {
      const l = projectLabel(s, e.projectId);
      rows.push([sh.employeeName, sh.weekStart, e.date, l.sub || e.projectId, l.label, e.hours, e.billable ? "Oui" : "Non", ACTIVITY_LABEL[e.activityType], e.description]);
    }
  }
  return { header: ["Collaborateur", "Semaine du", "Date", "Référence", "Mission / code", "Heures", "Facturable", "Activité", "Description"], rows };
}
const xmlEsc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** HTML table that Excel opens as a worksheet (.xls). */
export function toXlsHtml(header: string[], rows: (string | number)[][], sheetName = "Timesheets"): string {
  const head = `<tr>${header.map((h) => `<th style="background:#EBE8DF;font-weight:bold">${xmlEsc(h)}</th>`).join("")}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => (typeof c === "number" ? `<td x:num>${xmlEsc(String(c).replace(".", ","))}</td>` : `<td>${xmlEsc(c)}</td>`)).join("")}</tr>`).join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${xmlEsc(sheetName)}</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1">${head}${body}</table></body></html>`;
}
