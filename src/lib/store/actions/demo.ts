/* Demo-bar helpers: « Simuler une demande » adds a plausible request so queues move live (spec 4). */
import { nextId } from "../../engine/ids";
import { fmtDate } from "../../engine/format";
import type { AppState, StaffingRequest } from "../types";
import { audit, empName, notifyHolders, notify, userOfEmployee, ok, type Result } from "./core";

const SCRIPT = ["request", "leave", "application"] as const;
export function simulateRequest(s: AppState): Result<string> {
  const step = SCRIPT[s.idSeq % SCRIPT.length];
  s.idSeq++;
  if (step === "request") {
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
  if (step === "leave") {
    const emp = s.employees.filter((e) => e.status === "ACTIF" && e.gradeId !== "g-5" && !s.leaves.some((l) => l.employeeId === e.id && l.status === "SOUMISE"))[s.leaves.length % 30];
    const start = `2027-0${2 + (s.leaves.length % 3)}-14`;
    const end = `2027-0${2 + (s.leaves.length % 3)}-18`;
    s.leaves.push({ id: nextId(s, "lv"), employeeId: emp.id, type: "CONGE_ANNUEL", startDate: start, endDate: end, status: "SOUMISE", createdAt: s.now });
    audit(s, { action: "leave.submit", entity: "Congé", entityId: `lv-sim`, label: `${empName(s, emp.id)} — ${fmtDate(start)}`, after: { status: "SOUMISE" } });
    const mgr = emp.managerId ? userOfEmployee(s, emp.managerId) : undefined;
    notify(s, mgr?.id, "LEAVE", "Demande de congé à approuver", `${empName(s, emp.id)} — du ${fmtDate(start)} au ${fmtDate(end)}.`, "/app/disponibilites");
    notifyHolders(s, "leave.approve", "LEAVE", "Demande de congé à approuver", `${empName(s, emp.id)} — du ${fmtDate(start)} au ${fmtDate(end)}.`, "/app/disponibilites");
    return ok(`Demande de congé de ${empName(s, emp.id)} ajoutée.`);
  }
  const opp = s.opportunities.find((o) => o.status === "OUVERTE" && s.employees.some((e) => !s.applications.some((a) => a.opportunityId === o.id && a.employeeId === e.id)));
  if (!opp) return ok("Aucune opportunité ouverte.");
  const cand = s.employees.find((e) => e.status === "ACTIF" && e.gradeId !== "g-5" && !s.applications.some((a) => a.opportunityId === opp.id && a.employeeId === e.id) && e.id !== "e11")!;
  s.applications.push({ id: nextId(s, "ap"), opportunityId: opp.id, employeeId: cand.id, motivation: "Candidature simulée depuis la barre de démonstration.", status: "ENVOYEE", createdAt: s.now });
  audit(s, { action: "marketplace.apply", entity: "Candidature", entityId: opp.id, label: `${empName(s, cand.id)} → ${opp.title}` });
  notify(s, s.users.find((u) => u.id === opp.publisherId)?.id, "MARKETPLACE", "Nouvelle candidature", `${empName(s, cand.id)} a postulé à « ${opp.title} ».`, "/app/marketplace");
  return ok(`Candidature de ${empName(s, cand.id)} ajoutée.`);
}
