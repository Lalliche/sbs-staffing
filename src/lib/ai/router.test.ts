import { describe, expect, it } from "vitest";
import { buildSeed } from "../store/seed";
import { answer } from "./router";
import { availableCountByGrade } from "../engine/forecast";
import { applyCvAnalysis, simulateCvParse } from "../store/actions/ai";

const as = (u: string) => { const s = buildSeed(2); s.session.userId = u; return s; };

describe("SBS Staffing Intelligence (deterministic)", () => {
  it("answers « Combien de Seniors seront disponibles en janvier ? » from the engine, with its source", () => {
    const s = as("u-yacine");
    const a = answer(s, "Combien de Seniors seront disponibles en janvier ?");
    expect(a.intent).toBe("availability_grade");
    expect(a.kind).toBe("answer");
    expect(a.figures[0].raw).toBe(availableCountByGrade(s, "g-3", "2027-01-01", "2027-01-31", 50));
    expect(a.source).toMatch(/Basé sur 40 collaborateurs/);
    expect(a.title).toMatch(/janvier 2027/);
  });
  it("runs the real matching engine for a staffing request and never assigns", () => {
    const s = as("u-amine");
    const a = answer(s, "Trouve les meilleurs consultants pour une mission d’audit dans le secteur bancaire");
    expect(a.intent).toBe("staffing");
    expect(a.table!.rows.length).toBeGreaterThan(0);
    expect(a.assumptions!.join(" ")).toMatch(/Secteur : Banque/);
    const before = s.assignments.length;
    answer(s, "Affecte Sofiane Djebbar à la mission");
    expect(s.assignments.length).toBe(before);
    expect(answer(s, "Affecte Sofiane Djebbar à la mission").kind).toBe("refusal");
  });
  it("executive Q&A: overloaded department, unstaffed missions, utilization, skills gap", () => {
    const s = as("u-yacine");
    expect(answer(s, "Quel département est le plus surchargé ?").intent).toBe("overloaded_dept");
    const u = answer(s, "Quel est le taux d’utilisation ?");
    expect(u.intent).toBe("utilization");
    expect(u.figures.map((f) => f.label).join()).toMatch(/Planifiée/);
    expect(u.figures.map((f) => f.label).join()).not.toMatch(/Réelle|Facturabilité/);
    expect(answer(s, "Quelles missions ne sont pas staffées ?").figures[0].raw ?? answer(s, "Quelles missions ne sont pas staffées ?").figures[0].value).toBeTruthy();
    expect(answer(s, "Quelles compétences sont insuffisantes ?").intent).toBe("skills_gap");
  });
  it("answers who is on site or remote today from the presence selector, and respects scope and permission", () => {
    const s = as("u-amine");
    const a = answer(s, "Qui est sur site aujourd’hui ?");
    expect(a.kind).toBe("answer");
    expect(a.intent).toBe("presence");
    const raw = Object.fromEntries(a.figures.map((f) => [f.label, f.raw]));
    expect(Number(raw["Présentiel"]) + Number(raw["À distance"]) + Number(raw["Absents"])).toBeGreaterThan(0);
    expect(a.source).toMatch(/Basé sur/);
    expect(answer(s, "Qui travaille à distance ?").intent).toBe("presence");
    s.rolePermissions.RESOURCE_MANAGER = s.rolePermissions.RESOURCE_MANAGER.filter((p) => p !== "workmode.view");
    expect(answer(s, "Qui est sur site aujourd’hui ?").kind).toBe("refusal");
  });
  it("respects RBAC: a Collaborateur gets a polite refusal for company data and costs", () => {
    const s = as("u-lucas");
    expect(answer(s, "Quel département est le plus surchargé ?").kind).toBe("refusal");
    expect(answer(s, "Quels sont les coûts par grade ?").kind).toBe("refusal");
    expect(answer(as("u-amine"), "Quels sont les coûts par grade ?").kind).toBe("refusal"); // Resource Manager has no cost permission by default
    expect(answer(as("u-yacine"), "Quels sont les coûts par grade ?").kind).toBe("answer");
  });
  it("is honest when it does not know", () => {
    const a = answer(as("u-yacine"), "Quelle est la météo à Oran ?");
    expect(a.kind).toBe("unknown");
    expect(a.suggestions!.length).toBeGreaterThan(3);
  });
  it("CV analysis is deterministic and writes only through the audited action", () => {
    const s = as("u-sophie");
    const cv = simulateCvParse("cv-anis.pdf", 1200);
    expect(simulateCvParse("cv-anis.pdf", 1200)).toEqual(cv);
    const before = s.employeeSkills.length;
    const nAudit = s.audit.length;
    expect(s.employeeSkills.length).toBe(before);
    const r = applyCvAnalysis(s, "e13", cv);
    expect(r.ok).toBe(true);
    expect(s.audit.length).toBe(nAudit + 1);
    expect(s.audit[0].action).toBe("ai.cv.apply");
    const c = as("u-claire");
    expect(applyCvAnalysis(c, "e13", cv).ok).toBe(false);
  });
});
