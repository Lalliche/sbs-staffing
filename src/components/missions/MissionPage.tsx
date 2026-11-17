"use client";
import { FilePlus2, FileUp, Search, UserMinus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { cancelAssignment, convertToHard, updateAssignment, type AssignmentPatch } from "@/lib/store/actions/assignments";
import { addProjectDocument, setMilestoneDone, setProjectStatus } from "@/lib/store/actions/projects";
import { TeamPresence } from "@/components/presence/TeamPresence";
import { missionCosts, missionHistory, missionTeam, projectDocs, requirementsOf } from "@/lib/store/selectors/missions";
import { projectById, nameOf } from "@/lib/store/selectors/core";
import { projectCoverage } from "@/lib/engine/booking";
import { fmtDZD, fmtDate, fmtDateShort, fmtHours, fmtPct, fmtRange, relDays } from "@/lib/engine/format";
import { ProgressRing } from "@/components/charts/Ring";
import { MatchingDrawer } from "@/components/matching/MatchingDrawer";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { NumberInput, DateRangeInput } from "@/components/ui/Controls";
import { TextArea } from "@/components/ui/FormInputs";
import { Callout, Card, CardHeader, EmptyState, PageHeader, ProgressBar } from "@/components/ui/Surface";
import { Modal } from "@/components/ui/Overlay";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { Bars } from "@/components/charts/Charts";
import { ExceptionModal, type Failure } from "./ExceptionModal";
import { CERTAINTY, PRIORITY, PROJECT_STATUS } from "@/lib/ui-domain";

const TABS = [["infos", "Informations générales"], ["besoins", "Besoins de staffing"], ["equipe", "Équipe affectée"], ["planning", "Planning"], ["presence", "Présence"], ["budget", "Budget et coûts"], ["documents", "Documents"], ["historique", "Historique"]] as const;
type Tab = (typeof TABS)[number][0];

export function MissionPage({ id }: { id: string }) {
  const { s, can } = useSession();
  const router = useRouter();
  const q = useQueryState();
  const toast = useToast();
  const p = projectById(s, id);
  const tab = (q.get("tab") || "infos") as Tab;
  const matching = q.get("matching") || null;
  const [replace, setReplace] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<{ id: string; patch: AssignmentPatch; result: Failure } | null>(null);
  if (!p) return <EmptyState icon={FilePlus2} title="Mission introuvable ou hors de votre périmètre" action={<Button href="/app/missions" variant="secondary">Retour aux missions</Button>} className="py-20" />;
  const raw = s.projects.find((x) => x.id === id)!;
  const cov = projectCoverage(s, id);
  const reqs = requirementsOf(s, id);
  const team = missionTeam(s, id);
  const client = s.clients.find((c) => c.id === p.clientId);
  const costs = missionCosts(s, id);
  const canEdit = can("project.edit", { projectId: id });
  const canAssign = can("assignment.create", { projectId: id });
  const tabs = TABS.filter(([k]) => k !== "budget" || can("project.finance.read", { projectId: id })).map(([value, label]) => ({ value, label: value === "besoins" ? <>{label}</> : label, count: value === "besoins" ? reqs.length : value === "equipe" ? team.filter((t) => t.a.status !== "TERMINEE").length : undefined }));

  const apply = (aid: string, patch: AssignmentPatch, reason?: string) => {
    const r = act((d) => updateAssignment(d, aid, patch, reason));
    if (!r.ok && r.code === "NEEDS_EXCEPTION") return setPending({ id: aid, patch, result: r });
    if (!r.ok) return toast({ title: "Modification refusée", body: r.error, tone: "warning" });
    toast({ title: "Affectation modifiée" });
    setEdit(null);
  };
  const editing = edit ? s.assignments.find((a) => a.id === edit) : undefined;
  const byGrade = s.grades.map((g) => ({ label: g.name, value: team.filter((t) => t.emp.gradeId === g.id && t.a.status !== "TERMINEE").length })).filter((x) => x.value);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Missions", href: "/app/missions" }, { label: p.name }]}
        title={p.name}
        description={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-mono text-xs">{p.reference}</span><span className="font-mono text-xs">OTP {p.otp}</span><span>{client?.name}</span><span>Responsable : {nameOf(s, p.leadId)}</span></span>}
        actions={<><StatusPill tone={PROJECT_STATUS[p.status].tone} label={PROJECT_STATUS[p.status].label} />{canEdit && p.status !== "TERMINEE" && p.status !== "ANNULEE" && <Button variant="secondary" onClick={() => setCancelling(true)}>Annuler la mission</Button>}</>}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3 !p-3"><ProgressRing value={cov.rate} size="3.6em" stroke={10} tone={cov.rate >= 1 ? "ok" : cov.rate > 0 ? "alert" : "conflict"} label={`Taux de staffing ${fmtPct(cov.rate * 100)}`}><span className="text-sm font-semibold tabular-nums">{Math.round(cov.rate * 100)}%</span></ProgressRing><div><p className="text-xs text-text-muted">Taux de staffing</p><p className="text-sm font-medium tabular-nums text-ink">{cov.hard}/{cov.quantity} postes confirmés</p></div></Card>
        <Card className="!p-3"><p className="text-xs text-text-muted">Période</p><p className="text-sm font-medium text-ink">{fmtRange(p.startDate, p.endDate)}</p><p className="text-xs text-text-secondary">Démarre {relDays(p.startDate, s.now)}</p></Card>
        <Card className="!p-3"><p className="text-xs text-text-muted">Priorité · certitude</p><p className="mt-0.5 flex gap-2"><Badge tone={PRIORITY[p.priority].tone}>{PRIORITY[p.priority].label}</Badge><Badge tone={CERTAINTY[p.certainty].tone}>{CERTAINTY[p.certainty].label}</Badge></p></Card>
        <Card className="!p-3"><p className="text-xs text-text-muted">Équipe</p><p className="text-sm font-medium text-ink">{team.filter((t) => t.a.status !== "TERMINEE").length} personne(s){cov.soft ? ` · ${cov.soft} réservée(s)` : ""}</p></Card>
      </div>
      <Tabs label="Sections de la mission" value={tab} onChange={(v) => q.set("tab", v === "infos" ? null : v)} items={tabs} className="mb-5" />

      {tab === "infos" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card><CardHeader title="Informations générales" /><dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm"><dt className="text-text-muted">Client</dt><dd>{client?.name} — {client?.city}</dd><dt className="text-text-muted">Secteur</dt><dd>{p.sector}</dd><dt className="text-text-muted">Type</dt><dd>{p.type}</dd><dt className="text-text-muted">Département</dt><dd>{s.departments.find((d) => d.id === p.departmentId)?.name}</dd><dt className="text-text-muted">Durée estimée</dt><dd>{p.estimatedDays} jours</dd><dt className="text-text-muted">Description</dt><dd className="text-text-secondary">{p.description}</dd></dl></Card>
          <Card><CardHeader title="Phases et jalons" />
            <ul className="mb-3 space-y-1 text-sm">{p.phases.map((ph) => <li key={ph.id} className="flex justify-between"><span>{ph.name}</span><span className="text-text-muted">{fmtRange(ph.startDate, ph.endDate)}</span></li>)}</ul>
            <ul className="space-y-1.5">{p.milestones.map((m) => <li key={m.id} className="flex items-center justify-between text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={m.done} disabled={!canEdit} onChange={(e) => act((d) => setMilestoneDone(d, id, m.id, e.target.checked))} className="size-4 accent-[var(--color-primary)]" />{m.name}</label><span className="text-text-muted">{fmtDate(m.date)}</span></li>)}</ul></Card>
        </div>
      )}

      {tab === "besoins" && (
        <div className="flex flex-col gap-3">
          {reqs.length === 0 && <EmptyState icon={UserPlus} title="Aucun besoin défini" />}
          {reqs.map(({ req, cov: c }) => (
            <Card key={req.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[16em] flex-1">
                  <p className="text-md font-semibold text-ink">{req.quantity} × {s.grades.find((g) => g.id === req.gradeMin)?.name} <span className="font-normal text-text-secondary">· {fmtPct(req.allocationPct)} · {fmtRange(req.startDate, req.endDate)}</span></p>
                  <p className="mt-1 flex flex-wrap gap-1.5">{req.mandatorySkillIds.map((k) => <Badge key={k} tone="primary">{s.skills.find((x) => x.id === k)?.name}</Badge>)}{req.desiredSkillIds.map((k) => <Badge key={k} tone="neutral">{s.skills.find((x) => x.id === k)?.name} (souhaité)</Badge>)}{!req.mandatorySkillIds.length && !req.desiredSkillIds.length && <span className="text-xs text-text-muted">Aucune compétence précisée</span>}</p>
                </div>
                <div className="w-[14em]"><div className="mb-1 flex justify-between text-xs"><span className="text-text-muted">Couverture</span><span className="tabular-nums text-ink">{c.hard}/{c.quantity} confirmés{c.soft ? ` · ${c.soft} réservé(s)` : ""}</span></div><ProgressBar value={c.rate} tone={c.rate >= 1 ? "ok" : "alert"} label="Couverture du besoin" /></div>
                <span className="flex flex-wrap gap-2">
                  {canAssign && c.missing > 0 && <Button size="sm" icon={<Search className="size-4" />} onClick={() => q.set("matching", req.id)}>Trouver des candidats</Button>}
                  {can("request.create", { projectId: id }) && c.missing > 0 && <Button size="sm" variant="secondary" href={`/app/demandes?nouveau=1&mission=${id}&requirement=${req.id}`}>Créer une demande</Button>}
                  {c.missing === 0 && <StatusPill tone="ok" label="Besoin couvert" />}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "equipe" && (
        <div className="grid gap-4 xl:grid-cols-[1fr_20em]">
          <Card className="!p-0 overflow-hidden"><table className="w-full text-sm"><caption className="sr-only">Équipe affectée</caption>
            <thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="px-4 py-2 text-start font-medium">Collaborateur</th><th className="px-3 text-start font-medium">Statut</th><th className="px-3 text-end font-medium">%</th><th className="px-3 text-end font-medium">Heures</th><th className="px-3 text-start font-medium">Période</th><th className="w-40" /></tr></thead>
            <tbody>{team.length === 0 && <tr><td colSpan={6}><EmptyState icon={UserPlus} title="Aucune affectation" description="Lancez le matching depuis un besoin de staffing." /></td></tr>}
              {team.map(({ a, emp, grade }) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="px-4 py-2"><Link href={`/app/collaborateurs/${emp.id}`} className="inline-flex items-center gap-2 hover:underline"><Avatar person={emp} size="sm" /><span><span className="block font-medium text-ink">{emp.firstName} {emp.lastName}</span><span className="block text-xs text-text-muted">{grade}</span></span></Link></td>
                  <td className="px-3"><span className="flex flex-wrap items-center gap-1.5"><StatusPill tone={a.status === "HARD" ? "ok" : a.status === "SOFT" ? "info" : "neutral"} label={a.status === "HARD" ? "Confirmée" : a.status === "SOFT" ? "Réservation" : "Terminée"} />{a.exceptionReason && <span title={a.exceptionReason}><Badge tone="alert" icon>Exception</Badge></span>}</span>{a.status === "SOFT" && a.softExpiresAt && <span className="block text-2xs text-text-muted">expire {relDays(a.softExpiresAt, s.now)}</span>}</td>
                  <td className="px-3 text-end tabular-nums">{a.allocationPct}%</td>
                  <td className="px-3 text-end tabular-nums">{fmtHours(a.plannedHours)}</td>
                  <td className="px-3 text-xs text-text-secondary">{fmtRange(a.startDate, a.endDate)}</td>
                  <td className="px-3 text-end">{(a.status === "HARD" || a.status === "SOFT") && canAssign && (
                    <span className="flex justify-end gap-1">
                      {a.status === "SOFT" && <Button size="sm" variant="secondary" onClick={() => { const r = act((d) => convertToHard(d, a.id)); if (r.ok) toast({ title: "Réservation confirmée" }); else if (r.code === "NEEDS_EXCEPTION") setPending({ id: a.id, patch: {}, result: r }); else toast({ title: "Refusé", body: r.error, tone: "warning" }); }}>Confirmer</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setEdit(a.id)}>Modifier</Button>
                      <Button size="sm" variant="ghost" aria-label="Proposer un remplacement" title="Proposer un remplacement" onClick={() => { setReplace(a.id); q.set("matching", a.requirementId ?? reqs[0]?.req.id ?? null); }}><UserPlus className="size-4" /></Button>
                      <Button size="sm" variant="ghost" aria-label="Annuler l’affectation" title="Annuler l’affectation" onClick={() => { const r = act((d) => cancelAssignment(d, a.id, "Annulée depuis la fiche mission")); toast({ title: r.ok ? "Affectation annulée" : "Refusé", body: r.ok ? undefined : r.error, tone: r.ok ? "success" : "warning" }); }}><UserMinus className="size-4" /></Button>
                    </span>)}</td>
                </tr>))}</tbody></table></Card>
          <ChartCardLite title="Composition de l’équipe" values={byGrade} />
        </div>
      )}

      {tab === "planning" && <Gantt p={p} team={team.filter((t) => t.a.status !== "ANNULEE")} now={s.now} />}

      {tab === "presence" && (can("workmode.view") ? (team.filter((t) => t.a.status !== "ANNULEE").length === 0 ? <EmptyState icon={Users} title="Aucune personne affectée" description="La présence de l’équipe apparaît ici dès la première affectation." /> : <TeamPresence s={s} people={team.filter((t) => t.a.status !== "ANNULEE").map((t) => t.emp)} />) : <Callout tone="neutral" title="Présence non disponible">Votre profil n’a pas accès à la présence des collaborateurs.</Callout>)}

      {tab === "budget" && (costs ? (
        <div className="grid gap-3 sm:grid-cols-4">{[["Budget de la mission", fmtDZD(costs.budget)], ["Budget ressources", fmtDZD(costs.resourceBudget)], ["Coût planifié (affectations)", fmtDZD(costs.plannedCost)], ["Coût engagé à ce jour", fmtDZD(costs.costToDate)]].map(([l, v]) => <Card key={l} className="!p-4"><p className="text-xs text-text-muted">{l}</p><p className="mt-1 text-xl font-semibold tabular-nums text-ink">{v}</p></Card>)}
          <Card className="sm:col-span-4 !p-4"><p className="text-xs text-text-muted">Marge prévisionnelle (budget − coût planifié)</p><p className="mt-1 text-xl font-semibold tabular-nums text-ink">{fmtDZD(costs.margin)}</p><p className="mt-1 text-xs text-text-secondary">Calculé à partir des affectations confirmées et des coûts journaliers (visibles uniquement avec les droits de coûts).</p></Card></div>
      ) : <Callout tone="neutral" title="Budget et coûts réservés">Votre profil n’a pas accès aux coûts des collaborateurs et au budget de cette mission.</Callout>)}

      {tab === "documents" && (
        <Card><CardHeader title="Documents" action={canEdit && <Button size="sm" variant="secondary" icon={<FileUp className="size-4" />} onClick={() => { const r = act((d) => addProjectDocument(d, id, { name: `Note de cadrage v${projectDocs(s, id).length + 1}.pdf`, kind: "Autre", sizeKb: 120 })); toast({ title: r.ok ? "Document ajouté (simulé)" : "Refusé", body: r.ok ? "Seules les métadonnées sont conservées dans la démonstration." : r.error }); }}>Ajouter un document</Button>} />
          <ul>{projectDocs(s, id).map((d) => <li key={d.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0"><span className="font-medium text-ink">{d.name}</span><span className="text-xs text-text-muted">{d.kind} · {d.sizeKb} Ko · {fmtDate(d.createdAt)}</span></li>)}{projectDocs(s, id).length === 0 && <li className="py-6 text-center text-sm text-text-muted">Aucun document.</li>}</ul></Card>
      )}

      {tab === "historique" && (
        <Card><CardHeader title="Historique" description="Journal d’audit de cette mission, de ses affectations et de ses demandes" />
          <ol className="space-y-3">{missionHistory(s, id).map((a) => <li key={a.id} className="border-l-2 border-border pl-3 text-sm"><p className="font-medium text-ink">{a.label ?? a.action}</p><p className="text-xs text-text-muted">{fmtDate(a.ts)} · {a.action}{a.actorId ? ` · ${s.users.find((u) => u.id === a.actorId)?.firstName ?? a.actorId}` : ""}</p>{a.reason && <p className="mt-1 rounded bg-alert-bg px-2 py-1 text-xs text-alert">Motif : {a.reason}</p>}</li>)}{missionHistory(s, id).length === 0 && <li className="text-sm text-text-muted">Aucun événement.</li>}</ol></Card>
      )}

      <MatchingDrawer open={!!matching} onClose={() => { setReplace(null); q.set("matching", null); }} requirementId={matching} replaceAssignmentId={replace ?? undefined} />
      <ExceptionModal open={!!pending} result={pending?.result ?? null} onCancel={() => setPending(null)} onConfirm={(r) => { const pd = pending!; setPending(null); if (Object.keys(pd.patch).length) apply(pd.id, pd.patch, r); else { const x = act((d) => convertToHard(d, pd.id, r)); toast({ title: x.ok ? "Réservation confirmée (exception)" : "Refusé", body: x.ok ? undefined : x.error }); } }} />
      {editing && <EditAssignmentModal key={editing.id} a={editing} name={nameOf(s, editing.employeeId)} onClose={() => setEdit(null)} onSave={(patch) => apply(editing.id, patch)} />}
      <Modal open={cancelling} onClose={() => setCancelling(false)} title="Annuler la mission ?" subtitle="Les affectations actives seront annulées. Action journalisée." footer={<><Button variant="secondary" onClick={() => setCancelling(false)}>Retour</Button><Button variant="danger" disabled={reason.trim().length < 10} onClick={() => { const r = act((d) => setProjectStatus(d, id, "ANNULEE", reason.trim())); if (r.ok) { setCancelling(false); toast({ title: "Mission annulée" }); router.push("/app/missions"); } else toast({ title: "Refusé", body: r.error, tone: "warning" }); }}>Annuler la mission</Button></>}>
        <TextArea label="Motif (obligatoire)" required rows={3} value={reason} onChange={setReason} hint="10 caractères minimum." />
      </Modal>
      <span hidden>{raw.id}</span>
    </>
  );
}
function EditAssignmentModal({ a, name, onClose, onSave }: { a: { startDate: string; endDate: string; allocationPct: number }; name: string; onClose: () => void; onSave: (p: AssignmentPatch) => void }) {
  const [v, setV] = useState({ start: a.startDate, end: a.endDate, pct: a.allocationPct });
  return (
    <Modal open onClose={onClose} title="Modifier l’affectation" subtitle={name} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => onSave({ startDate: v.start, endDate: v.end, allocationPct: v.pct })}>Enregistrer</Button></>}>
      <div className="flex flex-col gap-4"><DateRangeInput start={v.start} end={v.end} onChange={(st, en) => setV({ ...v, start: st, end: en })} /><NumberInput label="Allocation" suffix="%" min={5} max={100} step={5} value={v.pct} onChange={(n) => setV({ ...v, pct: n })} /></div>
    </Modal>
  );
}
function ChartCardLite({ title, values }: { title: string; values: { label: string; value: number }[] }) {
  return <Card><CardHeader title={title} />{values.length ? <Bars id={`team-${title}`} horizontal labels={values.map((v) => v.label)} series={[{ name: "Personnes", values: values.map((v) => v.value) }]} /> : <p className="text-sm text-text-muted">Aucune personne affectée.</p>}</Card>;
}

function Gantt({ p, team, now }: { p: ReturnType<typeof projectById> & object; team: ReturnType<typeof missionTeam>; now: string }) {
  const t0 = Date.parse(p.startDate), t1 = Date.parse(p.endDate);
  const span = Math.max(1, t1 - t0);
  const pos = (d: string) => Math.max(0, Math.min(100, ((Date.parse(d) - t0) / span) * 100));
  const rowH = 30;
  const rows = [...p.phases.map((x) => ({ k: x.id, label: x.name, from: x.startDate, to: x.endDate, tone: "phase" as const })), ...team.map((t) => ({ k: t.a.id, label: `${t.emp.firstName} ${t.emp.lastName} · ${t.a.allocationPct}%`, from: t.a.startDate < p.startDate ? p.startDate : t.a.startDate, to: t.a.endDate > p.endDate ? p.endDate : t.a.endDate, tone: t.a.status }))];
  return (
    <Card><CardHeader title="Planning de la mission" description="Phases, jalons et équipe sur la période de la mission" />
      <div className="relative" role="img" aria-label="Diagramme de Gantt de la mission">
        <div className="grid grid-cols-[13em_1fr] text-xs">
          {rows.map((r) => (<div key={r.k} className="contents"><div className="flex items-center truncate pe-2 text-text-secondary" style={{ height: rowH }}>{r.label}</div><div className="relative border-t border-line" style={{ height: rowH }}><div className={`absolute top-1.5 h-[1.4em] rounded-md border text-2xs ${r.tone === "phase" ? "border-primary bg-primary/85" : r.tone === "SOFT" ? "border-dashed border-info bg-[image:var(--hatch-soft)] bg-info-bg" : "border-ok bg-ok/15"}`} style={{ left: `${pos(r.from)}%`, width: `${Math.max(1.5, pos(r.to) - pos(r.from))}%` }} /></div></div>))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 start-[13em] end-0">
          {p.milestones.map((m) => <span key={m.id} title={`${m.name} — ${fmtDate(m.date)}`} className={`absolute top-0 size-3 -translate-x-1/2 rotate-45 ${m.done ? "bg-ok" : "bg-primary"}`} style={{ left: `${pos(m.date)}%` }} />)}
          {now >= p.startDate && now <= p.endDate && <span className="absolute inset-y-0 w-0.5 bg-info" style={{ left: `${pos(now)}%` }}><span className="absolute -top-0.5 start-1 rounded bg-info px-1 text-2xs text-white">Auj.</span></span>}
        </div>
      </div>
      <p className="mt-3 text-2xs text-text-muted">Losanges = jalons (verts : atteints) · barre pleine = affectation confirmée · hachurée = réservation · ligne bleue = aujourd’hui ({fmtDateShort(now)}).</p>
    </Card>
  );
}
