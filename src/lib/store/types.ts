/* SBS Staffing — data model (spec §6). Single source of truth for every module.
   Dates are ISO strings "YYYY-MM-DD" (UTC calendar days, never Date.now(): the demo clock is `state.now`). */

export type ISODate = string;
export type Scenario = 1 | 2 | 3 | 4;

export type Role = "SUPER_ADMIN" | "ADMIN" | "DIRECTION" | "PARTNER" | "RESOURCE_MANAGER" | "MANAGER" | "RH" | "COLLABORATEUR";
export type SkillLevel = 1 | 2 | 3 | 4; // Débutant · Intermédiaire · Avancé · Expert
export type Certainty = "CONFIRMEE" | "PROBABLE" | "OPPORTUNITE";
export type Priority = "BASSE" | "NORMALE" | "HAUTE" | "URGENTE";

/* ---------- Referentials ---------- */
export interface Department {
  id: string;
  name: string;
  code: string;
}
export interface Office {
  id: string;
  name: string;
  city: string;
  /** 0 = Sunday … 6 = Saturday. Algerian offices work Sunday→Thursday. */
  workingWeekdays: number[];
}
export interface Grade {
  id: string;
  name: string;
  /** 1 (Junior) … 5 (Partner). Comparisons use rank. */
  rank: number;
}
export interface SkillCategory {
  id: string;
  name: string;
}
export interface Skill {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  expectedLevel: SkillLevel;
  certificationIds: string[];
  active: boolean;
}
export interface Certification {
  id: string;
  name: string;
  issuer: string;
  validityMonths: number;
}
export interface Holiday {
  id: string;
  date: ISODate;
  name: string;
  /** null = every office */
  officeId: string | null;
}

/* ---------- People ---------- */
export type Contract = "CDI" | "CDD" | "STAGE" | "CONSULTANT";
export type EmployeeStatus = "ACTIF" | "ARCHIVE" | "CONGE_LONG";

export interface Employee {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  jobTitle: string;
  gradeId: string;
  departmentId: string;
  officeId: string;
  managerId: string | null;
  contract: Contract;
  weeklyHours: number;
  /** Part-time: days actually worked (defaults to the office calendar). */
  workingWeekdays?: number[];
  /** Weekdays (0 = Sunday … 6 = Saturday) usually worked remotely (« à distance »); other working days are on site. */
  remoteWeekdays?: number[];
  startDate: ISODate;
  endDate?: ISODate;
  status: EmployeeStatus;
  archivedAt?: ISODate;
  archiveReason?: string;
  bio: string;
  yearsExperience: number;
  sectors: string[];
  languages: string[];
  diplomas: string[];
  /** RESTRICTED — stripped by selectors unless `employee.salary.read`. */
  dailyCost: number;
  /** RESTRICTED */
  dailyRate?: number;
}
export interface EmployeeSkill {
  employeeId: string;
  skillId: string;
  /** Manager-validated level when validatedById is set, otherwise declared. */
  level: SkillLevel;
  selfLevel?: SkillLevel;
  validatedById?: string;
  validatedAt?: ISODate;
  updatedAt: ISODate;
  evidence?: string;
  experienceNote?: string;
}
export interface EmployeeCertification {
  employeeId: string;
  certificationId: string;
  obtainedAt: ISODate;
  expiresAt: ISODate;
}

/* ---------- Clients & missions ---------- */
export interface Client {
  id: string;
  name: string;
  sector: string;
  city: string;
}
export type ProjectStatus = "EN_ATTENTE_STAFFING" | "A_VENIR" | "ACTIVE" | "TERMINEE" | "ANNULEE";
export interface ProjectPhase {
  id: string;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
}
export interface Milestone {
  id: string;
  name: string;
  date: ISODate;
  done: boolean;
}
export interface Project {
  id: string;
  reference: string; // unique
  otp: string; // OTP number — shared key with SBS 360°
  name: string;
  clientId: string;
  description: string;
  departmentId: string;
  leadId: string; // employee id (responsable de mission)
  createdById?: string;
  type: string;
  priority: Priority;
  startDate: ISODate;
  endDate: ISODate;
  estimatedDays: number;
  budget: number; // RESTRICTED (finance)
  currency: "DZD";
  resourceBudget: number; // RESTRICTED
  estimatedDailyCost: number; // RESTRICTED
  dailySellPrice?: number; // RESTRICTED
  certainty: Certainty;
  status: ProjectStatus;
  phases: ProjectPhase[];
  milestones: Milestone[];
  sector: string;
}
export interface StaffingRequirement {
  id: string;
  projectId: string;
  gradeMin: string; // grade id (minimum)
  quantity: number;
  mandatorySkillIds: string[];
  desiredSkillIds: string[];
  minExperienceYears: number;
  startDate: ISODate;
  endDate: ISODate;
  allocationPct: number;
  priority: Priority;
  /** Mission requires full-time presence → part-timers are incompatible (spec 7.4d). */
  fullTime?: boolean;
}

/* ---------- Assignments ---------- */
export type AssignmentStatus = "SOFT" | "HARD" | "ANNULEE" | "TERMINEE";
export interface Assignment {
  id: string;
  employeeId: string;
  projectId: string;
  requirementId?: string;
  startDate: ISODate;
  endDate: ISODate;
  allocationPct: number;
  /** Derived, stored for display & export; recomputed by actions. */
  plannedHours: number;
  status: AssignmentStatus;
  validatedById?: string;
  softExpiresAt?: ISODate;
  exceptionReason?: string;
  createdAt: ISODate;
  fullTime?: boolean;
  replacedAssignmentId?: string;
}

/* ---------- Requests ---------- */
export type RequestStatus =
  | "BROUILLON"
  | "SOUMISE"
  | "EN_ANALYSE"
  | "PROPOSITION_ENVOYEE"
  | "EN_ATTENTE_VALIDATION"
  | "APPROUVEE"
  | "REJETEE"
  | "ANNULEE"
  | "SATISFAITE";
export interface RequestComment {
  id: string;
  authorId: string;
  ts: ISODate;
  text: string;
}
export interface StaffingRequest {
  id: string;
  reference: string;
  projectId: string;
  requirementId?: string;
  requesterId: string; // employee id
  gradeId: string;
  quantity: number;
  skillIds: string[];
  startDate: ISODate;
  endDate: ISODate;
  allocationPct: number;
  estimatedLoad: number; // person-days
  priority: Priority;
  justification: string;
  status: RequestStatus;
  proposedEmployeeIds: string[];
  handledById?: string;
  createdAt: ISODate;
  comments: RequestComment[];
  history: { ts: ISODate; actorId: string; status: RequestStatus; note?: string }[];
}

/* ---------- Absences (read-only: the leave workflow was removed from the product) ---------- */
export type LeaveType = "CONGE_ANNUEL" | "MALADIE" | "FORMATION" | "DEPLACEMENT" | "MISSION_INTERNE" | "EXCEPTIONNEL" | "TEMPS_PARTIEL";
export type LeaveStatus = "BROUILLON" | "SOUMISE" | "APPROUVEE" | "REFUSEE";
export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: ISODate;
  endDate: ISODate;
  status: LeaveStatus;
  approverId?: string;
  comment?: string;
  createdAt: ISODate;
}

/* ---------- Work mode (présentiel / à distance) ---------- */
export type WorkMode = "ONSITE" | "REMOTE";
/** One-off override of the usual pattern for a given day. */
export interface WorkModeEntry {
  id: string;
  employeeId: string;
  date: ISODate;
  mode: WorkMode;
  /** Who recorded it (user id) — shown in the audit trail. */
  setById?: string;
}

/* ---------- Notifications, documents, audit ---------- */
export type NotificationKind =
  | "REQUEST"
  | "ASSIGNMENT"
  | "MISSION"
  | "CONFLICT"
  | "OVERLOAD"
  | "CERTIFICATION"
  | "UNSTAFFED"
  | "SYSTEM";
export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: ISODate;
  read: boolean;
  /** Also written to the e-mail log (simulated delivery). */
  email?: boolean;
}
export interface DocumentMeta {
  id: string;
  entity: "PROJECT" | "EMPLOYEE";
  entityId: string;
  name: string;
  kind: string;
  sizeKb: number;
  uploadedById: string;
  createdAt: ISODate;
}
export interface AuditLog {
  id: string;
  ts: ISODate;
  seq: number;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  label?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}
export interface EmailLog {
  id: string;
  ts: ISODate;
  toUserId: string;
  subject: string;
}

/* ---------- Forecast pipeline (spec 7.8) ---------- */
export interface PipelineNeed {
  gradeId: string;
  quantity: number;
  skillIds: string[];
  allocationPct: number;
}
export interface PipelineItem {
  id: string;
  name: string;
  clientLabel: string;
  departmentId: string;
  sector: string;
  certainty: Certainty;
  startDate: ISODate;
  endDate: ISODate;
  needs: PipelineNeed[];
}

/* ---------- Settings & permissions ---------- */
export interface Settings {
  scoringWeights: { skills: number; availability: number; sector: number; grade: number; certifications: number; history: number };
  blocking: { missingMandatorySkill: boolean; gradeBelowMinimum: boolean; unavailable: boolean };
  /** Below this availability ratio (0..1) a candidate is "unavailable" (blocking). */
  minAvailabilityRatio: number;
  utilizationTargets: { byGrade: Record<string, number>; byDepartment: Record<string, number> };
  thresholds: { underUse: number; overload: number };
  forecastWeights: Record<Certainty, number>;
  softBookingExpiryDays: number;
  /** Approved/pending leave of at least this many working days inside an assignment is reported as a plan conflict. */
  longAbsenceDays: number;
  standardWeeklyHours: number;
  includeSoftInUtilization: boolean;
  timezone: string;
  currency: "DZD";
  language: "fr";
  skillLevelLabels: [string, string, string, string];
  ai: { provider: string; apiKeyMasked: string; enabled: boolean };
}
export type RolePermissions = Record<Role, string[]>;

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  /** Linked employee record (null for the technical super admin). */
  employeeId: string | null;
  status: "ACTIF" | "DESACTIVE";
  lastLoginAt?: ISODate;
}
export interface NotificationPrefs {
  [kind: string]: { inApp: boolean; email: boolean };
}

export interface AppState {
  v: number;
  scenario: Scenario;
  /** Demo clock (ISO date). */
  now: ISODate;
  session: { userId: string | null };
  tourSeen: Record<string, boolean>;

  departments: Department[];
  offices: Office[];
  grades: Grade[];
  skillCategories: SkillCategory[];
  skills: Skill[];
  certifications: Certification[];
  holidays: Holiday[];

  users: User[];
  employees: Employee[];
  employeeSkills: EmployeeSkill[];
  employeeCertifications: EmployeeCertification[];

  clients: Client[];
  projects: Project[];
  requirements: StaffingRequirement[];
  requests: StaffingRequest[];
  assignments: Assignment[];
  /** Absences (approved leave, training, travel) — read-only data that feeds planning, capacity and matching. */
  leaves: LeaveRequest[];
  workModes: WorkModeEntry[];
  pipeline: PipelineItem[];

  notifications: Notification[];
  emailLog: EmailLog[];
  notificationPrefs: Record<string, NotificationPrefs>;
  documents: DocumentMeta[];
  audit: AuditLog[];
  auditSeq: number;

  settings: Settings;
  rolePermissions: RolePermissions;
  /** Counter for deterministic ids created at runtime. */
  idSeq: number;
}
