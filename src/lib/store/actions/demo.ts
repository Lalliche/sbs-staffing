/* Demo-bar helpers: « Simuler une demande » adds a plausible request so queues move live (spec 4). */
import { nextId } from "../../engine/ids";
import type { AppState, StaffingRequest } from "../types";
import { audit, empName, notifyHolders, ok, type Result } from "./core";

export function simulateRequest(s: AppState): Result<string> {
  s.idSeq++;
  {
    const open = s.requirements.filter((r) => {
      const p = s.projects.find((x) => x.id === r.projectId);
      return p && p.status !== "TERMINEE" && p.status !== "ANNULEE" && !s.requests.some((q) => q.requirementId === r.id && !["REJETEE", "ANNULEE", "SATISFAITE"].includes(q.status));
    });
    const r = open[s.requests.length % Math.max(1, open.length)];
    if (!r) return ok("Aucun besoin ouvert à demander.");
    const p = s.projects.find((x) => x.id === r.projectId)!;
    const req: StaffingRequest = {
      id: nextId(s, "rqs"), reference: `DS-2026-${String(40 + s.requests.length)}`, projectId: p.id, requirementId: r.id, requesterId: p.leadId, gradeId: r.gradeMin, quantity: 1,
      skillIds: r.mandatorySkillIds, startDate: r.startDate, endDate: r.endDate, allocationPct: r.allocationPct, estimatedLoad: 40, priority: "HAUTE",
      justification: "Demande simulée depuis la barre de démonstration.", status: "SOUMISE", proposedEmployeeIds: [], createdAt: s.now, comments: [], history: [{ ts: s.now, actorId: "system", status: "SOUMISE" }],
    };
    s.requests.push(req);
    audit(s, { action: "request.submit", entity: "Demande", entityId: req.id, label: `${req.reference} — ${p.name}`, after: { status: "SOUMISE" } });
    notifyHolders(s, "request.process", "REQUEST", `Nouvelle demande de staffing ${req.reference}`, `${p.name} — ${empName(s, p.leadId)}.`, "/app/demandes");
    return ok(`Demande ${req.reference} ajoutée à la file.`);
  }
}
