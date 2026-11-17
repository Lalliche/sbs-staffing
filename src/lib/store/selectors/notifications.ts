import type { AppState, Notification, NotificationKind } from "../types";

export const myNotifications = (s: AppState, userId: string): Notification[] => s.notifications.filter((n) => n.userId === userId);
export const unreadCount = (s: AppState, userId: string): number => s.notifications.filter((n) => n.userId === userId && !n.read).length;
export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  REQUEST: "Demandes",
  ASSIGNMENT: "Affectations",
  MISSION: "Missions",
  CONFLICT: "Conflits",
  OVERLOAD: "Surcharges",
  CERTIFICATION: "Certifications",
  UNSTAFFED: "Missions sans équipe",
  SYSTEM: "Système",
};
