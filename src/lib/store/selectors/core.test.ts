import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { employeeById, matchView, projectById, visibleEmployees, visibleEvaluations, visibleProjects, visibleRequests } from "./core";
import { scoreCandidate, requirementLike } from "../../engine/matching";
import type { AppState } from "../types";

const as = (id: string): AppState => {
  const s = buildSeed(2);
  s.session.userId = id;
  return s;
};

describe("selectors strip sensitive data by RBAC (spec 3.3)", () => {
  it("collaborateur: only own profile, no cost/rate, no budget, no other people", () => {
    const s = as("u-claire");
    const list = visibleEmployees(s);
    expect(list.map((e) => e.id)).toEqual(["e04"]);
    expect("dailyCost" in list[0]).toBe(false);
    expect("dailyRate" in list[0]).toBe(false);
    expect(employeeById(s, "e05")).toBeUndefined();
    expect(JSON.stringify(visibleProjects(s))).not.toMatch(/budget|dailySellPrice|estimatedDailyCost/i);
  });
  it("manager: scope = own department; no costs; sees budgets only if granted", () => {
    const s = as("u-thomas");
    const ids = visibleEmployees(s).map((e) => e.id);
    expect(ids).toContain("e11");
    expect(ids).not.toContain("e16");
    expect(visibleEmployees(s)[0].dailyCost).toBeUndefined();
    expect(visibleProjects(s).every((p) => p.departmentId === "d-aud" || p.leadId === "e02" || s.assignments.some((a) => a.projectId === p.id && a.employeeId === "e02"))).toBe(true);
    expect(projectById(s, "p-01")!.budget).toBeUndefined();
  });
  it("RH and Direction see costs; RH does not see missions' assignments scope beyond view", () => {
    for (const u of ["u-sophie", "u-yacine"]) {
      const s = as(u);
      expect(visibleEmployees(s)[0].dailyCost).toBeGreaterThan(0);
    }
    expect(projectById(as("u-yacine"), "p-01")!.budget).toBeGreaterThan(0);
  });
  it("matching cost is absent for viewers without the cost permission", () => {
    const s = as("u-amine");
    const req = s.requirements.find((r) => r.id === "rq-04-1")!;
    const m = scoreCandidate(s, s.employees.find((e) => e.id === "e16")!, requirementLike(req, s.projects.find((p) => p.id === req.projectId)));
    expect(matchView(s, m).estimatedCost).toBeUndefined(); // Resource Manager has no cost permission by default
    expect(matchView(as("u-yacine"), m).estimatedCost).toBeGreaterThan(0);
  });
  it("confidential evaluations: RH/Partner/evaluator only; collaborateur sees own non-confidential ones", () => {
    const rh = visibleEvaluations(as("u-sophie"));
    expect(rh.some((e) => e.confidential)).toBe(true);
    const claire = visibleEvaluations(as("u-claire"));
    expect(claire.every((e) => e.employeeId === "e04" && !e.confidential)).toBe(true);
    expect(claire.length).toBeGreaterThan(0);
    const lucas = visibleEvaluations(as("u-lucas"));
    expect(lucas.every((e) => e.employeeId === "e11" && !e.confidential)).toBe(true);
    const yanis = as("u-thomas"); // Thomas is the evaluator of e08's confidential evaluation (ev-3)
    expect(visibleEvaluations(yanis).some((e) => e.id === "ev-3")).toBe(true);
    expect(visibleEvaluations(as("u-nabil")).some((e) => e.id === "ev-3")).toBe(false);
  });
  it("requests: managers see their own, resource managers see the whole queue", () => {
    expect(visibleRequests(as("u-amine")).length).toBe(8);
    expect(visibleRequests(as("u-thomas")).every((r) => r.requesterId === "e02" || as("u-thomas").projects.some((p) => p.id === r.projectId))).toBe(true);
    expect(visibleRequests(as("u-claire"))).toEqual([]);
  });
  it("changing the role matrix changes what selectors return, live", () => {
    const s = as("u-thomas");
    expect(projectById(s, "p-01")!.budget).toBeUndefined();
    s.rolePermissions.MANAGER.push("project.finance.read");
    expect(projectById(s, "p-01")!.budget).toBeGreaterThan(0);
  });
});
