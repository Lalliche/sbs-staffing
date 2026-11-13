import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { openCorrection, rejectTimesheet, requestCorrection, saveWeek, submitTimesheet, validateTimesheet } from "./timesheets";
import { applyToOpportunity, reviewApplication } from "./marketplace";
import { resetRolePermissions, saveSettings, setRolePermission, validateSettings } from "./admin";
import { approveRequest, rejectRequest, sendProposal, sendToValidation, takeRequest, setProposedEmployees } from "./requests";
import { utilizationOf } from "../../engine/utilization";
import { can } from "../../engine/permissions";
import type { AppState } from "../types";

const as = (id: string): AppState => { const s = buildSeed(2); s.session.userId = id; return s; };
const WEEK = "2026-11-08";

describe("timesheet workflow (7.7)", () => {
  it("draft → submit → validate locks the sheet; real utilization changes only after validation", () => {
    const s = as("u-lucas");
    const emp = s.employees.find((e) => e.id === "e11")!;
    const before = utilizationOf(s, emp, WEEK, "2026-11-12").real;
    expect(saveWeek(s, "e11", WEEK, [{ projectId: "p-01", date: "2026-11-09", hours: 8, billable: true, activityType: "REALISATION", description: "Travaux" }]).ok).toBe(true);
    const id = `ts-e11-${WEEK}`;
    expect(submitTimesheet(s, id).ok).toBe(true);
    expect(utilizationOf(s, emp, WEEK, "2026-11-12").real).toBe(before); // submitted ≠ validated
    // locked while submitted
    const locked = saveWeek(s, "e11", WEEK, []);
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.code).toBe("LOCKED");
    s.session.userId = "u-thomas";
    expect(validateTimesheet(s, id).ok).toBe(true);
    expect(s.timesheets.find((t) => t.id === id)).toMatchObject({ status: "VALIDE", validatedById: "u-thomas" });
    expect(utilizationOf(s, emp, WEEK, "2026-11-12").real).toBeGreaterThan(before);
    expect(s.audit.some((a) => a.action === "timesheet.validate" && a.entityId === id)).toBe(true);
  });
  it("a validated sheet is locked; only a traced correction (written reason, audited) reopens it", () => {
    const s = as("u-lucas");
    const id = "ts-e11-2026-11-01"; // validated in the seed
    expect(s.timesheets.find((t) => t.id === id)!.status).toBe("VALIDE");
    expect(saveWeek(s, "e11", "2026-11-01", []).ok).toBe(false);
    s.session.userId = "u-thomas";
    expect(openCorrection(s, id, "Erreur de saisie sur la mission A, heures à corriger.").ok).toBe(false); // Manager lacks timesheet.correct
    s.session.userId = "u-karim";
    expect(openCorrection(s, id, "court").ok).toBe(false);
    expect(openCorrection(s, id, "Erreur de saisie sur la mission A, heures à corriger.").ok).toBe(true);
    const ts = s.timesheets.find((t) => t.id === id)!;
    expect(ts.status).toBe("CORRECTION_DEMANDEE");
    expect(ts.corrections).toHaveLength(1);
    expect(s.audit[0]).toMatchObject({ action: "timesheet.correct", reason: "Erreur de saisie sur la mission A, heures à corriger." });
  });
  it("rejection needs a comment; nobody validates their own sheet; scope applies", () => {
    const s = as("u-lucas");
    saveWeek(s, "e11", WEEK, [{ projectId: "p-01", date: "2026-11-09", hours: 8, billable: true, activityType: "REALISATION", description: "x" }]);
    const id = `ts-e11-${WEEK}`;
    submitTimesheet(s, id);
    expect(validateTimesheet(s, id).ok).toBe(false); // own sheet / no right
    s.session.userId = "u-nabil"; // Manager but not Lucas's manager → same department scope allows; use another department manager:
    s.session.userId = "u-thomas";
    expect(rejectTimesheet(s, id, "").ok).toBe(false);
    expect(requestCorrection(s, id, "Merci de détailler les heures du mardi.").ok).toBe(true);
    expect(s.timesheets.find((t) => t.id === id)!.status).toBe("CORRECTION_DEMANDEE");
    const s2 = as("u-thomas");
    const other = s2.timesheets.find((t) => t.status === "SOUMIS" && s2.employees.find((e) => e.id === t.employeeId)!.departmentId !== "d-aud");
    if (other) expect(validateTimesheet(s2, other.id).ok).toBe(false);
  });
});

describe("marketplace (8.11)", () => {
  it("an application never creates an assignment; duplicates and weak motivation are refused", () => {
    const s = as("u-lucas");
    const n = s.assignments.length;
    expect(applyToOpportunity(s, "op-3", "ok").ok).toBe(false);
    const r = applyToOpportunity(s, "op-3", "Je souhaite renforcer mes compétences en analyse de données.");
    expect(r.ok).toBe(true);
    expect(applyToOpportunity(s, "op-3", "Je souhaite renforcer mes compétences en analyse de données.").ok).toBe(false);
    expect(s.assignments.length).toBe(n);
    expect(s.notifications.some((x) => x.kind === "MARKETPLACE" && x.userId === "u-thomas")).toBe(true);
    s.session.userId = "u-thomas";
    if (r.ok) expect(reviewApplication(s, r.value.id, "PRESELECTIONNEE").ok).toBe(true);
    expect(s.assignments.length).toBe(n); // shortlisting is not assigning
    s.session.userId = "u-claire";
    expect(applyToOpportunity(as("u-sophie"), "op-3", "Candidature depuis un profil RH sans droit.").ok).toBe(false);
  });
});

describe("administration (8.16, demo F)", () => {
  it("editing the role matrix changes `can` immediately and is audited; only admin.roles may do it", () => {
    const s = as("u-karim");
    const thomas = s.users.find((u) => u.id === "u-thomas")!;
    expect(can(s, thomas, "assignment.create")).toBe(false);
    expect(setRolePermission(s, "MANAGER", "assignment.create", true).ok).toBe(true);
    expect(can(s, thomas, "assignment.create")).toBe(true);
    expect(s.audit[0]).toMatchObject({ action: "role.update", entityId: "MANAGER", before: { "assignment.create": false }, after: { "assignment.create": true } });
    expect(setRolePermission(s, "SUPER_ADMIN", "admin.roles", false).ok).toBe(false);
    expect(resetRolePermissions(s, "MANAGER").ok).toBe(true);
    expect(can(s, thomas, "assignment.create")).toBe(false);
    expect(setRolePermission(as("u-amine"), "MANAGER", "assignment.create", true).ok).toBe(false);
  });
  it("scoring weights: validated, audited with before/after, and the ranking changes", () => {
    const s = as("u-amine");
    const bad = structuredClone(s.settings);
    bad.scoringWeights.skills = 500;
    expect(validateSettings(bad)).toMatch(/pondération/i);
    expect(saveSettings(s, bad).ok).toBe(false);
    const next = structuredClone(s.settings);
    next.scoringWeights = { skills: 0, availability: 100, sector: 0, grade: 0, certifications: 0, history: 0 };
    expect(saveSettings(s, next).ok).toBe(true);
    expect(s.audit[0]).toMatchObject({ action: "settings.update", before: { skills: 30, availability: 25 }, after: { skills: 0, availability: 100 } });
    expect(saveSettings(as("u-claire"), next).ok).toBe(false);
  });
});

describe("staffing requests state machine (8.8)", () => {
  it("SOUMISE → EN_ANALYSE → PROPOSITION → VALIDATION → APPROUVEE with RBAC at each step; rejection needs a reason", () => {
    const s = as("u-thomas");
    expect(takeRequest(s, "rqs-31").ok).toBe(false); // a manager cannot process the queue
    s.session.userId = "u-amine";
    expect(takeRequest(s, "rqs-31").ok).toBe(true);
    expect(sendProposal(s, "rqs-31").ok).toBe(false); // no candidate yet
    expect(setProposedEmployees(s, "rqs-31", ["e16"]).ok).toBe(true);
    expect(sendProposal(s, "rqs-31").ok).toBe(true);
    expect(sendToValidation(s, "rqs-31").ok).toBe(true);
    expect(approveRequest(s, "rqs-31").ok).toBe(false); // RM cannot approve
    s.session.userId = "u-samira";
    expect(approveRequest(s, "rqs-31").ok).toBe(true);
    expect(s.requests.find((r) => r.id === "rqs-31")!.status).toBe("APPROUVEE");
    const t = as("u-amine");
    expect(rejectRequest(t, "rqs-27", "").ok).toBe(false);
    expect(rejectRequest(t, "rqs-27", "Besoin reporté, demande clôturée.").ok).toBe(true);
  });
});
