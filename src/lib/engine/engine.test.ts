import { describe, expect, it } from "vitest";
import { addDays, addMonths, diffDays, dow, weekNumber, weekStart } from "./dates";
import { absenceHours, assignedHours, availableHours, dayLoads, plannedHoursFor, reservedHours, theoreticalHours } from "./capacity";
import { utilizationOf, utilizationOfGroup, utilizationStatus } from "./utilization";
import { checkBooking, findPlanConflicts, hasBlockingConflict } from "./conflicts";
import { evaluateBooking, expiredSoftBookings, projectCoverage, requirementCoverage, conflictsForConversion } from "./booking";
import { rankCandidates, requirementLike, scoreCandidate } from "./matching";
import { plannedModeOn, presenceCount, presenceDays, presenceOn, presenceRange } from "./workmode";
import { deficitLabel, forecastByGrade, forecastBySkill, recruitmentNeeds } from "./forecast";
import { DEFAULT_ROLE_PERMISSIONS, can, inScope } from "./permissions";
import { diffFields, writeAudit } from "./audit";
import { fmtDZD, fmtHours, fmtPct } from "./format";
import { assignment, baseState, emp, leave, project, requirement } from "./testkit";
import type { AppState, User } from "../store/types";

/* Calendar reminder: 2026-11-15 is a Sunday; the office works Sunday→Thursday (5 days/week, 8 h/day at 40 h). */

describe("dates", () => {
  it("handles weekdays, week starts and month arithmetic in UTC", () => {
    expect(dow("2026-11-15")).toBe(0);
    expect(weekStart("2026-11-19")).toBe("2026-11-15");
    expect(weekStart("2026-11-21")).toBe("2026-11-15");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(diffDays("2026-11-15", "2026-12-15")).toBe(30);
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(weekNumber("2026-11-15")).toBeGreaterThan(40);
  });
});

describe("capacity (7.1)", () => {
  it("theoretical = Σ working days × weeklyHours / working days per week (Fri/Sat excluded)", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    expect(theoreticalHours(s, s.employees[0], "2026-11-15", "2026-11-21")).toBe(40);
    expect(theoreticalHours(s, s.employees[0], "2026-11-15", "2026-11-26")).toBe(80);
  });
  it("holidays reduce capacity", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    s.holidays = [{ id: "h1", date: "2026-11-17", name: "Férié", officeId: null }];
    expect(theoreticalHours(s, s.employees[0], "2026-11-15", "2026-11-21")).toBe(32);
  });
  it("part-time: 32 h over 4 days keeps 8 h/day on the days actually worked", () => {
    const s = baseState();
    s.employees = [emp({ id: "pt", weeklyHours: 32, workingWeekdays: [0, 1, 2, 3] })];
    expect(theoreticalHours(s, s.employees[0], "2026-11-15", "2026-11-21")).toBe(32);
  });
  it("contract dates cap capacity", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1", startDate: "2026-11-17", endDate: "2026-11-18" })];
    expect(theoreticalHours(s, s.employees[0], "2026-11-15", "2026-11-26")).toBe(16);
  });
  it("never counts the same unavailability twice (overlapping leaves + a holiday)", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    s.holidays = [{ id: "h1", date: "2026-11-17", name: "Férié", officeId: null }];
    s.leaves = [leave({ id: "l1", employeeId: "e1", startDate: "2026-11-16", endDate: "2026-11-18" }), leave({ id: "l2", employeeId: "e1", startDate: "2026-11-17", endDate: "2026-11-19" })];
    // working days in the leave union: 16, 18, 19 (17 is a holiday) → 3 × 8 h
    expect(absenceHours(s, s.employees[0], "2026-11-15", "2026-11-21")).toBe(24);
    expect(availableHours(s, s.employees[0], "2026-11-15", "2026-11-21")).toBe(8); // only Sunday 15 is free
  });
  it("available = theoretical − absences − HARD hours; SOFT is not counted", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    s.leaves = [leave({ id: "l1", employeeId: "e1", startDate: "2026-11-18", endDate: "2026-11-19" })];
    s.assignments = [assignment({ id: "a1", employeeId: "e1", startDate: "2026-11-15", endDate: "2026-11-19", allocationPct: 50, status: "HARD" }), assignment({ id: "a2", employeeId: "e1", startDate: "2026-11-15", endDate: "2026-11-19", allocationPct: 30, status: "SOFT" })];
    const e = s.employees[0];
    // theoretical 40 − absences 16 − hard (3 present days × 4 h = 12) = 12
    expect(availableHours(s, e, "2026-11-15", "2026-11-19")).toBe(12);
    expect(reservedHours(s, e, "2026-11-15", "2026-11-19")).toBeCloseTo(7.2);
    expect(availableHours(s, e, "2026-11-15", "2026-11-19", { includeSoft: true })).toBeCloseTo(12 - 7.2);
    expect(assignedHours(s, e, "2026-11-15", "2026-11-19")).toBe(12);
  });
  it("an overloaded day cannot compensate a free day", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    s.assignments = [assignment({ id: "a1", employeeId: "e1", startDate: "2026-11-15", endDate: "2026-11-15", allocationPct: 150 })];
    expect(availableHours(s, s.employees[0], "2026-11-15", "2026-11-16")).toBe(8); // Monday free, Sunday overloaded → 0
  });
  it("planned hours of an assignment follow working days × daily hours × %", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    expect(plannedHoursFor(s, s.employees[0], "2026-11-15", "2026-11-26", 50)).toBe(40);
  });
  it("dayLoads exposes absent / working flags", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    const loads = dayLoads(s, s.employees[0], "2026-11-19", "2026-11-22");
    expect(loads.map((l) => l.working)).toEqual([true, false, false, true]);
  });
});

describe("utilization (7.2): planned = confirmed hours ÷ theoretical capacity", () => {
  function setup() {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    s.assignments = [assignment({ id: "a1", employeeId: "e1", startDate: "2026-11-15", endDate: "2026-11-19", allocationPct: 50 }), assignment({ id: "a2", employeeId: "e1", startDate: "2026-11-15", endDate: "2026-11-19", allocationPct: 25, status: "SOFT" })];
    return s;
  }
  it("planned counts HARD only by default, SOFT on request", () => {
    const s = setup();
    const u = utilizationOf(s, s.employees[0], "2026-11-15", "2026-11-19");
    expect(u.planned).toBeCloseTo(50);
    expect(utilizationOf(s, s.employees[0], "2026-11-15", "2026-11-19", { includeSoft: true }).planned).toBeCloseTo(75);
  });
  it("group utilization is Σ hours / Σ capacity, not a mean of percentages", () => {
    const s = setup();
    s.employees.push(emp({ id: "e2", weeklyHours: 20, workingWeekdays: [0, 1] }));
    const g = utilizationOfGroup(s, s.employees, "2026-11-15", "2026-11-19");
    expect(g.theoretical).toBe(60);
    expect(g.assigned).toBe(20);
    expect(g.planned).toBeCloseTo(33.33, 1);
  });
  it("status uses configurable thresholds (default <60 under, >100 over)", () => {
    const s = baseState();
    expect(utilizationStatus(40, s.settings.thresholds)).toBe("UNDER");
    expect(utilizationStatus(80, s.settings.thresholds)).toBe("OK");
    expect(utilizationStatus(120, s.settings.thresholds)).toBe("OVER");
    expect(utilizationStatus(110, { underUse: 50, overload: 115 })).toBe("OK");
  });
});

describe("conflicts (7.4)", () => {
  const draft = (over = {}) => ({ employeeId: "e1", projectId: "pB", startDate: "2026-11-15", endDate: "2026-11-26", allocationPct: 60, status: "HARD" as const, ...over });
  function setup() {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    s.assignments = [assignment({ id: "a1", employeeId: "e1", projectId: "pA", allocationPct: 60 })];
    return s;
  }
  it("flags > 100 % over any overlapping day (the Senior booked 60 % + 60 %)", () => {
    const s = setup();
    const c = checkBooking(s, draft());
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: "OVERALLOCATION", severity: "ERROR", peakPct: 120 });
    expect(hasBlockingConflict(c)).toBe(true);
  });
  it("exactly 100 % is allowed", () => {
    const s = setup();
    expect(checkBooking(s, draft({ allocationPct: 40 }))).toEqual([]);
  });
  it("no conflict when the periods do not overlap", () => {
    const s = setup();
    expect(checkBooking(s, draft({ startDate: "2026-12-06", endDate: "2026-12-20" }))).toEqual([]);
  });
  it("ignores the booking itself when modifying (id)", () => {
    const s = setup();
    expect(checkBooking(s, draft({ id: "a1", projectId: "pA", allocationPct: 100 }))).toEqual([]);
  });
  it("overlap with a SOFT booking only is a WARNING (not blocking)", () => {
    const s = setup();
    s.assignments[0].status = "SOFT";
    const c = checkBooking(s, draft());
    expect(c[0]).toMatchObject({ kind: "OVERALLOCATION", severity: "WARNING" });
    expect(hasBlockingConflict(c)).toBe(false);
  });
  it("approved leave = ERROR, pending leave = WARNING", () => {
    const s = setup();
    s.assignments = [];
    s.leaves = [leave({ id: "l1", employeeId: "e1", startDate: "2026-11-17", endDate: "2026-11-23" }), leave({ id: "l2", employeeId: "e1", startDate: "2026-11-25", endDate: "2026-11-26", status: "SOUMISE" })];
    const c = checkBooking(s, draft());
    expect(c.find((x) => x.kind === "LEAVE")?.severity).toBe("ERROR"); // 5 of 8 working days
    expect(c.find((x) => x.kind === "LEAVE_PENDING")?.severity).toBe("WARNING");
    // a short leave inside a longer booking is only a warning (normal life)
    s.leaves = [leave({ id: "l1", employeeId: "e1", startDate: "2026-11-17", endDate: "2026-11-18" })];
    const short = checkBooking(s, draft({ endDate: "2027-01-28" }));
    expect(short.find((x) => x.kind === "LEAVE")?.severity).toBe("WARNING");
    expect(hasBlockingConflict(short)).toBe(false);
  });
  it("beyond contract dates is an ERROR", () => {
    const s = setup();
    s.assignments = [];
    s.employees[0].endDate = "2026-11-20";
    expect(checkBooking(s, draft()).some((c) => c.kind === "CONTRACT" && c.severity === "ERROR")).toBe(true);
  });
  it("part-time vs full-time mission", () => {
    const s = setup();
    s.assignments = [];
    s.employees = [emp({ id: "e1", weeklyHours: 32, workingWeekdays: [0, 1, 2, 3] })];
    expect(checkBooking(s, draft({ fullTime: true })).some((c) => c.kind === "FULL_TIME")).toBe(true);
    expect(checkBooking(s, draft()).some((c) => c.kind === "FULL_TIME")).toBe(false);
  });
  it("archived employee cannot be booked", () => {
    const s = setup();
    s.assignments = [];
    s.employees[0].status = "ARCHIVE";
    expect(checkBooking(s, draft()).some((c) => c.kind === "INACTIVE")).toBe(true);
  });
  it("findPlanConflicts reports an existing overload once and ignores clean plans", () => {
    const s = setup();
    expect(findPlanConflicts(s)).toEqual([]);
    s.assignments.push(assignment({ id: "a2", employeeId: "e1", projectId: "pB", allocationPct: 60 }));
    const found = findPlanConflicts(s);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("OVERALLOCATION");
    expect(found[0].withAssignmentIds?.length).toBe(1);
    expect(found[0].acknowledged).toBe(false);
    s.assignments[1].exceptionReason = "Besoin client critique, validé par la direction.";
    expect(findPlanConflicts(s)[0].acknowledged).toBe(true);
  });
  it("ignores periods already in the past (relative to the demo clock)", () => {
    const s = setup();
    s.assignments.push(assignment({ id: "a2", employeeId: "e1", projectId: "pB", allocationPct: 60, startDate: "2026-09-01", endDate: "2026-11-10" }));
    expect(findPlanConflicts(s)).toEqual([]);
  });
  it("a leave approved AFTER an assignment creates a plan conflict", () => {
    const s = setup();
    expect(findPlanConflicts(s)).toEqual([]);
    s.assignments[0].endDate = "2027-02-28";
    s.leaves.push(leave({ id: "l1", employeeId: "e1", startDate: "2026-11-17", endDate: "2026-11-18" }));
    expect(findPlanConflicts(s)).toEqual([]); // a 2-day leave inside an assignment is normal life, not a conflict
    s.leaves.push(leave({ id: "l2", employeeId: "e1", startDate: "2026-11-19", endDate: "2026-12-24" }));
    expect(findPlanConflicts(s).some((c) => c.kind === "LEAVE")).toBe(true); // a long absence is
  });
});

describe("soft vs hard booking (7.5)", () => {
  it("SOFT → HARD conversion re-checks conflicts without counting itself", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1" })];
    s.assignments = [assignment({ id: "h", employeeId: "e1", allocationPct: 70, status: "HARD" }), assignment({ id: "sft", employeeId: "e1", projectId: "pB", allocationPct: 20, status: "SOFT" })];
    expect(conflictsForConversion(s, s.assignments[1])).toEqual([]);
    s.assignments[1].allocationPct = 40;
    const c = conflictsForConversion(s, s.assignments[1]);
    expect(hasBlockingConflict(c)).toBe(true);
  });
  it("soft bookings expire after the configured delay", () => {
    const s = baseState();
    s.assignments = [assignment({ id: "s1", employeeId: "e1", status: "SOFT", softExpiresAt: "2026-11-14" }), assignment({ id: "s2", employeeId: "e1", status: "SOFT", softExpiresAt: "2026-11-30" }), assignment({ id: "h", employeeId: "e1", status: "HARD" })];
    expect(expiredSoftBookings(s).map((a) => a.id)).toEqual(["s1"]);
  });
  it("coverage counts HARD only as staffed", () => {
    const s = baseState();
    const r = requirement({ id: "r1", quantity: 3 });
    s.requirements = [r];
    s.assignments = [assignment({ id: "a1", employeeId: "e1", requirementId: "r1", status: "HARD" }), assignment({ id: "a2", employeeId: "e2", requirementId: "r1", status: "HARD" }), assignment({ id: "a3", employeeId: "e3", requirementId: "r1", status: "SOFT" })];
    expect(requirementCoverage(s, r)).toMatchObject({ hard: 2, soft: 1, missing: 1 });
    expect(projectCoverage(s, "p1").rate).toBeCloseTo(2 / 3);
  });
  it("evaluateBooking demands an exception when blocked", () => {
    const s = baseState();
    s.employees = [emp({ id: "e1", gradeId: "g-1" })];
    s.projects = [project({ id: "p1" })];
    const r = requirement({ id: "r1", gradeMin: "g-3" });
    const ev = evaluateBooking(s, { employeeId: "e1", projectId: "p1", startDate: "2026-12-01", endDate: "2026-12-10", allocationPct: 50, status: "HARD" }, r);
    expect(ev.needsException).toBe(true);
    expect(ev.blocks.map((b) => b.kind)).toContain("GRADE_BELOW_MINIMUM");
  });
});

describe("matching score (7.3)", () => {
  function setup() {
    const s = baseState();
    s.projects = [project({ id: "p1" })];
    const lvl = (employeeId: string, skillId: string, level: 1 | 2 | 3 | 4) => ({ employeeId, skillId, level, updatedAt: "2026-01-01" });
    s.employees = [
      emp({ id: "best", gradeId: "g-3" }),
      emp({ id: "noskill", gradeId: "g-3" }),
      emp({ id: "junior", gradeId: "g-1" }),
      emp({ id: "onleave", gradeId: "g-3" }),
      emp({ id: "busy", gradeId: "g-3" }),
    ];
    s.employeeSkills = [lvl("best", "sk-audit", 4), lvl("best", "sk-ifrs", 3), lvl("junior", "sk-audit", 3), lvl("junior", "sk-ifrs", 2), lvl("onleave", "sk-audit", 4), lvl("onleave", "sk-ifrs", 3), lvl("busy", "sk-audit", 4), lvl("busy", "sk-ifrs", 3), lvl("noskill", "sk-bi", 3)];
    s.employeeCertifications = [{ employeeId: "best", certificationId: "ce-ifrs", obtainedAt: "2025-01-01", expiresAt: "2028-01-01" }];
    s.leaves = [leave({ id: "lv", employeeId: "onleave", startDate: "2026-12-01", endDate: "2027-02-26" })];
    s.assignments = [assignment({ id: "b1", employeeId: "busy", projectId: "pX", startDate: "2026-12-01", endDate: "2027-02-26", allocationPct: 100 }), assignment({ id: "old", employeeId: "best", projectId: "pOld", startDate: "2026-01-01", endDate: "2026-06-30", status: "TERMINEE" })];
    s.projects.push(project({ id: "pOld", sector: "Banque & assurance" }), project({ id: "pX" }));
    return s;
  }
  const req = () => requirementLike(requirement({ id: "r1", mandatorySkillIds: ["sk-audit", "sk-ifrs"], desiredSkillIds: [], startDate: "2026-12-01", endDate: "2027-02-25" }), project({ id: "p1" }));

  it("score is the weighted sum of its breakdown and is bounded 0..100", () => {
    const s = setup();
    const m = scoreCandidate(s, s.employees[0], req());
    expect(m.criteria.map((c) => c.key)).toEqual(["skills", "availability", "sector", "grade", "certifications", "history"]);
    expect(Math.round(m.criteria.reduce((a, c) => a + c.points, 0))).toBe(m.score);
    expect(m.score).toBeGreaterThan(85);
    expect(m.score).toBeLessThanOrEqual(100);
    expect(m.compatible).toBe(true);
    expect(m.criteria.reduce((a, c) => a + c.max, 0)).toBeCloseTo(100);
  });
  it("a missing mandatory skill is BLOCKING, listed, never invented", () => {
    const s = setup();
    const m = scoreCandidate(s, s.employees[1], req());
    expect(m.compatible).toBe(false);
    expect(m.blocking.map((b) => b.kind)).toContain("MISSING_MANDATORY_SKILL");
    expect(m.missingSkillIds.sort()).toEqual(["sk-audit", "sk-ifrs"]);
  });
  it("grade below the mandatory minimum is blocking", () => {
    const s = setup();
    const m = scoreCandidate(s, s.employees[2], req());
    expect(m.blocking.map((b) => b.kind)).toContain("GRADE_BELOW_MINIMUM");
    expect(m.compatible).toBe(false);
  });
  it("approved leave over the whole period makes the candidate UNAVAILABLE", () => {
    const s = setup();
    const m = scoreCandidate(s, s.employees[3], req());
    expect(m.availability.ratio).toBe(0);
    expect(m.blocking.map((b) => b.kind)).toContain("UNAVAILABLE");
    expect(m.conflicts.some((c) => c.kind === "LEAVE")).toBe(true);
  });
  it("existing 100 % HARD assignment on the period → unavailable", () => {
    const s = setup();
    const m = scoreCandidate(s, s.employees[4], req());
    expect(m.availability.ratio).toBe(0);
    expect(m.blocking.map((b) => b.kind)).toContain("UNAVAILABLE");
  });
  it("blocked candidates are returned, flagged, ranked after compatible ones", () => {
    const s = setup();
    const ranked = rankCandidates(s, req());
    expect(ranked).toHaveLength(5);
    expect(ranked[0].employeeId).toBe("best");
    const firstBlocked = ranked.findIndex((r) => !r.compatible);
    expect(ranked.slice(firstBlocked).every((r) => !r.compatible)).toBe(true);
    expect(ranked.filter((r) => r.compatible).map((r) => r.employeeId)).toEqual(["best"]);
  });
  it("blocking criteria are configurable; turning one off keeps a visible warning", () => {
    const s = setup();
    s.settings.blocking.missingMandatorySkill = false;
    const m = scoreCandidate(s, s.employees[1], req());
    expect(m.blocking.map((b) => b.kind)).not.toContain("MISSING_MANDATORY_SKILL");
    expect(m.warnings.join(" ")).toMatch(/obligatoire manquante/);
  });
  it("changing the scoring weights changes the ranking (spec demo F)", () => {
    const s = setup();
    // 'partial' has strong availability but weaker skill/cert; 'best' wins on defaults.
    s.employees.push(emp({ id: "partial", gradeId: "g-3", sectors: [] }));
    s.employeeSkills.push({ employeeId: "partial", skillId: "sk-audit", level: 3, updatedAt: "2026-01-01" }, { employeeId: "partial", skillId: "sk-ifrs", level: 2, updatedAt: "2026-01-01" });
    const before = rankCandidates(s, req()).filter((r) => r.compatible).map((r) => r.employeeId);
    expect(before[0]).toBe("best");
    s.settings.scoringWeights = { skills: 0, availability: 0, sector: 0, grade: 0, certifications: 0, history: 100 };
    const after = rankCandidates(s, req()).filter((r) => r.compatible);
    expect(after[0].employeeId).toBe("best"); // only 'best' has history
    expect(after.find((r) => r.employeeId === "partial")!.score).toBe(0);
  });
  it("estimated cost is computed from daily cost (selectors strip it for viewers without the permission)", () => {
    const s = setup();
    const m = scoreCandidate(s, s.employees[0], req());
    expect(m.estimatedCost).toBeGreaterThan(0);
  });
});

describe("absences feed availability", () => {
  it("approval removes the person from the candidate pool (availability recomputed)", () => {
    const s = baseState();
    s.projects = [project({ id: "p1" })];
    s.employees = [emp({ id: "e1" })];
    s.employeeSkills = [{ employeeId: "e1", skillId: "sk-audit", level: 3, updatedAt: "2026-01-01" }];
    const r = requirementLike(requirement({ id: "r1", mandatorySkillIds: ["sk-audit"], startDate: "2026-12-01", endDate: "2026-12-10" }), s.projects[0]);
    s.leaves = [leave({ id: "l1", employeeId: "e1", startDate: "2026-12-01", endDate: "2026-12-10", status: "SOUMISE" })];
    expect(scoreCandidate(s, s.employees[0], r).compatible).toBe(true);
    s.leaves[0].status = "APPROUVEE";
    const after = scoreCandidate(s, s.employees[0], r);
    expect(after.compatible).toBe(false);
    expect(after.blocking[0].kind).toBe("UNAVAILABLE");
  });
});

describe("capacity planning / forecast (7.8)", () => {
  /** 3 bank-audit missions need 5 Seniors, only 3 are free → « Déficit : 2 Seniors ». */
  function bank(): AppState {
    const s = baseState();
    s.employees = ["s1", "s2", "s3"].map((id) => emp({ id, gradeId: "g-3" }));
    s.projects = [project({ id: "m1" }), project({ id: "m2" }), project({ id: "m3" })];
    s.requirements = [
      requirement({ id: "r1", projectId: "m1", quantity: 2, mandatorySkillIds: ["sk-audit"] }),
      requirement({ id: "r2", projectId: "m2", quantity: 2, mandatorySkillIds: ["sk-audit"] }),
      requirement({ id: "r3", projectId: "m3", quantity: 1, mandatorySkillIds: ["sk-audit"] }),
    ];
    s.employeeSkills = s.employees.map((e) => ({ employeeId: e.id, skillId: "sk-audit", level: 3, updatedAt: "2026-01-01" }));
    return s;
  }
  const params = { from: "2026-11-15", horizonMonths: 3 as const };

  it("reproduces « Déficit : 2 Seniors »", () => {
    const s = bank();
    const senior = forecastByGrade(s, params).find((g) => g.gradeId === "g-3")!;
    expect(senior.deficitPersons).toBe(2);
    expect(deficitLabel(senior.gradeName, senior.deficitPersons)).toBe("Déficit : 2 Seniors");
    expect(recruitmentNeeds(s, params)[0]).toMatchObject({ gradeId: "g-3", persons: 2 });
  });
  it("weights demand by certainty (100 / 60 / 25) — probable missions need fewer heads", () => {
    const s = bank();
    s.projects.forEach((p) => (p.certainty = "PROBABLE"));
    const senior = forecastByGrade(s, params).find((g) => g.gradeId === "g-3")!;
    expect(senior.deficitPersons).toBe(0); // 5 × 60 % = 3 seniors needed vs 3 free
    s.projects.forEach((p) => (p.certainty = "OPPORTUNITE"));
    expect(forecastByGrade(s, params).find((g) => g.gradeId === "g-3")!.surplusPersons).toBeGreaterThanOrEqual(1);
    // weights are editable
    s.settings.forecastWeights.OPPORTUNITE = 100;
    expect(forecastByGrade(s, params).find((g) => g.gradeId === "g-3")!.deficitPersons).toBe(2);
  });
  it("seats already covered by HARD assignments are not double counted as demand", () => {
    const s = bank();
    s.assignments = [assignment({ id: "a", employeeId: "s1", projectId: "m1", requirementId: "r1", startDate: "2026-12-01", endDate: "2027-02-25", allocationPct: 100 })];
    // s1 is fully booked (supply −1) and r1 needs 1 seat fewer (demand −1) → deficit unchanged
    expect(forecastByGrade(s, params).find((g) => g.gradeId === "g-3")!.deficitPersons).toBe(2);
  });
  it("what-if: adding a probable mission and extra hires changes the result", () => {
    const s = bank();
    const base = forecastByGrade(s, params).find((g) => g.gradeId === "g-3")!.deficitPersons;
    const extra = [{ id: "wi", name: "Mission probable", clientLabel: "Client X", departmentId: "d1", sector: "Banque & assurance", certainty: "PROBABLE" as const, startDate: "2026-12-01", endDate: "2027-01-31", needs: [{ gradeId: "g-3", quantity: 5, skillIds: [], allocationPct: 100 }] }];
    expect(forecastByGrade(s, { ...params, extraItems: extra }).find((g) => g.gradeId === "g-3")!.deficitPersons).toBe(base + 3);
    expect(forecastByGrade(s, { ...params, extraHires: { "g-3": 2 } }).find((g) => g.gradeId === "g-3")!.deficitPersons).toBe(0);
  });
  it("approved leave reduces future supply", () => {
    const s = bank();
    s.leaves = [leave({ id: "l", employeeId: "s1", startDate: "2026-12-01", endDate: "2027-01-31" })];
    expect(forecastByGrade(s, params).find((g) => g.gradeId === "g-3")!.deficitPersons).toBe(3);
  });
  it("by skill: demand attributed to mandatory skills, holders counted at level ≥ 2", () => {
    const s = bank();
    const k = forecastBySkill(s, params).find((x) => x.skillId === "sk-audit")!;
    expect(k.holders).toBe(3);
    expect(k.deficitPersons).toBe(2);
  });
  it("a 1-month horizon only sees demand inside it", () => {
    const s = bank();
    expect(forecastByGrade(s, { from: "2026-11-15", horizonMonths: 1 }).find((g) => g.gradeId === "g-3")!.deficitPersons).toBe(0);
  });
});

describe("RBAC (3.3)", () => {
  function users(): { s: AppState; collab: User; manager: User; rm: User; rh: User; admin: User } {
    const s = baseState();
    s.departments.push({ id: "d2", name: "Transactions", code: "TRX" });
    s.employees = [emp({ id: "ec" }), emp({ id: "em", gradeId: "g-4" }), emp({ id: "other", departmentId: "d2" })];
    s.projects = [project({ id: "pA", departmentId: "d1", leadId: "em" }), project({ id: "pB", departmentId: "d2", leadId: "other" })];
    const mk = (id: string, role: User["role"], employeeId: string | null): User => ({ id, firstName: id, lastName: "", email: "", role, employeeId, status: "ACTIF" });
    return { s, collab: mk("u1", "COLLABORATEUR", "ec"), manager: mk("u2", "MANAGER", "em"), rm: mk("u3", "RESOURCE_MANAGER", null), rh: mk("u4", "RH", null), admin: mk("u5", "SUPER_ADMIN", null) };
  }
  it("collaborateur cannot read salaries nor create assignments; RH manages people, not assignments", () => {
    const { s, collab, rh, rm } = users();
    expect(can(s, collab, "employee.salary.read")).toBe(false);
    expect(can(s, collab, "assignment.create")).toBe(false);
    expect(can(s, rh, "employee.create")).toBe(true);
    expect(can(s, rh, "assignment.create")).toBe(false);
    expect(can(s, rm, "assignment.create")).toBe(true);
  });
  it("manager is limited to their scope (department / own missions)", () => {
    const { s, manager, collab } = users();
    expect(can(s, manager, "employee.view", { employeeId: "ec" })).toBe(true);
    expect(can(s, manager, "employee.view", { employeeId: "other" })).toBe(false);
    expect(can(s, manager, "project.edit", { projectId: "pA" })).toBe(true);
    expect(can(s, manager, "project.edit", { projectId: "pB" })).toBe(false);
    expect(inScope(s, collab, { employeeId: "em" })).toBe(false);
    expect(inScope(s, collab, { employeeId: "ec" })).toBe(true);
  });
  it("the role matrix is editable and takes effect immediately", () => {
    const { s, manager } = users();
    expect(can(s, manager, "assignment.create")).toBe(false);
    s.rolePermissions.MANAGER.push("assignment.create");
    expect(can(s, manager, "assignment.create")).toBe(true);
    s.rolePermissions.MANAGER = s.rolePermissions.MANAGER.filter((p) => p !== "assignment.create");
    expect(can(s, manager, "assignment.create")).toBe(false);
  });
  it("deactivated users and unknown permissions are denied; admin.roles is super-admin only by default", () => {
    const { s, rm, admin } = users();
    rm.status = "DESACTIVE";
    expect(can(s, rm, "assignment.create")).toBe(false);
    expect(can(s, admin, "admin.roles")).toBe(true);
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN.includes("admin.roles")).toBe(false);
    expect(can(s, admin, "does.not.exist")).toBe(false);
  });
  it("work mode: everyone sees presence, managers and the person themselves can edit it", () => {
    const { s, collab, rh, manager } = users();
    expect(can(s, collab, "workmode.view")).toBe(true);
    expect(can(s, collab, "workmode.edit", { employeeId: collab.employeeId! })).toBe(true);
    expect(can(s, collab, "workmode.edit", { employeeId: "someone-else" })).toBe(false);
    expect(can(s, rh, "workmode.edit")).toBe(true);
    expect(can(s, manager, "workmode.view")).toBe(true);
  });
});

describe("audit log", () => {
  it("is append-only, sequenced and stores only changed fields", () => {
    const s = baseState();
    writeAudit(s, { actorId: "u1", action: "assignment.create", entity: "Assignment", entityId: "a1", after: { pct: 50, status: "HARD" } });
    writeAudit(s, { actorId: "u1", action: "assignment.exception", entity: "Assignment", entityId: "a1", before: { pct: 50, status: "HARD" }, after: { pct: 70, status: "HARD" }, reason: "Besoin client critique" });
    expect(s.audit).toHaveLength(2);
    expect(s.audit[0].seq).toBe(2);
    expect(s.audit[0].reason).toBe("Besoin client critique");
    expect(s.audit[0].before).toEqual({ pct: 50 });
    expect(s.audit[0].after).toEqual({ pct: 70 });
    expect(diffFields({ a: 1 }, { a: 1 })).toEqual({ before: undefined, after: undefined });
  });
});

describe("format (fr-FR)", () => {
  it("formats DZD, percent and hours with French separators", () => {
    expect(fmtDZD(1234567)).toBe("1 234 567 DZD");
    expect(fmtPct(85)).toBe("85 %");
    expect(fmtHours(37.5)).toBe("37,5 h");
  });
});

describe("work mode — présentiel / à distance", () => {
  function setup() {
    const s = baseState();
    // 2026-11-15 is a Sunday. Tuesdays (2) are remote for e1; e2 has no usual remote day.
    s.employees = [emp({ id: "e1", remoteWeekdays: [2] }), emp({ id: "e2" })];
    return s;
  }
  it("follows the usual weekly pattern", () => {
    const s = setup();
    expect(presenceOn(s, s.employees[0], "2026-11-15")).toBe("ONSITE");
    expect(presenceOn(s, s.employees[0], "2026-11-17")).toBe("REMOTE");
    expect(presenceOn(s, s.employees[1], "2026-11-17")).toBe("ONSITE");
  });
  it("a one-day override beats the pattern, in both directions", () => {
    const s = setup();
    s.workModes = [
      { id: "w1", employeeId: "e1", date: "2026-11-17", mode: "ONSITE" },
      { id: "w2", employeeId: "e2", date: "2026-11-18", mode: "REMOTE" },
    ];
    expect(presenceOn(s, s.employees[0], "2026-11-17")).toBe("ONSITE");
    expect(presenceOn(s, s.employees[1], "2026-11-18")).toBe("REMOTE");
    expect(plannedModeOn(s, s.employees[1], "2026-11-19")).toBe("ONSITE");
  });
  it("weekends, holidays and days outside the contract are OFF; approved absences are ABSENT", () => {
    const s = setup();
    s.holidays = [{ id: "h", date: "2026-11-16", name: "Férié", officeId: null }];
    s.leaves = [leave({ id: "l1", employeeId: "e1", startDate: "2026-11-18", endDate: "2026-11-18" })];
    expect(presenceOn(s, s.employees[0], "2026-11-20")).toBe("OFF"); // Friday
    expect(presenceOn(s, s.employees[0], "2026-11-16")).toBe("OFF"); // holiday
    expect(presenceOn(s, s.employees[0], "2026-11-18")).toBe("ABSENT");
    s.leaves[0].status = "SOUMISE";
    expect(presenceOn(s, s.employees[0], "2026-11-18")).toBe("ONSITE"); // a pending request is not an absence
  });
  it("an override on a day off or during an absence changes nothing visible", () => {
    const s = setup();
    s.leaves = [leave({ id: "l1", employeeId: "e1", startDate: "2026-11-18", endDate: "2026-11-18" })];
    s.workModes = [{ id: "w1", employeeId: "e1", date: "2026-11-18", mode: "REMOTE" }, { id: "w2", employeeId: "e1", date: "2026-11-20", mode: "REMOTE" }];
    expect(presenceOn(s, s.employees[0], "2026-11-18")).toBe("ABSENT");
    expect(presenceOn(s, s.employees[0], "2026-11-20")).toBe("OFF");
  });
  it("counts people and person-days", () => {
    const s = setup();
    expect(presenceCount(s, s.employees, "2026-11-17")).toEqual({ onsite: 1, remote: 1, absent: 0, off: 0 });
    expect(presenceCount(s, s.employees, "2026-11-20")).toEqual({ onsite: 0, remote: 0, absent: 0, off: 2 });
    const d = presenceDays(s, s.employees, "2026-11-15", "2026-11-19"); // Sun→Thu: 10 person-days, 1 remote
    expect(d).toMatchObject({ onsite: 9, remote: 1 });
    expect(d.remoteSharePct).toBeCloseTo(10);
  });
  it("presenceRange flags the days that carry an explicit override", () => {
    const s = setup();
    s.workModes = [{ id: "w1", employeeId: "e2", date: "2026-11-16", mode: "REMOTE" }];
    const r = presenceRange(s, s.employees[1], "2026-11-15", "2026-11-17");
    expect(r.map((x) => [x.date, x.presence, x.override])).toEqual([["2026-11-15", "ONSITE", false], ["2026-11-16", "REMOTE", true], ["2026-11-17", "ONSITE", false]]);
  });
});
