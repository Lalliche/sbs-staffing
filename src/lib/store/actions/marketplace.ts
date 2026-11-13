/* Talent marketplace (spec 8.11). An application NEVER creates an assignment. */
import { nextId } from "../../engine/ids";
import type { AppState, Application, Opportunity } from "../types";
import { actorOf, audit, deny, empName, fail, notify, ok, type Result } from "./core";

export interface OpportunityInput { title: string; projectId?: string; description: string; skillIds: string[]; startDate: string; endDate: string; allocationPct: number; deadline: string; departmentId: string }
export function publishOpportunity(s: AppState, i: OpportunityInput): Result<Opportunity> {
  const denied = deny(s, "marketplace.publish");
  if (denied) return denied;
  if (!i.title.trim() || i.startDate > i.endDate || i.deadline < s.now) return fail("INVALID", "Titre, période valide et échéance future sont obligatoires.");
  const o: Opportunity = { id: nextId(s, "op"), publisherId: s.session.userId!, status: "OUVERTE", createdAt: s.now, ...i, title: i.title.trim() };
  s.opportunities.push(o);
  audit(s, { action: "marketplace.publish", entity: "Opportunité", entityId: o.id, label: o.title, after: { échéance: o.deadline } });
  s.users.filter((u) => u.employeeId && u.id !== s.session.userId && u.role === "COLLABORATEUR").forEach((u) => notify(s, u.id, "MARKETPLACE", "Nouvelle opportunité", o.title, "/app/marketplace"));
  return ok(o);
}
export function closeOpportunity(s: AppState, id: string): Result {
  const o = s.opportunities.find((x) => x.id === id);
  if (!o) return fail("NOT_FOUND", "Introuvable.");
  if (o.publisherId !== s.session.userId) { const d = deny(s, "marketplace.review"); if (d) return d; }
  o.status = "CLOTUREE";
  audit(s, { action: "marketplace.close", entity: "Opportunité", entityId: id, label: o.title, before: { statut: "OUVERTE" }, after: { statut: "CLOTUREE" } });
  return ok(undefined);
}
export function applyToOpportunity(s: AppState, opportunityId: string, motivation: string): Result<Application> {
  const denied = deny(s, "marketplace.apply");
  if (denied) return denied;
  const u = actorOf(s)!;
  const o = s.opportunities.find((x) => x.id === opportunityId);
  if (!o || o.status !== "OUVERTE") return fail("INVALID", "Cette opportunité n’est plus ouverte.");
  if (o.deadline < s.now) return fail("INVALID", "L’échéance de candidature est dépassée.");
  if (!u.employeeId) return fail("INVALID", "Aucun profil collaborateur.");
  if (s.applications.some((a) => a.opportunityId === opportunityId && a.employeeId === u.employeeId && a.status !== "RETIREE")) return fail("INVALID", "Vous avez déjà postulé.");
  if (motivation.trim().length < 10) return fail("INVALID", "Précisez votre motivation (10 caractères minimum).");
  const a: Application = { id: nextId(s, "ap"), opportunityId, employeeId: u.employeeId, motivation: motivation.trim(), status: "ENVOYEE", createdAt: s.now };
  s.applications.push(a);
  audit(s, { action: "marketplace.apply", entity: "Candidature", entityId: a.id, label: `${empName(s, u.employeeId)} → ${o.title}`, after: { statut: "ENVOYEE" } });
  notify(s, o.publisherId, "MARKETPLACE", "Nouvelle candidature", `${empName(s, u.employeeId)} a postulé à « ${o.title} ».`, "/app/marketplace");
  return ok(a);
}
export function withdrawApplication(s: AppState, id: string): Result {
  const a = s.applications.find((x) => x.id === id);
  if (!a || a.employeeId !== actorOf(s)?.employeeId) return fail("FORBIDDEN", "Votre profil n’autorise pas cette action.");
  a.status = "RETIREE";
  audit(s, { action: "marketplace.withdraw", entity: "Candidature", entityId: id, label: empName(s, a.employeeId), after: { statut: "RETIREE" } });
  return ok(undefined);
}
export function reviewApplication(s: AppState, id: string, status: "PRESELECTIONNEE" | "NON_RETENUE"): Result {
  const a = s.applications.find((x) => x.id === id);
  if (!a) return fail("NOT_FOUND", "Introuvable.");
  const denied = deny(s, "marketplace.review");
  if (denied) return denied;
  const o = s.opportunities.find((x) => x.id === a.opportunityId)!;
  const before = a.status;
  a.status = status;
  audit(s, { action: "marketplace.review", entity: "Candidature", entityId: id, label: `${empName(s, a.employeeId)} — ${o.title}`, before: { statut: before }, after: { statut: status } });
  notify(s, s.users.find((u) => u.employeeId === a.employeeId)?.id, "MARKETPLACE", status === "PRESELECTIONNEE" ? "Candidature présélectionnée" : "Candidature non retenue", o.title, "/app/marketplace");
  return ok(undefined);
}
