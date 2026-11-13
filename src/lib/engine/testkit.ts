/* Tiny fixtures for engine tests. Calendar: Sunday→Thursday, weeks start Sunday.
   2026-11-15 is a Sunday. */
import { blankState } from "../store/blank";
import type { AppState, Assignment, Employee, LeaveRequest, Project, StaffingRequirement } from "../store/types";

export function baseState(): AppState {
  const s = blankState();
  s.now = "2026-11-15";
  s.offices = [{ id: "o1", name: "Alger", city: "Alger", workingWeekdays: [0, 1, 2, 3, 4] }];
  s.departments = [{ id: "d1", name: "Audit", code: "AUD" }];
  s.grades = [
    { id: "g-1", name: "Junior", rank: 1 },
    { id: "g-2", name: "Consultant", rank: 2 },
    { id: "g-3", name: "Senior", rank: 3 },
    { id: "g-4", name: "Manager", rank: 4 },
    { id: "g-5", name: "Partner", rank: 5 },
  ];
  s.skillCategories = [{ id: "c1", name: "Audit" }];
  s.skills = [
    { id: "sk-audit", name: "Audit financier", categoryId: "c1", description: "", expectedLevel: 3, certificationIds: ["ce-ifrs"], active: true },
    { id: "sk-ifrs", name: "Normes IFRS", categoryId: "c1", description: "", expectedLevel: 2, certificationIds: [], active: true },
    { id: "sk-bi", name: "Visualisation", categoryId: "c1", description: "", expectedLevel: 2, certificationIds: [], active: true },
  ];
  s.certifications = [{ id: "ce-ifrs", name: "Certificat IFRS", issuer: "Organisme (fictif)", validityMonths: 36 }];
  return s;
}

export function emp(over: Partial<Employee> & { id: string }): Employee {
  return {
    matricule: over.id.toUpperCase(),
    firstName: over.id,
    lastName: "Test",
    email: `${over.id}@example.test`,
    phone: "",
    jobTitle: "Consultant",
    gradeId: "g-3",
    departmentId: "d1",
    officeId: "o1",
    managerId: null,
    contract: "CDI",
    weeklyHours: 40,
    startDate: "2020-01-01",
    status: "ACTIF",
    bio: "",
    yearsExperience: 6,
    sectors: ["Banque & assurance"],
    languages: ["Français"],
    diplomas: [],
    dailyCost: 40000,
    ...over,
  };
}
export function assignment(over: Partial<Assignment> & { id: string; employeeId: string }): Assignment {
  return { projectId: "p1", startDate: "2026-11-15", endDate: "2026-11-26", allocationPct: 50, plannedHours: 0, status: "HARD", createdAt: "2026-11-01", ...over };
}
export function leave(over: Partial<LeaveRequest> & { id: string; employeeId: string }): LeaveRequest {
  return { type: "CONGE_ANNUEL", startDate: "2026-11-15", endDate: "2026-11-19", status: "APPROUVEE", createdAt: "2026-10-01", ...over };
}
export function project(over: Partial<Project> & { id: string }): Project {
  return {
    reference: `REF-${over.id}`, otp: `OTP-${over.id}`, name: over.id, clientId: "cl1", description: "", departmentId: "d1", leadId: "e-lead", type: "AUDIT_LEGAL", priority: "NORMALE",
    startDate: "2026-11-15", endDate: "2027-02-28", estimatedDays: 100, budget: 0, currency: "DZD", resourceBudget: 0, estimatedDailyCost: 0, certainty: "CONFIRMEE",
    status: "ACTIVE", phases: [], milestones: [], sector: "Banque & assurance", ...over,
  };
}
export function requirement(over: Partial<StaffingRequirement> & { id: string }): StaffingRequirement {
  return { projectId: "p1", gradeMin: "g-3", quantity: 1, mandatorySkillIds: [], desiredSkillIds: [], minExperienceYears: 0, startDate: "2026-12-01", endDate: "2027-02-25", allocationPct: 100, priority: "NORMALE", ...over };
}
