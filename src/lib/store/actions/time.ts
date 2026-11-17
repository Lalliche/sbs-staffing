/* Demo clock and derived statuses: everything that changes when time passes or the plan changes. */
import { addDays } from "../../engine/dates";
import { projectCoverage, requirementCoverage } from "../../engine/booking";
import { fmtDate } from "../../engine/format";
import { nextId } from "../../engine/ids";
import { invalidate } from "../../engine/memo";
import type { AppState } from "../types";
import { audit, empName, notify, notifyHolders, userOfEmployee } from "./core";

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
  certificationsExpiring: number;
}
/** Advance the demo clock by `days` and trigger what time triggers (spec 4). */
export function advanceTime(s: AppState, days: number): TravelSummary {
  const before = s.now;
  s.now = addDays(s.now, days);
  const sum: TravelSummary = { days, expiredSoft: 0, certificationsExpiring: 0 };

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
