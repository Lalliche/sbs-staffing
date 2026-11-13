import type { AppState } from "../types";
import { ok, type Result } from "./core";

/** Mark notifications read. Not audited (personal state), per spec: audit covers sensitive writes. */
export function markRead(s: AppState, id: string, read = true): Result {
  const n = s.notifications.find((x) => x.id === id && x.userId === s.session.userId);
  if (n) n.read = read;
  return ok(undefined);
}
export function markAllRead(s: AppState, kind?: string): Result<number> {
  let c = 0;
  for (const n of s.notifications) if (n.userId === s.session.userId && !n.read && (!kind || n.kind === kind)) { n.read = true; c++; }
  return ok(c);
}
export function setNotificationPref(s: AppState, kind: string, channel: "inApp" | "email", value: boolean): Result {
  const uid = s.session.userId;
  if (!uid) return ok(undefined);
  s.notificationPrefs[uid] ??= {};
  s.notificationPrefs[uid][kind] = { ...(s.notificationPrefs[uid][kind] ?? { inApp: true, email: false }), [channel]: value };
  return ok(undefined);
}
