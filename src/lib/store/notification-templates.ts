/* Notification templates (spec 8.16) — PROTOTYPE ONLY.
   Kept OUT of the store on purpose: defaults live here, overrides are persisted in the browser under their own
   localStorage key. Nothing in the engine reads them yet; the editor shows how a real product would let an admin
   rephrase the in-app / e-mail wording per notification kind. */
import type { NotificationKind } from "./types";

export const TEMPLATE_STORAGE_KEY = "sbs-staffing:notification-templates";

export interface NotificationTemplate {
  subject: string;
  body: string;
}
export type TemplateMap = Record<NotificationKind, NotificationTemplate>;

export const NOTIFICATION_KINDS: NotificationKind[] = ["REQUEST", "ASSIGNMENT", "MISSION", "CONFLICT", "OVERLOAD", "CERTIFICATION", "UNSTAFFED", "SYSTEM"];

/** Placeholders understood by the (future) renderer. */
export const TEMPLATE_PLACEHOLDERS = ["{{personne}}", "{{mission}}", "{{periode}}", "{{reference}}", "{{lien}}"] as const;

export const DEFAULT_TEMPLATES: TemplateMap = {
  REQUEST: { subject: "Nouvelle demande de staffing {{reference}}", body: "{{personne}} a soumis une demande pour la mission « {{mission}} » ({{periode}}). Ouvrez la file : {{lien}}" },
  ASSIGNMENT: { subject: "Affectation confirmée — {{mission}}", body: "Vous êtes affecté(e) à « {{mission}} » ({{periode}}). Détails : {{lien}}" },
  MISSION: { subject: "Mission modifiée — {{mission}}", body: "L’équipe ou la période de « {{mission}} » a changé ({{periode}}). Consultez : {{lien}}" },
  CONFLICT: { subject: "Conflit de planning — {{personne}}", body: "Un conflit a été détecté sur « {{mission}} » ({{periode}}). Arbitrer : {{lien}}" },
  OVERLOAD: { subject: "Surcharge détectée — {{personne}}", body: "{{personne}} dépasse le seuil de charge sur {{periode}}. Rééquilibrer : {{lien}}" },
  CERTIFICATION: { subject: "Certification bientôt expirée", body: "La certification de {{personne}} expire ({{periode}}). Planifier le renouvellement : {{lien}}" },
  UNSTAFFED: { subject: "Mission sans équipe complète — {{mission}}", body: "« {{mission}} » démarre ({{periode}}) sans équipe complète. Lancer le matching : {{lien}}" },
  SYSTEM: { subject: "Information système", body: "{{mission}} — {{lien}}" },
};

const clone = (m: TemplateMap): TemplateMap => structuredClone(m);

/** Defaults merged with the overrides stored in this browser. Never throws (storage may be unavailable). */
export function loadTemplates(): TemplateMap {
  const out = clone(DEFAULT_TEMPLATES);
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as Partial<Record<NotificationKind, Partial<NotificationTemplate>>>;
    for (const k of NOTIFICATION_KINDS) {
      const o = parsed[k];
      if (o && typeof o.subject === "string" && o.subject.trim()) out[k].subject = o.subject;
      if (o && typeof o.body === "string" && o.body.trim()) out[k].body = o.body;
    }
  } catch {
    /* corrupted or blocked storage: defaults */
  }
  return out;
}

/** Persist one override (an empty field falls back to the default). Returns the merged map. */
export function saveTemplate(kind: NotificationKind, tpl: NotificationTemplate): TemplateMap {
  const current = loadTemplates();
  current[kind] = { subject: tpl.subject.trim() || DEFAULT_TEMPLATES[kind].subject, body: tpl.body.trim() || DEFAULT_TEMPLATES[kind].body };
  const overrides: Partial<TemplateMap> = {};
  for (const k of NOTIFICATION_KINDS) if (JSON.stringify(current[k]) !== JSON.stringify(DEFAULT_TEMPLATES[k])) overrides[k] = current[k];
  try {
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    /* ignore: the prototype keeps working in memory */
  }
  return current;
}

export function resetTemplates(): TemplateMap {
  try {
    localStorage.removeItem(TEMPLATE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return clone(DEFAULT_TEMPLATES);
}

/** Fill placeholders with sample values (preview). */
export function renderTemplate(text: string, sample: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => sample[k] ?? m);
}
