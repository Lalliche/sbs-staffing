import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed";
import { cancelAssignment, convertToHard, createAssignment, replaceAssignment, updateAssignment } from "./assignments";
import { setUsualRemoteDays, setWorkMode } from "./workmode";
import { presenceOn } from "../../engine/workmode";
import { advanceTime, refreshStatuses } from "./time";
import { utilizationOf } from "../../engine/utilization";
import { availableHours } from "../../engine/capacity";
import { UNSTAFFED_PROJECT } from "../seed/missions";
import type { AppState } from "../types";

const as = (id: string): AppState => {
  const s = buildSeed(2);
  s.session.userId = id;
  return s;
};
const book = (employeeId: string, status: "SOFT" | "HARD" = "HARD", extra = {}) => ({ employeeId, projectId: UNSTAFFED_PROJECT, requirementId: "rq-04-1", startDate: "2026-12-01", endDate: "2027-01-28", allocationPct: 60, status, ...extra });

describe("assignment actions (demo script A)", () => {
  it("hard-booking the best candidate updates availability and utilization, and writes an audit row", () => {
    const s = as("u-amine");
    const emp = s.employees.find((e) => e.id === "e16")!;
    const before = availableHours(s, emp, "2026-12-01", "2027-01-28");
    const u0 = utilizationOf(s, emp, "2026-12-01", "2026-12-31").planned;
    const nAudit = s.audit.length;
    const r = createAssignment(s, book("e16"));
    expect(r.ok).toBe(true);
    expect(availableHours(s, emp, "2026-12-01", "2027-01-28")).toBeLessThan(before);
    expect(utilizationOf(s, emp, "2026-12-01", "2026-12-31").planned).toBeGreaterThan(u0);
    expect(s.audit.length).toBeGreaterThanOrEqual(nAudit + 1);
    expect(s.audit.find((a) => a.action === "assignment.create" && a.actorId === "u-amine")).toBeTruthy();
    expect(s.audit.find((a) => a.action === "assignment.create")).toMatchObject({ entity: "Affectation" });
    expect(s.projects.find((p) => p.id === UNSTAFFED_PROJECT)!.status).toBe("EN_ATTENTE_STAFFING"); // consultant seat still open
  });
  it("soft booking is reserved but not counted in capacity, expires after N days and can be converted", () => {
    const s = as("u-amine");
    const emp = s.employees.find((e) => e.id === "e16")!;
    const before = availableHours(s, emp, "2026-12-01", "2027-01-28");
    const r = createAssignment(s, book("e16", "SOFT"));
    if (!r.ok) throw new Error(r.error);
    expect(r.value.softExpiresAt).toBe("2026-11-22");
    expect(availableHours(s, emp, "2026-12-01", "2027-01-28")).toBe(before);
    expect(convertToHard(s, r.value.id).ok).toBe(true);
    expect(availableHours(s, emp, "2026-12-01", "2027-01-28")).toBeLessThan(before);
    expect(s.assignments.find((a) => a.id === r.value.id)!.softExpiresAt).toBeUndefined();
    // a second reservation is never confirmed → it lapses after 7 days
    const s2 = as("u-amine");
    const r2 = createAssignment(s2, book("e16", "SOFT"));
    expect(r2.ok).toBe(true);
    advanceTime(s2, 8);
    expect(s2.assignments.find((a) => a.id === (r2 as { value: { id: string } }).value.id)!.status).toBe("ANNULEE");
    expect(s2.audit.some((a) => a.action === "assignment.softexpire")).toBe(true);
  });
  it("a blocked candidate (missing mandatory skill) cannot be assigned without a written exception", () => {
    const s = as("u-amine");
    const r = createAssignment(s, book("e07"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("NEEDS_EXCEPTION");
      expect(r.blocks?.some((b) => b.kind === "MISSING_MANDATORY_SKILL")).toBe(true);
    }
    const short = createAssignment(s, book("e07", "HARD", { exceptionReason: "court" }));
    expect(short.ok).toBe(false);
    const ok = createAssignment(s, book("e07", "HARD", { exceptionReason: "Seule ressource disponible, supervision renforcée par le Manager." }));
    expect(ok.ok).toBe(true);
    expect(s.audit.find((a) => a.action === "assignment.exception" && a.reason?.startsWith("Seule ressource"))).toBeTruthy();
  });
  it("conflict: Claire (60 % on mission A) asked 60 % on B → exception flow; only habilitated roles may authorise", () => {
    const s = as("u-amine");
    const r = createAssignment(s, book("e04"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.conflicts?.some((c) => c.kind === "OVERALLOCATION")).toBe(true);
    // a Manager can soft-book but has no exception right
    const m = as("u-thomas");
    const r2 = createAssignment(m, book("e04", "SOFT", { exceptionReason: "Je prends la responsabilité de ce dépassement." }));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.code).toBe("FORBIDDEN");
    const rm = createAssignment(s, book("e04", "HARD", { exceptionReason: "Priorité client confirmée par la direction générale." }));
    expect(rm.ok).toBe(true);
  });
  it("RBAC on actions: a collaborateur and RH cannot assign; a manager cannot hard-book", () => {
    for (const u of ["u-claire", "u-sophie", "u-thomas"]) {
      const s = as(u);
      const r = createAssignment(s, book("e16"));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe("FORBIDDEN");
    }
  });
  it("moving an assignment (drag) is validated by the engine; shrinking the percentage resolves the conflict", () => {
    const s = as("u-amine");
    const a = s.assignments.find((x) => x.employeeId === "e04" && x.projectId === "p-01")!;
    const r = updateAssignment(s, a.id, { allocationPct: 100 });
    expect(r.ok).toBe(true); // 100 % alone is fine
    const c = createAssignment(s, book("e16"));
    expect(c.ok).toBe(true);
    if (c.ok) {
      const bad = updateAssignment(s, c.value.id, { employeeId: "e04" });
      expect(bad.ok).toBe(false);
    }
  });
  it("cancel and replace keep history and re-open the requirement", () => {
    const s = as("u-amine");
    const c = createAssignment(s, book("e16"));
    if (!c.ok) throw new Error(c.error);
    // Rania has an approved long leave in the period → needs an exception; the original must be untouched on failure
    const rep = replaceAssignment(s, c.value.id, "e05");
    expect(rep.ok).toBe(false);
    if (!rep.ok) expect(rep.code).toBe("NEEDS_EXCEPTION");
    expect(s.assignments.find((a) => a.id === c.value.id)!.status).toBe("HARD");
    expect(cancelAssignment(s, c.value.id, "Besoin annulé").ok).toBe(true);
    expect(s.assignments.find((a) => a.id === c.value.id)!.status).toBe("ANNULEE");
    expect(s.audit[0].action).toBe("assignment.cancel");
    // with a written reason the replacement goes through and links the old booking
    const c2 = createAssignment(s, book("e16"));
    if (!c2.ok) throw new Error(c2.error);
    const ok = replaceAssignment(s, c2.value.id, "e05", "Disponibilité supérieure de la personne proposée.");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.replacedAssignmentId).toBe(c2.value.id);
    expect(s.assignments.find((a) => a.id === c2.value.id)!.status).toBe("ANNULEE");
  });
});

describe("work-mode actions", () => {
  const e = (s: AppState, id: string) => s.employees.find((x) => x.id === id)!;
  it("a resource manager sets a day remote, the engine reflects it and an audit row is written", () => {
    const s = as("u-amine");
    const before = presenceOn(s, e(s, "e16"), "2026-11-17");
    const mode = before === "REMOTE" ? "ONSITE" : "REMOTE";
    const nAudit = s.audit.length;
    const r = setWorkMode(s, { employeeId: "e16", dates: ["2026-11-17"], mode });
    expect(r.ok).toBe(true);
    expect(presenceOn(s, e(s, "e16"), "2026-11-17")).toBe(mode);
    expect(s.audit.length).toBeGreaterThan(nAudit);
    expect(s.audit.find((a) => a.action === "workmode.set")).toMatchObject({ entity: "Présence", entityId: "e16", actorId: "u-amine" });
  });
  it("setting the usual mode clears the override instead of storing a redundant row", () => {
    const s = as("u-amine");
    const usual = presenceOn(s, e(s, "e16"), "2026-11-22"); // a Sunday-week day with no seeded override
    const other = usual === "REMOTE" ? "ONSITE" : "REMOTE";
    expect(setWorkMode(s, { employeeId: "e16", dates: ["2026-11-22"], mode: other }).ok).toBe(true);
    const n = s.workModes.length;
    expect(setWorkMode(s, { employeeId: "e16", dates: ["2026-11-22"], mode: usual as "ONSITE" | "REMOTE" }).ok).toBe(true);
    expect(s.workModes.length).toBe(n - 1);
    expect(presenceOn(s, e(s, "e16"), "2026-11-22")).toBe(usual);
  });
  it("weekends and empty selections are rejected; archived people cannot be changed", () => {
    const s = as("u-amine");
    expect(setWorkMode(s, { employeeId: "e16", dates: ["2026-11-20"], mode: "REMOTE" })).toMatchObject({ ok: false, code: "INVALID" }); // Friday
    expect(setWorkMode(s, { employeeId: "e16", dates: [], mode: "REMOTE" })).toMatchObject({ ok: false, code: "INVALID" });
    e(s, "e16").status = "ARCHIVE";
    expect(setWorkMode(s, { employeeId: "e16", dates: ["2026-11-17"], mode: "REMOTE" })).toMatchObject({ ok: false, code: "INVALID" });
  });
  it("RBAC: a collaborateur changes only their own presence; the direction cannot change anyone's", () => {
    const s = as("u-claire"); // Claire = e04
    expect(setWorkMode(s, { employeeId: "e04", dates: ["2026-11-17"], mode: "REMOTE" }).ok).toBe(true);
    expect(setWorkMode(s, { employeeId: "e16", dates: ["2026-11-17"], mode: "REMOTE" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
    const d = as("u-yacine");
    expect(setWorkMode(d, { employeeId: "e16", dates: ["2026-11-17"], mode: "REMOTE" })).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });
  it("the usual pattern can be edited but at least one day stays on site", () => {
    const s = as("u-amine");
    expect(setUsualRemoteDays(s, { employeeId: "e16", weekdays: [1, 3] }).ok).toBe(true);
    expect(e(s, "e16").remoteWeekdays).toEqual([1, 3]);
    expect(setUsualRemoteDays(s, { employeeId: "e16", weekdays: [0, 1, 2, 3, 4] })).toMatchObject({ ok: false, code: "INVALID" });
    expect(s.audit.find((a) => a.action === "workmode.pattern")).toBeTruthy();
  });
});

describe("demo clock", () => {
  it("advancing time expires soft bookings, completes missions and notifies", () => {
    const s = as("u-amine");
    const n = s.notifications.length;
    const sum = advanceTime(s, 7);
    expect(s.now).toBe("2026-11-22");
    expect(sum.expiredSoft).toBeGreaterThanOrEqual(1); // Meriem's reservation expired on 20 Nov
    expect(s.notifications.length).toBeGreaterThan(n);
    advanceTime(s, 40);
    expect(s.projects.find((p) => p.id === "p-11")!.status).toBe("TERMINEE"); // due diligence ended on 23 Dec
  });
  it("refreshStatuses is idempotent", () => {
    const s = as("u-amine");
    refreshStatuses(s);
    const a = JSON.stringify(s.projects);
    refreshStatuses(s);
    expect(JSON.stringify(s.projects)).toBe(a);
  });
});
