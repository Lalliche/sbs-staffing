/* RBAC (spec 3). `can()` is the single gate used by routes, menus, buttons, actions AND selectors.
   The role → permission matrix lives in the store (state.rolePermissions) and is editable. */
import type { AppState, Role, RolePermissions, User } from "../store/types";

export interface PermissionDef {
  key: string;
  label: string;
  group: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { key: "dashboard.view", label: "Voir le tableau de bord", group: "Tableau de bord" },
  { key: "dashboard.executive", label: "Vue exécutive consolidée", group: "Tableau de bord" },
  { key: "planning.view", label: "Voir le planning", group: "Staffing & Planning" },
  { key: "planning.edit", label: "Modifier le planning (glisser-déposer)", group: "Staffing & Planning" },
  { key: "assignment.create", label: "Affecter un collaborateur", group: "Affectations" },
  { key: "assignment.softbook", label: "Réserver (soft booking)", group: "Affectations" },
  { key: "assignment.edit", label: "Modifier une affectation", group: "Affectations" },
  { key: "assignment.cancel", label: "Annuler une affectation", group: "Affectations" },
  { key: "assignment.exception", label: "Autoriser une exception de conflit", group: "Affectations" },
  { key: "project.view", label: "Voir les missions", group: "Missions" },
  { key: "project.create", label: "Créer une mission", group: "Missions" },
  { key: "project.edit", label: "Modifier une mission", group: "Missions" },
  { key: "project.finance.read", label: "Voir budget et coûts des missions", group: "Missions" },
  { key: "employee.view", label: "Voir les collaborateurs", group: "Collaborateurs" },
  { key: "employee.create", label: "Créer / modifier un collaborateur", group: "Collaborateurs" },
  { key: "employee.archive", label: "Archiver / restaurer", group: "Collaborateurs" },
  { key: "employee.import", label: "Importer des collaborateurs", group: "Collaborateurs" },
  { key: "employee.salary.read", label: "Voir coûts journaliers et tarifs", group: "Collaborateurs" },
  { key: "skill.view", label: "Voir les compétences", group: "Compétences" },
  { key: "skill.search", label: "Recherche avancée / matrice", group: "Compétences" },
  { key: "skill.validate", label: "Valider le niveau d'une compétence", group: "Compétences" },
  { key: "skill.edit", label: "Gérer le référentiel de compétences", group: "Compétences" },
  { key: "availability.view", label: "Voir disponibilités et absences", group: "Disponibilités" },
  { key: "leave.request", label: "Demander un congé", group: "Disponibilités" },
  { key: "leave.approve", label: "Approuver / refuser un congé", group: "Disponibilités" },
  { key: "request.view", label: "Voir les demandes de staffing", group: "Demandes de staffing" },
  { key: "request.create", label: "Créer une demande de staffing", group: "Demandes de staffing" },
  { key: "request.process", label: "Traiter la file des demandes", group: "Demandes de staffing" },
  { key: "request.approve", label: "Approuver une proposition", group: "Demandes de staffing" },
  { key: "timesheet.own", label: "Saisir mes timesheets", group: "Timesheets" },
  { key: "timesheet.view", label: "Voir les timesheets", group: "Timesheets" },
  { key: "timesheet.validate", label: "Valider les timesheets de l'équipe", group: "Timesheets" },
  { key: "timesheet.correct", label: "Ouvrir une correction tracée", group: "Timesheets" },
  { key: "capacity.view", label: "Voir la planification de capacité", group: "Capacité" },
  { key: "capacity.whatif", label: "Simulations « what-if »", group: "Capacité" },
  { key: "marketplace.view", label: "Voir la marketplace", group: "Marketplace" },
  { key: "marketplace.publish", label: "Publier une opportunité", group: "Marketplace" },
  { key: "marketplace.apply", label: "Postuler à une opportunité", group: "Marketplace" },
  { key: "marketplace.review", label: "Examiner les candidatures", group: "Marketplace" },
  { key: "evaluation.view", label: "Voir les évaluations", group: "Évaluations" },
  { key: "evaluation.create", label: "Évaluer en fin de mission", group: "Évaluations" },
  { key: "evaluation.confidential.read", label: "Lire les évaluations confidentielles", group: "Évaluations" },
  { key: "analytics.view", label: "Voir analytics et rapports", group: "Analytics" },
  { key: "analytics.cost", label: "Rapports de coûts et rentabilité", group: "Analytics" },
  { key: "analytics.export", label: "Exporter (CSV / Excel / PDF)", group: "Analytics" },
  { key: "ai.use", label: "Utiliser SBS Staffing Intelligence", group: "Intelligence" },
  { key: "ai.settings", label: "Configurer le fournisseur d'IA", group: "Intelligence" },
  { key: "notification.view", label: "Centre de notifications", group: "Notifications" },
  { key: "admin.view", label: "Accéder à l'administration", group: "Administration" },
  { key: "admin.users", label: "Gérer les utilisateurs", group: "Administration" },
  { key: "admin.roles", label: "Éditer rôles et permissions", group: "Administration" },
  { key: "admin.referentials", label: "Gérer les référentiels", group: "Administration" },
  { key: "admin.settings", label: "Règles de staffing et paramètres", group: "Administration" },
  { key: "admin.audit", label: "Consulter le journal d'audit", group: "Administration" },
  { key: "admin.data", label: "Données (import / export / réinitialisation)", group: "Administration" },
];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super administrateur",
  ADMIN: "Administrateur",
  DIRECTION: "Direction",
  PARTNER: "Partner",
  RESOURCE_MANAGER: "Resource Manager",
  MANAGER: "Manager",
  RH: "Ressources humaines",
  COLLABORATEUR: "Collaborateur",
};
export const ROLES = Object.keys(ROLE_LABEL) as Role[];

const ALL = PERMISSION_KEYS;
const without = (keys: string[], ...drop: string[]) => keys.filter((k) => !drop.includes(k));

/** Default matrix = spec 3.2. Super admins can edit it live. */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  SUPER_ADMIN: [...ALL],
  ADMIN: without(ALL, "admin.roles"),
  DIRECTION: [
    "dashboard.view", "dashboard.executive", "planning.view", "project.view", "project.finance.read", "employee.view", "employee.salary.read", "skill.view", "skill.search",
    "availability.view", "request.view", "timesheet.view", "capacity.view", "capacity.whatif", "marketplace.view", "evaluation.view", "analytics.view", "analytics.cost",
    "analytics.export", "ai.use", "notification.view", "admin.view",
  ],
  PARTNER: [
    "dashboard.view", "planning.view", "project.view", "project.create", "project.edit", "project.finance.read", "employee.view", "skill.view", "skill.search", "availability.view",
    "request.view", "request.approve", "timesheet.view", "capacity.view", "capacity.whatif", "marketplace.view", "marketplace.publish", "marketplace.review", "evaluation.view", "evaluation.create",
    "evaluation.confidential.read", "analytics.view", "analytics.cost", "analytics.export", "ai.use", "notification.view",
  ],
  RESOURCE_MANAGER: [
    "dashboard.view", "planning.view", "planning.edit", "assignment.create", "assignment.softbook", "assignment.edit", "assignment.cancel", "assignment.exception", "project.view", "project.create", "project.edit",
    "employee.view", "skill.view", "skill.search", "skill.validate", "availability.view", "request.view", "request.process", "timesheet.view", "capacity.view", "capacity.whatif",
    "marketplace.view", "marketplace.publish", "marketplace.review", "analytics.view", "analytics.export", "ai.use", "notification.view", "admin.view", "admin.settings",
  ],
  MANAGER: [
    "dashboard.view", "planning.view", "planning.edit", "assignment.softbook", "project.view", "project.create", "project.edit", "employee.view", "skill.view", "skill.search", "skill.validate",
    "availability.view", "leave.approve", "request.view", "request.create", "timesheet.view", "timesheet.validate", "timesheet.own", "leave.request", "capacity.view", "marketplace.view", "marketplace.publish",
    "marketplace.review", "evaluation.view", "evaluation.create", "analytics.view", "analytics.export", "ai.use", "notification.view",
  ],
  RH: [
    "dashboard.view", "planning.view", "employee.view", "employee.create", "employee.archive", "employee.import", "employee.salary.read", "skill.view", "skill.search", "skill.validate",
    "skill.edit", "availability.view", "leave.approve", "timesheet.view", "capacity.view", "marketplace.view", "evaluation.view", "evaluation.create", "evaluation.confidential.read",
    "analytics.view", "analytics.export", "ai.use", "notification.view", "admin.view", "admin.referentials",
  ],
  COLLABORATEUR: [
    "dashboard.view", "planning.view", "project.view", "employee.view", "skill.view", "availability.view", "leave.request", "timesheet.own", "marketplace.view", "marketplace.apply",
    "evaluation.view", "ai.use", "notification.view",
  ],
};

/** Scope of data a role can reach for scoped permissions. */
export type Scope = "ALL" | "DEPARTMENT" | "SELF";
export const ROLE_SCOPE: Record<Role, Scope> = {
  SUPER_ADMIN: "ALL",
  ADMIN: "ALL",
  DIRECTION: "ALL",
  PARTNER: "DEPARTMENT",
  RESOURCE_MANAGER: "ALL",
  MANAGER: "DEPARTMENT",
  RH: "ALL",
  COLLABORATEUR: "SELF",
};

export interface Resource {
  employeeId?: string;
  projectId?: string;
  departmentId?: string;
}
type PermState = Pick<AppState, "rolePermissions" | "employees" | "projects" | "assignments">;

export const hasPermission = (state: Pick<AppState, "rolePermissions">, role: Role, perm: string): boolean => state.rolePermissions[role]?.includes(perm) ?? false;

/** Is the resource inside the user's scope? (Managers: own department + missions they lead/created/are staffed on.) */
export function inScope(state: PermState, user: User | null | undefined, res?: Resource): boolean {
  if (!user || !res) return !!user;
  const scope = ROLE_SCOPE[user.role];
  if (scope === "ALL") return true;
  const me = user.employeeId ? state.employees.find((e) => e.id === user.employeeId) : undefined;
  if (!me) return false;
  const projectOk = (pid: string) => {
    const p = state.projects.find((x) => x.id === pid);
    if (!p) return false;
    if (scope === "DEPARTMENT") return p.departmentId === me.departmentId || p.leadId === me.id || p.createdById === me.id || state.assignments.some((a) => a.projectId === pid && a.employeeId === me.id);
    return p.leadId === me.id || state.assignments.some((a) => a.projectId === pid && a.employeeId === me.id);
  };
  if (res.projectId) return projectOk(res.projectId);
  if (res.employeeId) {
    if (res.employeeId === me.id) return true;
    if (scope === "SELF") return false;
    const e = state.employees.find((x) => x.id === res.employeeId);
    return !!e && (e.departmentId === me.departmentId || e.managerId === me.id);
  }
  if (res.departmentId) return scope === "DEPARTMENT" ? res.departmentId === me.departmentId : false;
  return true;
}

/** can(user, action, resource) — permission in the (editable) matrix AND resource inside scope. */
export function can(state: PermState, user: User | null | undefined, perm: string, res?: Resource): boolean {
  if (!user || user.status !== "ACTIF") return false;
  if (!hasPermission(state, user.role, perm)) return false;
  return inScope(state, user, res);
}
export const canAny = (state: PermState, user: User | null | undefined, perms: string[], res?: Resource) => perms.some((p) => can(state, user, p, res));
