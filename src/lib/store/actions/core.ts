/* Shared helpers for every action: result type, permission gate, audit, notification. */
import { writeAudit, type AuditInput } from "../../engine/audit";
import { nextId } from "../../engine/ids";
import { can, hasPermission, type Resource } from "../../engine/permissions";
import type { BlockReason } from "../../engine/matching";
import type { Conflict } from "../../engine/conflicts";
import type { AppState, NotificationKind, User } from "../types";

export type ActionError = "FORBIDDEN" | "INVALID" | "NOT_FOUND" | "CONFLICT" | "NEEDS_EXCEPTION" | "LOCKED";
export type Result<T = void> = { ok: true; value: T; warnings?: string[] } | { ok: false; code: ActionError; error: string; conflicts?: Conflict[]; blocks?: BlockReason[] };

export const ok = <T>(value: T, warnings?: string[]): Result<T> => ({ ok: true, value, warnings });
export const fail = (code: ActionError, error: string, extra: { conflicts?: Conflict[]; blocks?: BlockReason[] } = {}): Result<never> => ({ ok: false, code, error, ...extra });

export const actorOf = (s: AppState): User | undefined => s.users.find((u) => u.id === s.session.userId && u.status === "ACTIF");
export const fullName = (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`;
export const empName = (s: AppState, id: string) => {
  const e = s.employees.find((x) => x.id === id);
  return e ? fullName(e) : id;
};
export const userOfEmployee = (s: AppState, employeeId: string) => s.users.find((u) => u.employeeId === employeeId && u.status === "ACTIF");

/** Permission gate used at the top of every action. Returns a failure result or null. */
export function deny(s: AppState, perm: string, res?: Resource): Result<never> | null {
  const u = actorOf(s);
  if (!u) return fail("FORBIDDEN", "Session expirée : reconnectez-vous.");
  if (!can(s, u, perm, res)) return fail("FORBIDDEN", "Votre profil n’autorise pas cette action.");
  return null;
}

export function audit(s: AppState, input: Omit<AuditInput, "actorId">): void {
  writeAudit(s, { ...input, actorId: s.session.userId });
}

export function notify(s: AppState, userId: string | undefined, kind: NotificationKind, title: string, body: string, href: string) {
  if (!userId || userId === s.session.userId) return; // never notify the actor about their own action
  const prefs = s.notificationPrefs[userId]?.[kind];
  if (prefs && !prefs.inApp && !prefs.email) return;
  const id = nextId(s, "nt");
  s.notifications.unshift({ id, userId, kind, title, body, href, createdAt: s.now, read: false, email: !!prefs?.email });
  if (prefs?.email) s.emailLog.unshift({ id: nextId(s, "em"), ts: s.now, toUserId: userId, subject: title });
}
/** Notify every active user whose role holds `perm` (e.g. the Resource Managers for `request.process`). */
export function notifyHolders(s: AppState, perm: string, kind: NotificationKind, title: string, body: string, href: string) {
  s.users.filter((u) => u.status === "ACTIF" && hasPermission(s, u.role, perm)).forEach((u) => notify(s, u.id, kind, title, body, href));
}
