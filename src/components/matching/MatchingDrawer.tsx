"use client";
import { CalendarX2, Check, CircleHelp, GitCompare, OctagonX, TriangleAlert, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { createAssignment, replaceAssignment, type BookingInput } from "@/lib/store/actions/assignments";
import type { Result } from "@/lib/store/actions/core";
import { candidatePool, rankCandidates, requirementLike, CRITERION_LABEL, type MatchResult } from "@/lib/engine/matching";
import { matchView } from "@/lib/store/selectors/core";
import { fmtDZD, fmtHours, fmtPct, fmtRange } from "@/lib/engine/format";
import { ProgressRing } from "@/components/charts/Ring";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, SegmentedControl, Switch } from "@/components/ui/FormInputs";
import { Callout } from "@/components/ui/Surface";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { ExceptionModal, type Failure } from "@/components/missions/ExceptionModal";

type Pending = { inputs: BookingInput[]; label: string; replaceId?: string; result: Failure };

/** « Trouver des candidats » (spec 8.4). Ranked scorecards, blocking criteria kept apart from the score, comparison, soft/hard booking. */
export function MatchingDrawer({ open, onClose, requirementId, replaceAssignmentId }: { open: boolean; onClose: () => void; requirementId: string | null; replaceAssignmentId?: string }) {
  const { s, can } = useSession();
  const toast = useToast();
  const [higher, setHigher] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [minScore, setMinScore] = useState<"0" | "50" | "70">("0");
  const [picked, setPicked] = useState<string[]>([]);
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const req = requirementId ? s.requirements.find((r) => r.id === requirementId) : undefined;
  const project = req ? s.projects.find((p) => p.id === req.projectId) : undefined;
  const ranked = useMemo<MatchResult[]>(() => {
    if (!req || !project) return [];
    const pool = candidatePool(s, { gradeMin: req.gradeMin, projectLeadId: project.leadId }, { includeHigherGrades: higher });
    const already = new Set(s.assignments.filter((a) => a.projectId === project.id && a.requirementId === req.id && (a.status === "HARD" || a.status === "SOFT")).map((a) => a.employeeId));
    return rankCandidates(s, requirementLike(req, project), { employeeIds: pool.filter((id) => !already.has(id)) });
  }, [s, req, project, higher]);
  if (!req || !project) return null;

  const gradeName = (id: string) => s.grades.find((g) => g.id === id)?.name ?? "";
  const compat = ranked.filter((r) => r.compatible && r.score >= Number(minScore));
  const blocked = ranked.filter((r) => !r.compatible);
  const list = showBlocked ? [...compat, ...blocked] : compat;
  const w = s.settings.scoringWeights;
  const canBook = can("assignment.create", { projectId: project.id });
  const canSoft = canBook || can("assignment.softbook", { projectId: project.id });
  const base = (employeeId: string, status: "SOFT" | "HARD"): BookingInput => ({ employeeId, projectId: project.id, requirementId: req.id, startDate: req.startDate, endDate: req.endDate, allocationPct: req.allocationPct, status });

  const run = (inputs: BookingInput[], label: string, replaceId?: string, reason?: string) => {
    const results: Result<unknown>[] = act((d) => (replaceId ? [replaceAssignment(d, replaceId, inputs[0].employeeId, reason)] : inputs.map((i) => createAssignment(d, { ...i, exceptionReason: reason }))));
    const bad = results.find((r) => !r.ok) as Failure | undefined;
    const okN = results.filter((r) => r.ok).length;
    if (bad?.code === "NEEDS_EXCEPTION") {
      setPending({ inputs: inputs.slice(results.findIndex((r) => !r.ok)), label, replaceId, result: bad });
      if (okN) toast({ title: `${okN} affectation(s) enregistrée(s)`, body: label });
      return;
    }
    if (bad) toast({ title: "Action refusée", body: bad.error, tone: "warning" });
    else toast({ title: label, body: "Disponibilités et utilisation mises à jour.", tone: "success" });
    if (okN) setPicked([]);
  };
  const toggle = (arr: string[], id: string, max = 99) => (arr.includes(id) ? arr.filter((x) => x !== id) : arr.length >= max ? arr : [...arr, id]);
  const nm = (id: string) => { const e = s.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Trouver des candidats" subtitle={`${project.name} — ${req.quantity} × ${gradeName(req.gradeMin)} · ${fmtPct(req.allocationPct)} · ${fmtRange(req.startDate, req.endDate)}`} width="52em"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-text-secondary">{picked.length} sélectionné(s){compare.length ? ` · ${compare.length} à comparer` : ""}</span>
            <span className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={compare.length < 2} icon={<GitCompare className="size-4" />} onClick={() => setComparing(true)}>Comparer ({compare.length}/3)</Button>
              <Button disabled={!picked.length || !canBook || !!replaceAssignmentId} icon={<UserCheck className="size-4" />} onClick={() => run(picked.map((id) => base(id, "HARD")), `${picked.length} affectation(s) confirmée(s)`)}>Affecter la sélection</Button>
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Callout tone="neutral" title="Comment lire ce classement">
            Score sur 100 = pondération des 6 critères ({[["skills", w.skills], ["availability", w.availability], ["sector", w.sector], ["grade", w.grade], ["certifications", w.certifications], ["history", w.history]].map(([k, v]) => `${CRITERION_LABEL[k as keyof typeof CRITERION_LABEL]} ${v}`).join(" · ")}). Les critères bloquants sont séparés du score : un candidat « Non compatible » n’est jamais proposé comme parfait ni sélectionnable automatiquement. Le moteur n’invente jamais de compétence.
          </Callout>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-bg px-3 py-2.5">
            <SegmentedControl size="sm" label="Score minimum" value={minScore} onChange={setMinScore} options={[{ value: "0", label: "Tous" }, { value: "50", label: "≥ 50" }, { value: "70", label: "≥ 70" }]} />
            <label className="flex items-center gap-2 text-sm"><Switch size="sm" checked={higher} onChange={setHigher} label="Inclure les grades supérieurs" /> Inclure les grades supérieurs</label>
            <label className="flex items-center gap-2 text-sm"><Switch size="sm" checked={showBlocked} onChange={setShowBlocked} label="Afficher les non compatibles" /> Afficher les non compatibles <Badge tone="conflict" icon>{blocked.length}</Badge></label>
          </div>
          {replaceAssignmentId && <Callout tone="info">Mode remplacement : choisir « Proposer en remplacement » remplace l’affectation existante en conservant son historique.</Callout>}
          {list.length === 0 && <Callout tone="alert" title="Aucun candidat compatible">Affichez les non compatibles ou élargissez aux grades supérieurs.</Callout>}
          <ul className="flex flex-col gap-3">
            {list.map((m, idx) => {
              const e = s.employees.find((x) => x.id === m.employeeId)!;
              const v = matchView(s, m);
              const ok = m.compatible;
              return (
                <li key={m.employeeId} className={cn("rounded-lg border bg-bg p-4", ok ? "border-border" : "border-conflict/40")}>
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="pt-1"><Checkbox checked={picked.includes(m.employeeId)} disabled={!ok || !canBook || !!replaceAssignmentId} onChange={() => setPicked((p) => toggle(p, m.employeeId))} label={<span className="sr-only">Sélectionner {e.firstName} {e.lastName}</span>} /></div>
                    <ProgressRing value={m.score / 100} size="4.2em" stroke={9} tone={ok ? (m.score >= 80 ? "ok" : "primary") : "conflict"} label={`Score ${m.score} sur 100`}><span className="text-md font-semibold tabular-nums text-ink">{m.score}</span></ProgressRing>
                    <div className="min-w-[14em] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Avatar person={e} size="sm" />
                        <span className="text-md font-semibold text-ink">{e.firstName} {e.lastName}</span>
                        <span className="text-xs text-text-muted">{gradeName(e.gradeId)} · {s.departments.find((d) => d.id === e.departmentId)?.name}</span>
                        {idx === 0 && ok && <Badge tone="ok" icon>Meilleur score</Badge>}
                        {ok ? <StatusPill tone="ok" label="Compatible" /> : <StatusPill tone="conflict" label="Non compatible" />}
                      </div>
                      {!ok && <ul className="mt-2 flex flex-col gap-1">{m.blocking.map((b) => <li key={b.kind} className="flex items-start gap-1.5 text-sm text-conflict"><OctagonX className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span><span className="font-medium">{b.label}</span> — {b.detail}</span></li>)}</ul>}
                      {m.strengths.length > 0 && <p className="mt-2 flex flex-wrap gap-1.5">{m.strengths.map((t) => <Badge key={t} tone="ok" icon>{t}</Badge>)}</p>}
                      {m.missingSkillIds.length > 0 && ok && <p className="mt-1.5 text-xs text-alert">Compétences manquantes : {m.missingSkillIds.map((id) => s.skills.find((k) => k.id === id)?.name).join(", ")}</p>}
                      {m.weakSkillIds.length > 0 && <p className="mt-1 text-xs text-text-secondary">Niveau à consolider : {m.weakSkillIds.map((id) => s.skills.find((k) => k.id === id)?.name).join(", ")}</p>}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {m.criteria.map((c) => (
                      <div key={c.key} className="text-xs" title={c.detail}>
                        <div className="flex justify-between"><span className="text-text-secondary">{c.label}{c.notApplicable ? " (n/a)" : ""}</span><span className="tabular-nums text-ink">{c.points.toFixed(1).replace(".", ",")} / {c.max.toFixed(0)}</span></div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-paper-deep"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, c.ratio * 100)}%` }} /></div>
                        <p className="mt-0.5 text-2xs text-text-muted">{c.detail}</p>
                      </div>
                    ))}
                  </div>
                  <dl className="mt-3 grid gap-2 border-t border-line pt-3 text-xs sm:grid-cols-3">
                    <div><dt className="text-text-muted">Disponibilité réelle</dt><dd className="font-medium tabular-nums text-ink">{fmtPct(m.availability.ratio * 100)} · {fmtHours(m.availability.freeHours)} libres / {fmtHours(m.availability.neededHours)}</dd></div>
                    <div><dt className="text-text-muted">Missions en cours</dt><dd className="font-medium text-ink">{m.currentProjectIds.length ? m.currentProjectIds.map((id) => s.projects.find((p) => p.id === id)?.name).join(" ; ") : "Aucune"}</dd></div>
                    {typeof v.estimatedCost === "number" ? <div><dt className="text-text-muted">Coût estimé</dt><dd className="font-medium tabular-nums text-ink">{fmtDZD(v.estimatedCost)}</dd></div> : <div><dt className="text-text-muted">Coût estimé</dt><dd className="flex items-center gap-1 text-text-muted"><CircleHelp className="size-3" aria-hidden /> Non visible avec votre profil</dd></div>}
                  </dl>
                  {(m.conflicts.length > 0 || m.warnings.length > 0) && (
                    <ul className="mt-2 flex flex-col gap-1">
                      {m.conflicts.map((c, i) => <li key={i} className={cn("flex items-start gap-1.5 text-xs", c.severity === "ERROR" ? "text-conflict" : "text-alert")}>{c.severity === "ERROR" ? <OctagonX className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />}{c.message}</li>)}
                      {m.warnings.map((t, i) => <li key={`w${i}`} className="flex items-start gap-1.5 text-xs text-alert"><CalendarX2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t}</li>)}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <Checkbox checked={compare.includes(m.employeeId)} onChange={() => setCompare((c) => toggle(c, m.employeeId, 3))} label={<span className="text-xs">Comparer</span>} />
                    <span className="flex flex-wrap gap-2">
                      {replaceAssignmentId ? (
                        <Button size="sm" disabled={!canBook} onClick={() => run([base(m.employeeId, "HARD")], `${nm(m.employeeId)} remplace l’affectation`, replaceAssignmentId)}>Proposer en remplacement</Button>
                      ) : (
                        <>
                          <Button size="sm" variant="secondary" disabled={!canSoft} onClick={() => run([base(m.employeeId, "SOFT")], `Réservation de ${nm(m.employeeId)} créée (${s.settings.softBookingExpiryDays} j)`)}>Réserver (soft)</Button>
                          <Button size="sm" variant={ok ? "primary" : "secondary"} disabled={!canBook} onClick={() => run([base(m.employeeId, "HARD")], `${nm(m.employeeId)} affecté(e)`)}>Affecter{ok ? "" : " (exception)"}</Button>
                        </>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Drawer>

      <Modal open={comparing} onClose={() => setComparing(false)} size="lg" title="Comparaison côte à côte" subtitle="Jusqu’à 3 candidats, mêmes critères, mêmes pondérations">
        <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Comparaison des candidats</caption>
          <thead><tr><th className="py-2 text-start font-medium text-text-muted">Critère</th>{compare.map((id) => <th key={id} className="px-3 py-2 text-end font-semibold text-ink">{nm(id)}</th>)}</tr></thead>
          <tbody>
            {(["skills", "availability", "sector", "grade", "certifications", "history"] as const).map((k) => (
              <tr key={k} className="border-t border-line"><th scope="row" className="py-2 text-start font-normal text-text-secondary">{CRITERION_LABEL[k]}</th>{compare.map((id) => { const c = ranked.find((r) => r.employeeId === id)?.criteria.find((x) => x.key === k); return <td key={id} className="px-3 py-2 text-end tabular-nums">{c ? `${c.points.toFixed(1).replace(".", ",")} / ${c.max.toFixed(0)}` : "—"}</td>; })}</tr>
            ))}
            <tr className="border-t-2 border-border font-semibold"><th scope="row" className="py-2 text-start">Score global</th>{compare.map((id) => <td key={id} className="px-3 py-2 text-end tabular-nums">{ranked.find((r) => r.employeeId === id)?.score}</td>)}</tr>
            <tr className="border-t border-line"><th scope="row" className="py-2 text-start font-normal text-text-secondary">Statut</th>{compare.map((id) => { const r = ranked.find((x) => x.employeeId === id); return <td key={id} className="px-3 py-2 text-end">{r?.compatible ? <StatusPill tone="ok" label="Compatible" /> : <StatusPill tone="conflict" label="Non compatible" />}</td>; })}</tr>
            <tr className="border-t border-line"><th scope="row" className="py-2 text-start font-normal text-text-secondary">Disponibilité</th>{compare.map((id) => <td key={id} className="px-3 py-2 text-end tabular-nums">{fmtPct((ranked.find((x) => x.employeeId === id)?.availability.ratio ?? 0) * 100)}</td>)}</tr>
          </tbody></table></div>
      </Modal>

      <ExceptionModal open={!!pending} result={pending?.result ?? null} onCancel={() => setPending(null)} onConfirm={(reason) => { const p = pending!; setPending(null); run(p.inputs, p.label, p.replaceId, reason); }} />
      <span hidden><Check /></span>
    </>
  );
}
