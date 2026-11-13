"use client";
import { MessageSquare, Plus, Search, Send } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { addRequestComment, approveRequest, cancelRequest, createRequest, REQUEST_TRANSITIONS, rejectRequest, requestTransitionDenied, returnToAnalysis, sendProposal, sendToValidation, setProposedEmployees, submitRequest, takeRequest, type RequestInput } from "@/lib/store/actions/requests";
import { nameOf, visibleRequests } from "@/lib/store/selectors/core";
import { requirementCoverage } from "@/lib/engine/booking";
import { fmtDate, fmtDateShort, fmtPct, fmtRange } from "@/lib/engine/format";
import { PersonCell } from "@/components/shared/PersonCell";
import { MatchingDrawer } from "@/components/matching/MatchingDrawer";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox, DateRangeInput, MultiSelect, NumberInput } from "@/components/ui/Controls";
import { DataTable, SavedViews, type Column } from "@/components/ui/DataTable";
import { SearchInput, SelectInput, TextArea } from "@/components/ui/FormInputs";
import { Callout, Card, CardHeader, EmptyState, PageHeader, Skeleton } from "@/components/ui/Surface";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { useFirstLoad } from "@/components/app/useSkeleton";
import { PRIORITY, REQUEST_STATUS } from "@/lib/ui-domain";
import type { AppState, Priority, RequestStatus, StaffingRequest } from "@/lib/store/types";
import type { Result } from "@/lib/store/actions/core";
import { Inbox } from "lucide-react";

type View = "toutes" | "ouvertes" | "attente" | "mes" | "terminees";
const OPEN: RequestStatus[] = ["SOUMISE", "EN_ANALYSE", "PROPOSITION_ENVOYEE", "EN_ATTENTE_VALIDATION", "APPROUVEE"];

export function RequestsPage() {
  const { s, can, me } = useSession();
  const q = useQueryState();
  const router = useRouter();
  const loading = useFirstLoad();
  const rows = visibleRequests(s);
  const view = (q.get("vue") || (can("request.process") ? "ouvertes" : "mes")) as View;
  const text = q.get("q").toLowerCase();
  const inView = (r: StaffingRequest) => view === "toutes" || (view === "ouvertes" && OPEN.includes(r.status)) || (view === "attente" && r.status === "EN_ATTENTE_VALIDATION") || (view === "mes" && r.requesterId === me?.employeeId) || (view === "terminees" && !OPEN.includes(r.status) && r.status !== "BROUILLON");
  const filtered = rows.filter((r) => inView(r) && (!q.get("priorite") || r.priority === q.get("priorite")) && (!q.get("statut") || r.status === q.get("statut")) && (!text || `${r.reference} ${s.projects.find((p) => p.id === r.projectId)?.name}`.toLowerCase().includes(text)));
  const create = q.get("nouveau") === "1" && can("request.create");
  const cols: Column<StaffingRequest>[] = [
    { key: "ref", header: "Référence", cell: (r) => <span className="font-mono text-xs font-medium">{r.reference}</span>, sort: (a, b) => a.reference.localeCompare(b.reference), csv: (r) => r.reference },
    { key: "mission", header: "Mission", required: true, cell: (r) => <span className="font-medium text-ink">{s.projects.find((p) => p.id === r.projectId)?.name}</span>, csv: (r) => s.projects.find((p) => p.id === r.projectId)?.name },
    { key: "need", header: "Besoin", cell: (r) => `${r.quantity} × ${s.grades.find((g) => g.id === r.gradeId)?.name} · ${fmtPct(r.allocationPct)}`, csv: (r) => `${r.quantity} x ${s.grades.find((g) => g.id === r.gradeId)?.name}` },
    { key: "period", header: "Période", cell: (r) => fmtRange(r.startDate, r.endDate), hideBelow: "lg", sort: (a, b) => a.startDate.localeCompare(b.startDate), csv: (r) => `${r.startDate} → ${r.endDate}` },
    { key: "req", header: "Demandeur", cell: (r) => nameOf(s, r.requesterId), hideBelow: "md", csv: (r) => nameOf(s, r.requesterId) },
    { key: "prio", header: "Priorité", cell: (r) => <StatusPill tone={PRIORITY[r.priority].tone} label={PRIORITY[r.priority].label} />, sort: (a, b) => ["BASSE", "NORMALE", "HAUTE", "URGENTE"].indexOf(b.priority) - ["BASSE", "NORMALE", "HAUTE", "URGENTE"].indexOf(a.priority), csv: (r) => PRIORITY[r.priority].label },
    { key: "status", header: "Statut", cell: (r) => <StatusPill tone={REQUEST_STATUS[r.status].tone} label={REQUEST_STATUS[r.status].label} />, csv: (r) => REQUEST_STATUS[r.status].label },
  ];
  const counts: Record<View, number> = { toutes: rows.length, ouvertes: rows.filter((r) => OPEN.includes(r.status)).length, attente: rows.filter((r) => r.status === "EN_ATTENTE_VALIDATION").length, mes: rows.filter((r) => r.requesterId === me?.employeeId).length, terminees: rows.filter((r) => !OPEN.includes(r.status) && r.status !== "BROUILLON").length };
  const views: { value: View; label: string }[] = [{ value: "ouvertes", label: "Ouvertes" }, { value: "attente", label: "À valider" }, ...(can("request.create") ? [{ value: "mes" as View, label: "Mes demandes" }] : []), { value: "terminees", label: "Clôturées" }, { value: "toutes", label: "Toutes" }];
  return (
    <>
      <PageHeader title="Demandes de staffing" description={can("request.process") ? "File de traitement du Resource Manager : analyser, proposer, valider, suivre jusqu’à la satisfaction du besoin." : "Vos demandes de ressources, leur avancement et les propositions reçues."} actions={can("request.create") && <Button icon={<Plus className="size-4" />} onClick={() => q.set("nouveau", "1")}>Nouvelle demande</Button>} />
      <SavedViews value={view} onChange={(v) => q.set("vue", v)} views={views.map((v) => ({ ...v, count: counts[v.value] }))} />
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <DataTable rows={filtered} columns={cols} getId={(r) => r.id} caption="Demandes de staffing" exportName="demandes-staffing" onRowClick={(r) => router.push(`/app/demandes/${r.id}`)} defaultSort={{ key: "prio", dir: "asc" }}
          toolbar={<><SearchInput className="w-[16em]" value={q.get("q")} onChange={(v) => q.set("q", v || null)} placeholder="Rechercher une demande…" /><SelectInput label="" value={q.get("priorite")} onChange={(v) => q.set("priorite", v || null)} options={[{ value: "", label: "Toutes priorités" }, ...Object.entries(PRIORITY).map(([k, v]) => ({ value: k, label: v.label }))]} /></>}
          empty={<EmptyState icon={Inbox} title="Aucune demande" description="Aucune demande dans cette vue." action={can("request.create") ? <Button onClick={() => q.set("nouveau", "1")}>Créer une demande</Button> : undefined} />} />
      )}
      {create && <RequestForm onClose={() => q.setMany({ nouveau: null, mission: null, requirement: null })} presetMission={q.get("mission")} presetReq={q.get("requirement")} onDone={(id) => router.push(`/app/demandes/${id}`)} />}
    </>
  );
}

function RequestForm({ onClose, presetMission, presetReq, onDone }: { onClose: () => void; presetMission: string; presetReq: string; onDone: (id: string) => void }) {
  const { s, can } = useSession();
  const toast = useToast();
  const projects = s.projects.filter((p) => p.status !== "TERMINEE" && p.status !== "ANNULEE" && can("request.create", { projectId: p.id }));
  const r0 = s.requirements.find((r) => r.id === presetReq);
  const [v, setV] = useState({ projectId: presetMission || r0?.projectId || "", requirementId: r0?.id ?? "", gradeId: r0?.gradeMin ?? "g-3", quantity: 1, skillIds: r0?.mandatorySkillIds ?? [], start: r0?.startDate ?? s.now, end: r0?.endDate ?? s.now, pct: r0?.allocationPct ?? 100, load: 40, priority: "NORMALE" as Priority, justification: "" });
  const [err, setErr] = useState<string | null>(null);
  const reqs = s.requirements.filter((r) => r.projectId === v.projectId && requirementCoverage(s, r).missing > 0);
  const send = (submit: boolean) => {
    const input: RequestInput = { projectId: v.projectId, requirementId: v.requirementId || undefined, gradeId: v.gradeId, quantity: v.quantity, skillIds: v.skillIds, startDate: v.start, endDate: v.end, allocationPct: v.pct, estimatedLoad: v.load, priority: v.priority, justification: v.justification };
    const r = act((d) => createRequest(d, input, { submit }));
    if (!r.ok) return setErr(r.error);
    toast({ title: submit ? "Demande envoyée" : "Brouillon enregistré", body: submit ? "Elle apparaît dans la file du Resource Manager." : undefined });
    onClose();
    onDone(r.value.id);
  };
  return (
    <Drawer open onClose={onClose} dirty={!!v.justification} width="44em" title="Nouvelle demande de staffing" footer={<><Button variant="secondary" onClick={() => send(false)}>Enregistrer en brouillon</Button><span className="flex gap-2"><Button variant="ghost" onClick={onClose}>Annuler</Button><Button icon={<Send className="size-4" />} onClick={() => send(true)}>Soumettre</Button></span></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        {err && <div className="sm:col-span-2"><Callout tone="danger">{err}</Callout></div>}
        <div className="sm:col-span-2"><Combobox label="Mission" required value={v.projectId} onChange={(x) => setV({ ...v, projectId: x, requirementId: "" })} options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.reference }))} /></div>
        {reqs.length > 0 && <div className="sm:col-span-2"><Combobox label="Besoin concerné (préremplit la demande)" value={v.requirementId} onChange={(x) => { const r = reqs.find((q) => q.id === x)!; setV({ ...v, requirementId: x, gradeId: r.gradeMin, skillIds: r.mandatorySkillIds, start: r.startDate, end: r.endDate, pct: r.allocationPct }); }} options={reqs.map((r) => ({ value: r.id, label: `${r.quantity} × ${s.grades.find((g) => g.id === r.gradeMin)?.name} · ${r.allocationPct} % · ${fmtRange(r.startDate, r.endDate)}` }))} /></div>}
        <SelectInput label="Grade" value={v.gradeId} onChange={(x) => setV({ ...v, gradeId: x })} options={s.grades.map((g) => ({ value: g.id, label: g.name }))} />
        <NumberInput label="Quantité" min={1} value={v.quantity} onChange={(n) => setV({ ...v, quantity: n })} />
        <div className="sm:col-span-2"><MultiSelect label="Compétences" values={v.skillIds} onChange={(x) => setV({ ...v, skillIds: x })} options={s.skills.map((k) => ({ value: k.id, label: k.name }))} /></div>
        <div className="sm:col-span-2"><DateRangeInput start={v.start} end={v.end} onChange={(st, en) => setV({ ...v, start: st, end: en })} /></div>
        <NumberInput label="Allocation" suffix="%" min={5} max={100} step={5} value={v.pct} onChange={(n) => setV({ ...v, pct: n })} />
        <NumberInput label="Charge estimée" suffix="j" min={1} value={v.load} onChange={(n) => setV({ ...v, load: n })} />
        <SelectInput label="Priorité" value={v.priority} onChange={(x) => setV({ ...v, priority: x as Priority })} options={Object.entries(PRIORITY).map(([k, p]) => ({ value: k, label: p.label }))} />
        <div className="sm:col-span-2"><TextArea label="Justification" required rows={3} value={v.justification} onChange={(x) => setV({ ...v, justification: x })} hint="10 caractères minimum — elle est lue par le Resource Manager." /></div>
      </div>
    </Drawer>
  );
}

export function RequestDetail({ id }: { id: string }) {
  const { s, can } = useSession();
  const q = useQueryState();
  const toast = useToast();
  const r = visibleRequests(s).find((x) => x.id === id);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [ask, setAsk] = useState<null | { to: "REJETEE" | "EN_ANALYSE" }>(null);
  const [reason, setReason] = useState("");
  const [pick, setPick] = useState(false);
  const req = r?.requirementId ? s.requirements.find((x) => x.id === r.requirementId) : undefined;
  const cov = req ? requirementCoverage(s, req) : undefined;
  const matching = q.get("matching") || null;
  const actions = useMemo(() => (r ? REQUEST_TRANSITIONS[r.status].filter((to) => !requestTransitionDenied(s, r, to)) : []), [s, r]);
  if (!r) return <EmptyState icon={Inbox} title="Demande introuvable ou hors de votre périmètre" action={<Button href="/app/demandes" variant="secondary">Retour</Button>} className="py-20" />;
  const project = s.projects.find((p) => p.id === r.projectId);
  const exec = (fn: (d: AppState) => Result<unknown>, okMsg: string) => {
    const x = act(fn);
    toast({ title: x.ok ? okMsg : "Refusé", body: x.ok ? undefined : x.error, tone: x.ok ? "success" : "warning" });
  };
  const go = (to: RequestStatus) => {
    if (to === "REJETEE" || (to === "EN_ANALYSE" && r.status !== "SOUMISE")) return setAsk({ to });
    if (to === "EN_ANALYSE") return exec((d) => takeRequest(d, id), "Demande prise en charge");
    if (to === "PROPOSITION_ENVOYEE") return exec((d) => sendProposal(d, id, note), "Proposition envoyée");
    if (to === "EN_ATTENTE_VALIDATION") return exec((d) => sendToValidation(d, id, note), "Envoyée en validation");
    if (to === "APPROUVEE") return exec((d) => approveRequest(d, id, note), "Proposition approuvée");
    if (to === "ANNULEE") return exec((d) => cancelRequest(d, id, "Annulée par l’utilisateur"), "Demande annulée");
    if (to === "SOUMISE") return exec((d) => submitRequest(d, id), "Demande soumise");
  };
  const LABEL: Partial<Record<RequestStatus, string>> = { SOUMISE: "Soumettre", EN_ANALYSE: r.status === "SOUMISE" ? "Prendre en charge" : "Renvoyer en analyse", PROPOSITION_ENVOYEE: "Envoyer la proposition", EN_ATTENTE_VALIDATION: "Envoyer en validation", APPROUVEE: "Approuver", REJETEE: "Rejeter", ANNULEE: "Annuler la demande" };
  return (
    <>
      <PageHeader breadcrumb={[{ label: "Demandes", href: "/app/demandes" }, { label: r.reference }]} title={`${r.reference} — ${project?.name}`} description={`Demandée par ${nameOf(s, r.requesterId)} le ${fmtDate(r.createdAt)}`} actions={<span className="flex items-center gap-2"><StatusPill tone={PRIORITY[r.priority].tone} label={PRIORITY[r.priority].label} /><StatusPill tone={REQUEST_STATUS[r.status].tone} label={REQUEST_STATUS[r.status].label} /></span>} />
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card><CardHeader title="Besoin" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm"><dt className="text-text-muted">Profil</dt><dd>{r.quantity} × {s.grades.find((g) => g.id === r.gradeId)?.name} · {fmtPct(r.allocationPct)}</dd><dt className="text-text-muted">Période</dt><dd>{fmtRange(r.startDate, r.endDate)}</dd><dt className="text-text-muted">Charge estimée</dt><dd>{r.estimatedLoad} jours</dd><dt className="text-text-muted">Compétences</dt><dd className="flex flex-wrap gap-1.5">{r.skillIds.map((k) => <Badge key={k} tone="primary">{s.skills.find((x) => x.id === k)?.name}</Badge>)}{!r.skillIds.length && "—"}</dd><dt className="text-text-muted">Justification</dt><dd className="text-text-secondary">{r.justification || "—"}</dd></dl>
            {cov && <p className="mt-3 text-sm">Couverture du besoin : <span className="font-medium tabular-nums">{cov.hard}/{cov.quantity}</span> confirmé(s){cov.soft ? `, ${cov.soft} réservé(s)` : ""}. {cov.missing === 0 && <Badge tone="ok" icon>Besoin couvert</Badge>}</p>}</Card>
          <Card><CardHeader title="Candidats proposés" action={can("request.process", { projectId: r.projectId }) && req && ["SOUMISE", "EN_ANALYSE", "PROPOSITION_ENVOYEE"].includes(r.status) && <span className="flex gap-2"><Button size="sm" variant="secondary" icon={<Search className="size-4" />} onClick={() => q.set("matching", req.id)}>Trouver des candidats</Button><Button size="sm" variant="secondary" onClick={() => setPick(true)}>Choisir la liste</Button></span>} />
            {r.proposedEmployeeIds.length === 0 ? <p className="text-sm text-text-muted">Aucun candidat proposé pour l’instant.</p> : <ul className="flex flex-col gap-2">{r.proposedEmployeeIds.map((id2) => { const e = s.employees.find((x) => x.id === id2); return e ? <li key={id2} className="flex items-center justify-between rounded-md border border-border px-3 py-2"><PersonCell person={e} href={`/app/collaborateurs/${id2}`} sub={s.grades.find((g) => g.id === e.gradeId)?.name} /></li> : null; })}</ul>}
            <p className="mt-3 text-xs text-text-muted">Les affectations se créent depuis le moteur de staffing, jamais automatiquement : une proposition approuvée est ensuite confirmée par le Resource Manager.</p></Card>
          <Card><CardHeader title="Commentaires" />
            <ul className="mb-3 flex flex-col gap-3">{r.comments.map((c) => <li key={c.id} className="rounded-md bg-canvas px-3 py-2 text-sm"><p className="text-xs text-text-muted">{s.users.find((u) => u.id === c.authorId)?.firstName} {s.users.find((u) => u.id === c.authorId)?.lastName} · {fmtDateShort(c.ts)}</p>{c.text}</li>)}{!r.comments.length && <li className="text-sm text-text-muted">Aucun commentaire.</li>}</ul>
            <div className="flex gap-2"><div className="flex-1"><TextArea label="" rows={2} value={comment} onChange={setComment} placeholder="Ajouter un commentaire…" /></div><Button icon={<MessageSquare className="size-4" />} disabled={!comment.trim()} onClick={() => { const x = act((d) => addRequestComment(d, id, comment)); if (x.ok) { setComment(""); toast({ title: "Commentaire ajouté" }); } else toast({ title: "Refusé", body: x.error, tone: "warning" }); }}>Publier</Button></div></Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card><CardHeader title="Décision" description="Les actions affichées dépendent de votre profil et du statut" />
            {actions.length === 0 ? <p className="text-sm text-text-muted">Aucune action disponible à ce stade.</p> : (
              <div className="flex flex-col gap-3">
                {(actions.includes("PROPOSITION_ENVOYEE") || actions.includes("EN_ATTENTE_VALIDATION") || actions.includes("APPROUVEE")) && <TextArea label="Note (optionnelle)" rows={2} value={note} onChange={setNote} />}
                <div className="flex flex-wrap gap-2">{actions.map((to) => <Button key={to} variant={to === "REJETEE" || to === "ANNULEE" ? "secondary" : "primary"} onClick={() => go(to)}>{LABEL[to] ?? to}</Button>)}</div>
              </div>)}
          </Card>
          <Card><CardHeader title="Historique" /><ol className="space-y-3">{[...r.history].reverse().map((h, i) => <li key={i} className="border-l-2 border-border pl-3 text-sm"><StatusPill tone={REQUEST_STATUS[h.status].tone} label={REQUEST_STATUS[h.status].label} /><p className="mt-1 text-xs text-text-muted">{fmtDate(h.ts)} · {h.actorId === "system" ? "Système" : s.users.find((u) => u.id === h.actorId)?.firstName ?? h.actorId}</p>{h.note && <p className="mt-0.5 text-xs text-text-secondary">{h.note}</p>}</li>)}</ol></Card>
        </div>
      </div>
      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask?.to === "REJETEE" ? "Rejeter la demande" : "Renvoyer en analyse"} subtitle="Un motif écrit est obligatoire et journalisé" footer={<><Button variant="secondary" onClick={() => setAsk(null)}>Retour</Button><Button variant={ask?.to === "REJETEE" ? "danger" : "primary"} disabled={reason.trim().length < 10} onClick={() => { const to = ask!.to; const x = act((d) => (to === "REJETEE" ? rejectRequest(d, id, reason) : returnToAnalysis(d, id, reason))); toast({ title: x.ok ? "Décision enregistrée" : "Refusé", body: x.ok ? undefined : x.error, tone: x.ok ? "success" : "warning" }); if (x.ok) { setAsk(null); setReason(""); } }}>Confirmer</Button></>}>
        <TextArea label="Motif" required rows={3} value={reason} onChange={setReason} hint="10 caractères minimum." />
      </Modal>
      <ProposeModal open={pick} onClose={() => setPick(false)} r={r} />
      <MatchingDrawer open={!!matching} onClose={() => q.set("matching", null)} requirementId={matching} />
    </>
  );
}

function ProposeModal({ open, onClose, r }: { open: boolean; onClose: () => void; r: StaffingRequest }) {
  const { s } = useSession();
  const toast = useToast();
  const [ids, setIds] = useState(r.proposedEmployeeIds);
  if (!open) return null;
  return (
    <Modal open onClose={onClose} title="Candidats proposés" subtitle="Sélectionnez les personnes à proposer au demandeur" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => { const x = act((d) => setProposedEmployees(d, r.id, ids)); toast({ title: x.ok ? "Liste enregistrée" : "Refusé", body: x.ok ? undefined : x.error }); if (x.ok) onClose(); }}>Enregistrer</Button></>}>
      <MultiSelect values={ids} onChange={setIds} placeholder="Ajouter un candidat" options={s.employees.filter((e) => e.status !== "ARCHIVE").map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName} — ${s.grades.find((g) => g.id === e.gradeId)?.name}` }))} />
    </Modal>
  );
}
void Link;
