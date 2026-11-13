/* Administration writes: roles & permissions (live), staffing rules, users, referentials, data. All audited with before/after. */
import { PERMISSIONS, ROLES, DEFAULT_ROLE_PERMISSIONS, can } from "../../engine/permissions";
import { nextId } from "../../engine/ids";
import type { AppState, Role, Settings, User } from "../types";
import { audit, deny, fail, ok, type Result } from "./core";

export function setRolePermission(s: AppState, role: Role, perm: string, on: boolean): Result {
  const denied = deny(s, "admin.roles");
  if (denied) return denied;
  if (!PERMISSIONS.some((p) => p.key === perm)) return fail("INVALID", "Permission inconnue.");
  if (role === "SUPER_ADMIN" && !on && (perm === "admin.roles" || perm === "admin.view")) return fail("INVALID", "Le Super administrateur conserve toujours l’accès à l’administration des rôles.");
  const list = s.rolePermissions[role];
  const has = list.includes(perm);
  if (has === on) return ok(undefined);
  s.rolePermissions[role] = on ? [...list, perm] : list.filter((p) => p !== perm);
  audit(s, { action: "role.update", entity: "Rôle", entityId: role, label: `Rôle ${role} — « ${perm} » ${on ? "activée" : "retirée"}`, before: { [perm]: has }, after: { [perm]: on } });
  return ok(undefined);
}
export function resetRolePermissions(s: AppState, role?: Role): Result {
  const denied = deny(s, "admin.roles");
  if (denied) return denied;
  for (const r of role ? [role] : ROLES) {
    const before = s.rolePermissions[r].length;
    s.rolePermissions[r] = [...DEFAULT_ROLE_PERMISSIONS[r]];
    audit(s, { action: "role.reset", entity: "Rôle", entityId: r, label: `Rôle ${r} — valeurs par défaut rétablies`, before: { permissions: before }, after: { permissions: s.rolePermissions[r].length } });
  }
  return ok(undefined);
}

export function validateSettings(st: Settings): string | null {
  const w = Object.values(st.scoringWeights);
  if (w.some((x) => !(x >= 0 && x <= 100))) return "Chaque pondération est comprise entre 0 et 100.";
  if (w.reduce((a, b) => a + b, 0) <= 0) return "La somme des pondérations doit être positive.";
  if (!(st.thresholds.underUse >= 0 && st.thresholds.underUse < st.thresholds.overload)) return "Le seuil de sous-occupation doit être inférieur au seuil de surcharge.";
  if (st.softBookingExpiryDays < 1 || st.softBookingExpiryDays > 60) return "L’expiration des réservations est comprise entre 1 et 60 jours.";
  if (st.maxDailyHours < 4 || st.maxDailyHours > 16 || st.maxWeeklyHours < 20 || st.maxWeeklyHours > 80) return "Maximums d’heures hors plage.";
  if (Object.values(st.forecastWeights).some((x) => x < 0 || x > 100)) return "Les pondérations de certitude sont comprises entre 0 et 100.";
  return null;
}
export function saveSettings(s: AppState, next: Settings): Result {
  const denied = deny(s, "admin.settings");
  if (denied) return denied;
  const err = validateSettings(next);
  if (err) return fail("INVALID", err);
  const before = JSON.parse(JSON.stringify(s.settings)) as Settings;
  s.settings = JSON.parse(JSON.stringify(next)) as Settings;
  const flat = (o: Settings) => ({ ...o.scoringWeights, ...Object.fromEntries(Object.entries(o.blocking).map(([k, v]) => [`bloquant_${k}`, v])), minAvailabilityRatio: o.minAvailabilityRatio, sousOccupation: o.thresholds.underUse, surcharge: o.thresholds.overload, ...Object.fromEntries(Object.entries(o.forecastWeights).map(([k, v]) => [`certitude_${k}`, v])), softExpiryDays: o.softBookingExpiryDays, maxDaily: o.maxDailyHours, maxWeekly: o.maxWeeklyHours, longAbsence: o.longAbsenceDays, includeSoft: o.includeSoftInUtilization });
  audit(s, { action: "settings.update", entity: "Règles", entityId: "settings", label: "Règles de staffing modifiées", before: flat(before), after: flat(s.settings) });
  return ok(undefined);
}

export function setUserStatus(s: AppState, userId: string, status: User["status"]): Result {
  const denied = deny(s, "admin.users");
  if (denied) return denied;
  const u = s.users.find((x) => x.id === userId);
  if (!u) return fail("NOT_FOUND", "Utilisateur introuvable.");
  if (u.id === s.session.userId) return fail("INVALID", "Vous ne pouvez pas désactiver votre propre compte.");
  const before = u.status;
  u.status = status;
  audit(s, { action: "user.status", entity: "Utilisateur", entityId: userId, label: `${u.firstName} ${u.lastName}`, before: { statut: before }, after: { statut: status } });
  return ok(undefined);
}
export function setUserRole(s: AppState, userId: string, role: Role): Result {
  const denied = deny(s, "admin.users");
  if (denied) return denied;
  const u = s.users.find((x) => x.id === userId);
  if (!u) return fail("NOT_FOUND", "Utilisateur introuvable.");
  if (role === "SUPER_ADMIN" && !can(s, s.users.find((x) => x.id === s.session.userId), "admin.roles")) return fail("FORBIDDEN", "Seul un Super administrateur peut en nommer un autre.");
  const before = u.role;
  u.role = role;
  audit(s, { action: "user.role", entity: "Utilisateur", entityId: userId, label: `${u.firstName} ${u.lastName}`, before: { rôle: before }, after: { rôle: role } });
  return ok(undefined);
}
export function createUser(s: AppState, i: { firstName: string; lastName: string; email: string; role: Role; employeeId: string | null }): Result<User> {
  const denied = deny(s, "admin.users");
  if (denied) return denied;
  if (!i.firstName.trim() || !i.lastName.trim() || !/^\S+@\S+\.\S+$/.test(i.email)) return fail("INVALID", "Nom, prénom et e-mail valides sont obligatoires.");
  if (s.users.some((u) => u.email.toLowerCase() === i.email.toLowerCase())) return fail("INVALID", "Cet e-mail est déjà utilisé.");
  const u: User = { id: nextId(s, "u"), firstName: i.firstName.trim(), lastName: i.lastName.trim(), email: i.email.trim(), role: i.role, employeeId: i.employeeId, status: "ACTIF" };
  s.users.push(u);
  audit(s, { action: "user.create", entity: "Utilisateur", entityId: u.id, label: `${u.firstName} ${u.lastName}`, after: { rôle: u.role, email: u.email } });
  return ok(u);
}

/* Referentials: archive semantics — never delete a referenced item. */
export function addHoliday(s: AppState, date: string, name: string, officeId: string | null): Result {
  const denied = deny(s, "admin.referentials");
  if (denied) return denied;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !name.trim()) return fail("INVALID", "Date et libellé obligatoires.");
  if (s.holidays.some((h) => h.date === date && h.officeId === officeId)) return fail("INVALID", "Ce jour férié existe déjà.");
  s.holidays.push({ id: nextId(s, "h"), date, name: name.trim(), officeId });
  audit(s, { action: "referential.holiday.add", entity: "Jour férié", entityId: date, label: name.trim(), after: { date, bureau: officeId ?? "tous" } });
  return ok(undefined);
}
export function removeHoliday(s: AppState, id: string): Result {
  const denied = deny(s, "admin.referentials");
  if (denied) return denied;
  const h = s.holidays.find((x) => x.id === id);
  if (!h) return fail("NOT_FOUND", "Introuvable.");
  s.holidays = s.holidays.filter((x) => x.id !== id);
  audit(s, { action: "referential.holiday.remove", entity: "Jour férié", entityId: id, label: h.name, before: { date: h.date } });
  return ok(undefined);
}
export function addReferential(s: AppState, kind: "department" | "grade" | "office" | "category" | "certification", name: string, extra?: number): Result {
  const denied = deny(s, "admin.referentials");
  if (denied) return denied;
  const n = name.trim();
  if (!n) return fail("INVALID", "Le libellé est obligatoire.");
  const lists = { department: s.departments, grade: s.grades, office: s.offices, category: s.skillCategories, certification: s.certifications } as const;
  if ((lists[kind] as { name: string }[]).some((x) => x.name.toLowerCase() === n.toLowerCase())) return fail("INVALID", "Ce libellé existe déjà.");
  const id = nextId(s, kind.slice(0, 2));
  if (kind === "department") s.departments.push({ id, name: n, code: n.slice(0, 3).toUpperCase() });
  else if (kind === "grade") s.grades.push({ id, name: n, rank: extra ?? s.grades.length + 1 });
  else if (kind === "office") s.offices.push({ id, name: `Bureau de ${n}`, city: n, workingWeekdays: [0, 1, 2, 3, 4] });
  else if (kind === "category") s.skillCategories.push({ id, name: n });
  else s.certifications.push({ id, name: n, issuer: "À préciser", validityMonths: extra ?? 36 });
  audit(s, { action: `referential.${kind}.add`, entity: "Référentiel", entityId: id, label: n, after: { type: kind } });
  return ok(undefined);
}
export function removeReferential(s: AppState, kind: "department" | "grade" | "office" | "category" | "certification", id: string): Result {
  const denied = deny(s, "admin.referentials");
  if (denied) return denied;
  const used = kind === "department" ? s.employees.some((e) => e.departmentId === id) || s.projects.some((p) => p.departmentId === id) : kind === "grade" ? s.employees.some((e) => e.gradeId === id) : kind === "office" ? s.employees.some((e) => e.officeId === id) : kind === "category" ? s.skills.some((k) => k.categoryId === id) : s.employeeCertifications.some((c) => c.certificationId === id) || s.skills.some((k) => k.certificationIds.includes(id));
  if (used) return fail("INVALID", "Élément utilisé : il ne peut pas être supprimé (les référentiels s’archivent, ils ne se suppriment pas).");
  if (kind === "department") s.departments = s.departments.filter((x) => x.id !== id);
  else if (kind === "grade") s.grades = s.grades.filter((x) => x.id !== id);
  else if (kind === "office") s.offices = s.offices.filter((x) => x.id !== id);
  else if (kind === "category") s.skillCategories = s.skillCategories.filter((x) => x.id !== id);
  else s.certifications = s.certifications.filter((x) => x.id !== id);
  audit(s, { action: `referential.${kind}.remove`, entity: "Référentiel", entityId: id, label: id, before: { type: kind } });
  return ok(undefined);
}
export function setOfficeWeekdays(s: AppState, officeId: string, days: number[]): Result {
  const denied = deny(s, "admin.referentials");
  if (denied) return denied;
  const o = s.offices.find((x) => x.id === officeId);
  if (!o) return fail("NOT_FOUND", "Bureau introuvable.");
  if (days.length < 1) return fail("INVALID", "Au moins un jour travaillé.");
  const before = o.workingWeekdays;
  o.workingWeekdays = [...days].sort();
  audit(s, { action: "referential.office.weekdays", entity: "Bureau", entityId: officeId, label: o.name, before: { jours: before }, after: { jours: o.workingWeekdays } });
  return ok(undefined);
}
