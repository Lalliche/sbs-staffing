import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { employeeById, isSelfView, matchView, projectById, visibleEmployees, visibleProjects, visibleRequests } from "./core";
import { scoreCandidate, requirementLike } from "../../engine/matching";
import { canEditPresence, presenceIds, presenceOfEmployeeOn, presenceSummary } from "./presence";
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
  it("presence: counts follow the viewer's scope; a collaborateur sees only themselves; no permission → nothing", () => {
    const all = as("u-amine");
    const sum = presenceSummary(all, all.employees);
    expect(sum.allowed).toBe(true);
    expect(sum.onsite + sum.remote + sum.absent + sum.off).toBe(sum.total);
    expect(sum.total).toBe(all.employees.filter((e) => e.status !== "ARCHIVE").length);
    const claire = as("u-claire");
    expect(presenceSummary(claire, claire.employees).total).toBe(1);
    expect(presenceOfEmployeeOn(claire, claire.employees.find((e) => e.id === "e16")!, claire.now)).toBeNull();
    expect(presenceOfEmployeeOn(claire, claire.employees.find((e) => e.id === "e04")!, claire.now)).toBe("REMOTE");
    const thomas = as("u-thomas");
    expect(presenceSummary(thomas, thomas.employees).total).toBeLessThan(sum.total); // department scope
    all.rolePermissions.RESOURCE_MANAGER = all.rolePermissions.RESOURCE_MANAGER.filter((p) => p !== "workmode.view");
    expect(presenceSummary(all, all.employees)).toMatchObject({ allowed: false, total: 0 });
    expect(Object.values(presenceIds(all, all.employees)).flat()).toHaveLength(0);
  });
  it("self view: only a Collaborateur (who sees nobody but themselves) gets « Mon profil » instead of the directory", () => {
    expect(isSelfView(as("u-claire"))).toBe(true);
    expect(isSelfView(as("u-lucas"))).toBe(true);
    for (const id of ["u-amine", "u-thomas", "u-sophie", "u-yacine", "u-samira", "u-karim"]) expect(isSelfView(as(id))).toBe(false);
    expect(isSelfView(buildSeed(2))).toBe(false); // nobody signed in
  });
  it("presence editing: the person themselves and the resource manager, not the direction", () => {
    expect(canEditPresence(as("u-claire"), "e04")).toBe(true);
    expect(canEditPresence(as("u-claire"), "e16")).toBe(false);
    expect(canEditPresence(as("u-amine"), "e16")).toBe(true);
    expect(canEditPresence(as("u-yacine"), "e16")).toBe(false);
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
