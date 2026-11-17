import { BarChart3, Bell, BookOpenCheck, CalendarRange, ClipboardList, Gauge, Inbox, LayoutDashboard, Settings2, UserRound, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Any of these permissions makes the entry visible. */
  perms: string[];
  tour?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "Pilotage",
    items: [
      { key: "accueil", label: "Tableau de bord", href: "/app/accueil", icon: LayoutDashboard, perms: ["dashboard.view"], tour: "nav-accueil" },
      { key: "planning", label: "Planning", href: "/app/planning", icon: CalendarRange, perms: ["planning.view"], tour: "nav-planning" },
    ],
  },
  {
    label: "Opérations",
    items: [
      { key: "missions", label: "Missions", href: "/app/missions", icon: ClipboardList, perms: ["project.view"], tour: "nav-missions" },
      { key: "demandes", label: "Demandes de staffing", href: "/app/demandes", icon: Inbox, perms: ["request.view"], tour: "nav-demandes" },
    ],
  },
  {
    label: "Ressources",
    items: [
      { key: "collaborateurs", label: "Collaborateurs", href: "/app/collaborateurs", icon: Users, perms: ["employee.view"], tour: "nav-collab" },
    ],
  },
  {
    label: "Analyse",
    items: [
      { key: "capacite", label: "Capacité", href: "/app/capacite", icon: Gauge, perms: ["capacity.view"], tour: "nav-capacite" },
      { key: "analytics", label: "Analytics et rapports", href: "/app/analytics", icon: BarChart3, perms: ["analytics.view"], tour: "nav-analytics" },
    ],
  },
  {
    label: "Système",
    items: [
      { key: "notifications", label: "Notifications", href: "/app/notifications", icon: Bell, perms: ["notification.view"] },
      { key: "admin", label: "Administration", href: "/app/admin", icon: Settings2, perms: ["admin.view"], tour: "nav-admin" },
      { key: "aide", label: "Aide", href: "/app/aide", icon: BookOpenCheck, perms: ["dashboard.view"] },
    ],
  },
];

/** Breadcrumb labels by path segment. */
export const CRUMBS: Record<string, string> = {
  accueil: "Tableau de bord", planning: "Planning", missions: "Missions", demandes: "Demandes de staffing",
  collaborateurs: "Collaborateurs", capacite: "Capacité",
  analytics: "Analytics et rapports", notifications: "Notifications", admin: "Administration", aide: "Aide", utilisateurs: "Utilisateurs", roles: "Rôles et permissions",
  referentiels: "Référentiels", regles: "Règles de staffing", audit: "Journal d’audit", donnees: "Données", ia: "Intelligence artificielle", nouveau: "Nouveau", assistant: "Assistant",
};
/** Navigation as seen by the viewer. A Collaborateur only ever sees themselves, so « Collaborateurs » becomes « Mon profil ». */
export function resolveNav(selfView: boolean): NavGroup[] {
  if (!selfView) return NAV;
  return NAV.map((g) => ({
    ...g,
    label: g.items.some((i) => i.key === "collaborateurs") ? "Mon espace" : g.label,
    items: g.items.map((i) => (i.key === "collaborateurs" ? { ...i, label: "Mon profil", icon: UserRound } : i)),
  }));
}
export const canSee = (item: NavItem, can: (p: string) => boolean) => item.perms.some((p) => can(p));
