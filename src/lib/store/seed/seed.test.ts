import { describe, expect, it } from "vitest";
import { buildSeed } from "./index";
import { UNSTAFFED_PROJECT } from "./missions";
import { candidatePool, rankCandidates, requirementLike } from "../../engine/matching";
import { deficitLabel, forecastByGrade, recruitmentNeeds } from "../../engine/forecast";
import { findPlanConflicts } from "../../engine/conflicts";
import { utilizationOf, statusOf } from "../../engine/utilization";
import { addDays } from "../../engine/dates";
import { presenceCount, presenceOn } from "../../engine/workmode";
import { checkBooking } from "../../engine/conflicts";

const s = buildSeed(2);
const name = (id: string) => {
  const e = s.employees.find((x) => x.id === id)!;
  return `${e.firstName} ${e.lastName}`;
};

describe("seed — volumes (spec 9)", () => {
  it("has the required volumes", () => {
    expect(s.employees).toHaveLength(40);
    expect(s.departments).toHaveLength(5);
    expect(s.grades).toHaveLength(5);
    expect(s.skills.length).toBeGreaterThanOrEqual(28);
    expect(new Set(s.skills.map((k) => k.categoryId)).size).toBe(11);
    expect(s.projects).toHaveLength(15);
    expect(s.clients).toHaveLength(10);
    expect(s.assignments.length).toBeGreaterThanOrEqual(30);
    expect(s.assignments.some((a) => a.status === "SOFT")).toBe(true);
    expect(s.assignments.some((a) => a.status === "HARD")).toBe(true);
    expect(s.requests.length).toBeGreaterThanOrEqual(6);
    expect(new Set(s.requests.map((r) => r.status)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(s.leaves.map((l) => l.status))).toEqual(new Set(["APPROUVEE"])); // read-only absences: no leave workflow
    expect(new Set(s.pipeline.map((p) => p.certainty))).toEqual(new Set(["CONFIRMEE", "PROBABLE", "OPPORTUNITE"]));
  });
  it("has unique matricules and mission references, and valid links", () => {
    expect(new Set(s.employees.map((e) => e.matricule)).size).toBe(40);
    expect(new Set(s.projects.map((p) => p.reference)).size).toBe(15);
    expect(new Set(s.projects.map((p) => p.otp)).size).toBe(15);
    for (const a of s.assignments) {
      expect(s.employees.some((e) => e.id === a.employeeId)).toBe(true);
      expect(s.projects.some((p) => p.id === a.projectId)).toBe(true);
    }
    for (const e of s.employees) if (e.managerId) expect(s.employees.some((m) => m.id === e.managerId)).toBe(true);
  });
  it("is deterministic", () => {
    expect(JSON.stringify(buildSeed(2))).toBe(JSON.stringify(buildSeed(2)));
    expect(JSON.stringify(buildSeed(3))).not.toBe(JSON.stringify(buildSeed(2)));
  });
  it("all personas exist and map to the right roles", () => {
    const roles = ["SUPER_ADMIN", "DIRECTION", "PARTNER", "RESOURCE_MANAGER", "MANAGER", "RH", "COLLABORATEUR"];
    for (const r of roles) expect(s.users.some((u) => u.role === r)).toBe(true);
  });
});

describe("seed — storylines (spec 9)", () => {
  const from = s.now;
  const to = addDays(s.now, 27);
  it("one overloaded employee (120 %) with a recorded exception, and a few under-used", () => {
    const over = s.employees.filter((e) => statusOf(s, e, utilizationOf(s, e, from, to).planned) === "OVER");
    expect(over.map((e) => e.id)).toEqual(["e06"]);
    expect(Math.round(utilizationOf(s, over[0], from, to).planned)).toBe(120);
    expect(s.assignments.some((a) => a.employeeId === "e06" && a.exceptionReason)).toBe(true);
    const under = s.employees.filter((e) => utilizationOf(s, e, from, to).planned < 50);
    expect(under.length).toBeGreaterThanOrEqual(3);
  });
  it("the unstaffed mission has a ready-to-run matching: best ≈ 90, one blocked (skill), one unavailable (leave)", () => {
    const req = s.requirements.find((r) => r.projectId === UNSTAFFED_PROJECT && r.gradeMin === "g-3")!;
    const proj = s.projects.find((p) => p.id === UNSTAFFED_PROJECT)!;
    expect(proj.status).toBe("EN_ATTENTE_STAFFING");
    const ranked = rankCandidates(s, requirementLike(req, proj), { employeeIds: candidatePool(s, { gradeMin: req.gradeMin, projectLeadId: proj.leadId }) });
    expect(ranked[0].compatible).toBe(true);
    expect(ranked[0].score).toBeGreaterThanOrEqual(88);
    expect(ranked[0].score).toBeLessThanOrEqual(95);
    expect(ranked.some((r) => r.blocking.some((b) => b.kind === "MISSING_MANDATORY_SKILL"))).toBe(true);
    const unavailable = ranked.find((r) => r.blocking.some((b) => b.kind === "UNAVAILABLE") && r.conflicts.some((c) => c.kind === "LEAVE"));
    expect(unavailable && name(unavailable.employeeId)).toBe("Rania Mekki");
    // no assignment on this mission yet
    expect(s.assignments.filter((a) => a.projectId === UNSTAFFED_PROJECT)).toHaveLength(0);
  });
  it("a Senior booked 60 % on mission A and asked 60 % on mission B is flagged (conflict waiting to happen)", () => {
    const req = s.requirements.find((r) => r.projectId === UNSTAFFED_PROJECT && r.gradeMin === "g-3")!;
    const c = checkBooking(s, { employeeId: "e04", projectId: UNSTAFFED_PROJECT, startDate: req.startDate, endDate: req.endDate, allocationPct: 60, status: "HARD" });
    expect(c.some((x) => x.kind === "OVERALLOCATION" && x.severity === "ERROR" && x.peakPct === 120)).toBe(true);
  });
  it("an approved absence over the whole period makes the top candidate unavailable", () => {
    const t = buildSeed(2);
    const req = t.requirements.find((r) => r.projectId === UNSTAFFED_PROJECT && r.gradeMin === "g-3")!;
    const proj = t.projects.find((p) => p.id === UNSTAFFED_PROJECT)!;
    const pool = candidatePool(t, { gradeMin: req.gradeMin, projectLeadId: proj.leadId });
    const top = rankCandidates(t, requirementLike(req, proj), { employeeIds: pool })[0];
    expect(top.employeeId).toBe("e16");
    t.leaves.push({ id: "lv-test", employeeId: "e16", type: "CONGE_ANNUEL", startDate: "2026-12-14", endDate: "2027-01-20", status: "APPROUVEE", createdAt: "2026-11-12" });
    const after = rankCandidates(t, requirementLike(req, proj), { employeeIds: pool });
    expect(after.find((r) => r.employeeId === "e16")!.compatible).toBe(false);
    expect(after[0].employeeId).not.toBe("e16");
  });
  it("capacity deficit: « Déficit : 2 Seniors » within 3 months, in the default scenario", () => {
    const g = forecastByGrade(s, { from: s.now, horizonMonths: 3 }).find((x) => x.gradeId === "g-3")!;
    expect(deficitLabel(g.gradeName, g.deficitPersons)).toBe("Déficit : 2 Seniors");
    expect(recruitmentNeeds(s, { from: s.now, horizonMonths: 3 }).some((n) => n.gradeId === "g-3")).toBe(true);
  });
  it("plan conflicts include the leave over a long assignment and the acknowledged overload", () => {
    const cs = findPlanConflicts(s);
    expect(cs.some((c) => c.employeeId === "e05" && c.kind === "LEAVE")).toBe(true);
    expect(cs.find((c) => c.employeeId === "e06" && c.kind === "OVERALLOCATION")?.acknowledged).toBe(true);
  });
  it("work mode: most people have a usual remote day, a few have one-off exceptions, and today's counts add up", () => {
    const active = s.employees.filter((e) => e.status === "ACTIF");
    expect(active.filter((e) => (e.remoteWeekdays ?? []).length > 0).length).toBeGreaterThan(active.length / 2);
    expect(active.some((e) => !(e.remoteWeekdays ?? []).length)).toBe(true);
    for (const e of s.employees) for (const d of e.remoteWeekdays ?? []) expect((e.workingWeekdays ?? [0, 1, 2, 3, 4]).includes(d)).toBe(true); // never remote on a day off
    expect(s.workModes.length).toBeGreaterThanOrEqual(5);
    for (const w of s.workModes) expect(s.employees.some((e) => e.id === w.employeeId)).toBe(true);
    const c = presenceCount(s, active, "2026-11-16"); // a Monday
    expect(c.onsite + c.remote + c.absent + c.off).toBe(active.length);
    expect(c.onsite).toBeGreaterThan(0);
    expect(c.remote).toBeGreaterThan(0);
    expect(presenceOn(s, s.employees.find((e) => e.id === "e04")!, s.now)).toBe("REMOTE"); // seeded one-off exception on the demo day
  });
  it("a certification expires within 30 days of the demo clock", () => {
    const limit = addDays(s.now, 30);
    expect(s.employeeCertifications.some((c) => c.certificationId === "ce-ifrs" && c.expiresAt > s.now && c.expiresAt <= limit)).toBe(true);
    expect(s.notifications.some((n) => n.kind === "CERTIFICATION")).toBe(true);
  });
  it("audit log is seeded with an exception that carries a reason", () => {
    expect(s.audit.some((a) => a.action === "assignment.exception" && !!a.reason)).toBe(true);
  });
});

describe("seed — scenarios", () => {
  it("scenario 1 has few assignments, 3 amplifies conflicts, 4 shows a recruitment forecast", () => {
    const s1 = buildSeed(1);
    const s3 = buildSeed(3);
    const s4 = buildSeed(4);
    expect(s1.assignments.filter((a) => a.status === "HARD").length).toBeLessThan(s.assignments.filter((a) => a.status === "HARD").length / 2);
    expect(findPlanConflicts(s3).length).toBeGreaterThan(findPlanConflicts(s).length);
    const needs = recruitmentNeeds(s4, { from: s4.now, horizonMonths: 12 });
    expect(needs.length).toBeGreaterThanOrEqual(2);
    expect(s4.now).toBe("2026-12-13");
  });
});
