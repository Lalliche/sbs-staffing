import { DEFAULT_ROLE_PERMISSIONS } from "../engine/permissions";
import type { AppState, Settings } from "./types";

export const STATE_VERSION = 3;

export const defaultSettings = (): Settings => ({
  scoringWeights: { skills: 30, availability: 25, sector: 15, grade: 15, certifications: 10, history: 5 },
  blocking: { missingMandatorySkill: true, gradeBelowMinimum: true, unavailable: true },
  minAvailabilityRatio: 0.5,
  utilizationTargets: { byGrade: { "g-1": 80, "g-2": 80, "g-3": 78, "g-4": 60, "g-5": 25 }, byDepartment: {} },
  thresholds: { underUse: 60, overload: 100 },
  forecastWeights: { CONFIRMEE: 100, PROBABLE: 60, OPPORTUNITE: 25 },
  softBookingExpiryDays: 7,
  maxDailyHours: 10,
  maxWeeklyHours: 48,
  longAbsenceDays: 15,
  standardWeeklyHours: 40,
  includeSoftInUtilization: false,
  timezone: "Africa/Algiers",
  currency: "DZD",
  language: "fr",
  skillLevelLabels: ["Débutant", "Intermédiaire", "Avancé", "Expert"],
  ai: { provider: "", apiKeyMasked: "", enabled: false },
});

/** Empty but structurally complete state (used by the seed and by the unit tests). */
export function blankState(): AppState {
  return {
    v: STATE_VERSION,
    scenario: 2,
    now: "2026-11-15",
    session: { userId: null },
    tourSeen: {},
    departments: [],
    offices: [],
    grades: [],
    skillCategories: [],
    skills: [],
    certifications: [],
    holidays: [],
    users: [],
    employees: [],
    employeeSkills: [],
    employeeCertifications: [],
    clients: [],
    projects: [],
    requirements: [],
    requests: [],
    assignments: [],
    leaves: [],
    timesheets: [],
    entries: [],
    evaluations: [],
    opportunities: [],
    applications: [],
    pipeline: [],
    notifications: [],
    emailLog: [],
    notificationPrefs: {},
    documents: [],
    audit: [],
    auditSeq: 0,
    settings: defaultSettings(),
    rolePermissions: structuredClone(DEFAULT_ROLE_PERMISSIONS),
    idSeq: 1000,
  };
}
