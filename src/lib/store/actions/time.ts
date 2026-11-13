/* Demo clock and derived statuses: everything that changes when time passes or the plan changes. */
import { absenceDaySet, calendarOf, dailyHours, isWorkingDay } from "../../engine/capacity";
import { addDays, eachDay, weekStart } from "../../engine/dates";
import { projectCoverage, requirementCoverage } from "../../engine/booking";
import { fmtDate } from "../../engine/format";
import { nextId } from "../../engine/ids";
import { invalidate } from "../../engine/memo";
import type { AppState, Timesheet } from "../types";
import { audit, empName, notify, notifyHolders, userOfEmployee } from "./core";

/** Create (if missing) the timesheet of a week, optionally pre-filled from confirmed assignments. */
export function ensureTimesheet(s: AppState, employeeId: string, week: string, prefill = true): Timesheet | undefined {
  const emp = s.employees.find((e) => e.id === employeeId);
  if (!emp) return undefined;
  const existing = s.timesheets.find((t) => t.employeeId === employeeId && t.weekStart === week);
  if (existing) return existing;
  const ts: Timesheet = { id: `ts-${employeeId}-${week}`, employeeId, weekStart: week, status: "BROUILLON", corrections: [] };
  s.timesheets.push(ts);
  if (prefill) {
    const cal = calendarOf(s, emp);
    const dh = dailyHours(emp, cal);
    const abs = absenceDaySet(s, employeeId, week, addDays(week, 6));
    for (const d of eachDay(week, addDays(week, 6))) {
      if (!isWorkingDay(emp, cal, d) || abs.has(d)) continue;
      for (const a of s.assignments) {
        if (a.employeeId !== employeeId || a.status !== "HARD" || a.startDate > d || a.endDate < d) continue;
        const hours = Math.round(((dh * a.allocationPct) / 100) * 2) / 2;
        if (hours > 0) s.entries.push({ id: nextId(s, "te"), timesheetId: ts.id, projectId: a.projectId, date: d, hours, billable: true, activityType: "REALISATION", description: "Pré-rempli d’après l’affectation" });
      }
    }
  }
  return ts;
}

/** Derived statuses: project lifecycle, expired soft bookings, satisfied requests. Idempotent. */
export function refreshStatuses(s: AppState): { expiredSoft: number } {
  invalidate(s);
  let expiredSoft = 0;
  // 1. Soft bookings expire (spec 7.5)
  for (const a of s.assignments) {
    if (a.status === "SOFT" && a.softExpiresAt && a.softExpiresAt < s.now) {
      a.status = "ANNULEE";
      expiredSoft++;
      s.audit.unshift({ id: nextId(s, "au"), ts: s.now, seq: ++s.auditSeq, actorId: null, action: "assignment.softexpire", entity: "Affectation", entityId: a.id, label: `Réservation expirée — ${empName(s, a.employeeId)}`, before: { status: "SOFT" }, after: { status: "ANNULEE" } });
      notifyHolders(s, "assignment.create", "ASSIGNMENT", "Réservation expirée", `La réservation de ${empName(s, a.employeeId)} a expiré le ${fmtDate(a.softExpiresAt)}.`, "/app/planning");
    }
  }
  // 2. Finished assignments / missions
  for (const a of s.assignments) if (a.status === "HARD" && a.endDate < s.now) a.status = "TERMINEE";
  for (const p of s.projects) {
    if (p.status === "TERMINEE" || p.status === "ANNULEE") continue;
    const cov = projectCoverage(s, p.id);
    const hasTeam = s.assignments.some((a) => a.projectId === p.id && (a.status === "HARD" || a.status === "TERMINEE"));
    if (p.endDate < s.now) p.status = "TERMINEE";
    else if (p.startDate <= s.now) p.status = hasTeam ? "ACTIVE" : "EN_ATTENTE_STAFFING";
    else if (p.status === "EN_ATTENTE_STAFFING" && cov.rate >= 1) p.status = "A_VENIR";
  }
  // 3. Requests become SATISFAITE when the requirement is fully covered by confirmed bookings (spec 8.8)
  for (const r of s.requests) {
    if (!r.requirementId || !["APPROUVEE", "PROPOSITION_ENVOYEE", "EN_ATTENTE_VALIDATION", "EN_ANALYSE", "SOUMISE"].includes(r.status)) continue;
    const req = s.requirements.find((x) => x.id === r.requirementId);
    if (req && requirementCoverage(s, req).rate >= 1) {
      r.status = "SATISFAITE";
      r.history.push({ ts: s.now, actorId: "system", status: "SATISFAITE", note: "Besoin couvert par des affectations confirmées." });
      s.audit.unshift({ id: nextId(s, "au"), ts: s.now, seq: ++s.auditSeq, actorId: null, action: "request.satisfied", entity: "Demande", entityId: r.id, label: r.reference });
    }
  }
  invalidate(s);
  return { expiredSoft };
}

export interface TravelSummary {
  days: number;
  expiredSoft: number;
  remindersSent: number;
  certificationsExpiring: number;
  newSheets: number;
}
/** Advance the demo clock by `days` and trigger what time triggers (spec 4). */
export function advanceTime(s: AppState, days: number): TravelSummary {
  const before = s.now;
  s.now = addDays(s.now, days);
  const sum: TravelSummary = { days, expiredSoft: 0, remindersSent: 0, certificationsExpiring: 0, newSheets: 0 };

  // Weekly timesheets for every elapsed week (pre-filled drafts) + reminders for unsubmitted past weeks
  const lastClosed = addDays(weekStart(s.now), -7);
  for (const emp of s.employees) {
    if (emp.status === "ARCHIVE") continue;
    for (let w = weekStart(before); w <= lastClosed; w = addDays(w, 7)) {
      if (w < emp.startDate) continue;
      if (!s.timesheets.some((t) => t.employeeId === emp.id && t.weekStart === w)) {
        ensureTimesheet(s, emp.id, w, true);
        sum.newSheets++;
      }
    }
    const late = s.timesheets.filter((t) => t.employeeId === emp.id && t.status === "BROUILLON" && t.weekStart <= lastClosed);
    if (late.length) {
      const u = userOfEmployee(s, emp.id);
      const key = `Timesheet non soumis — semaine du ${fmtDate(late[late.length - 1].weekStart)}`;
      if (u && !s.notifications.some((n) => n.userId === u.id && n.title === key)) {
        const saved = s.session.userId;
        s.session.userId = null;
        notify(s, u.id, "TIMESHEET", key, `${late.length} semaine(s) à soumettre.`, "/app/timesheets");
        s.session.userId = saved;
        sum.remindersSent++;
      }
    }
  }
  // Managers: validation backlog
  const pending = s.timesheets.filter((t) => t.status === "SOUMIS").length;
  if (pending) notifyHolders(s, "timesheet.validate", "TIMESHEET", "Timesheets à valider", `${pending} feuille(s) de temps attendent une validation.`, "/app/timesheets");

  // Certifications expiring within 30 days
  const limit = addDays(s.now, 30);
  for (const c of s.employeeCertifications) {
    if (c.expiresAt < s.now || c.expiresAt > limit) continue;
    const cert = s.certifications.find((x) => x.id === c.certificationId);
    const title = `Certification expirant bientôt — ${empName(s, c.employeeId)}`;
    const body = `${cert?.name} expire le ${fmtDate(c.expiresAt)}.`;
    if (s.notifications.some((n) => n.title === title && n.body === body)) continue;
    const saved = s.session.userId;
    s.session.userId = null;
    notifyHolders(s, "employee.create", "CERTIFICATION", title, body, `/app/collaborateurs/${c.employeeId}`);
    const u = userOfEmployee(s, c.employeeId);
    if (u) notify(s, u.id, "CERTIFICATION", `Votre certification expire le ${fmtDate(c.expiresAt)}`, cert?.name ?? "", `/app/collaborateurs/${c.employeeId}`);
    s.session.userId = saved;
    sum.certificationsExpiring++;
  }

  sum.expiredSoft = refreshStatuses(s).expiredSoft;
  audit(s, { action: "demo.travel", entity: "Horloge", entityId: "clock", label: `Horloge avancée de ${days} jour(s)`, before: { now: before }, after: { now: s.now } });
  return sum;
}
