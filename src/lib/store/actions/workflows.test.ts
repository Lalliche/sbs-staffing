import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { resetRolePermissions, saveSettings, setRolePermission, validateSettings } from "./admin";
import { approveRequest, rejectRequest, sendProposal, sendToValidation, takeRequest, setProposedEmployees } from "./requests";
import { can } from "../../engine/permissions";
import type { AppState } from "../types";

const as = (id: string): AppState => { const s = buildSeed(2); s.session.userId = id; return s; };

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
