"use client";
import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { createEvaluation } from "@/lib/store/actions/evaluations";
import { CRITERION_LABEL, evaluatedPeople, pendingEvaluations, RATING_LABEL, type PendingEvaluation } from "@/lib/store/selectors/evaluations";
import { visibleEvaluations } from "@/lib/store/selectors/core";
import { EVAL_CRITERIA, type EvalCriterion } from "@/lib/store/types";
import { fmtDate } from "@/lib/engine/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextArea } from "@/components/ui/FormInputs";
import { Callout, Card, EmptyState, PageHeader } from "@/components/ui/Surface";
import { Drawer } from "@/components/ui/Overlay";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";

/** LIGHT evaluations (spec 8.13): 8 optional ratings, text, confidentiality — no weights, no global score, not a 360° tool. */
export function EvaluationsPage() {
  const { s, can, me } = useSession();
  const q = useQueryState();
  const toast = useToast();
  const [form, setForm] = useState<PendingEvaluation | null>(null);
  const pending = can("evaluation.create") ? pendingEvaluations(s) : [];
  const rows = evaluatedPeople(s);
  const mine = me?.role === "COLLABORATEUR";
  const tab = q.get("onglet") || (pending.length ? "a-evaluer" : "historique");
  return (
    <>
      <PageHeader title={mine ? "Mes évaluations" : "Évaluations de fin de mission"} description="Évaluation légère : notes optionnelles de 1 à 5, points forts, axes de progrès et recommandation de formation. Pas de score global, pas de pondération — ce n’est pas un outil 360°." />
      {!mine && <Tabs label="Vues" value={tab} onChange={(v) => q.set("onglet", v)} className="mb-5" items={[...(can("evaluation.create") ? [{ value: "a-evaluer", label: "À évaluer", count: pending.length }] : []), { value: "historique", label: "Historique" }]} />}
      {tab === "a-evaluer" && !mine ? (
        pending.length === 0 ? <EmptyState icon={ClipboardCheck} title="Aucune évaluation en attente" description="Les personnes ayant terminé une mission apparaissent ici." /> : (
          <Card className="!p-0"><table className="w-full text-sm"><caption className="sr-only">Évaluations à réaliser</caption><thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="px-4 py-2 text-start font-medium">Collaborateur</th><th className="px-3 text-start font-medium">Mission</th><th className="px-3 text-start font-medium">Fin</th><th className="w-32" /></tr></thead><tbody>{pending.map((p) => <tr key={p.key} className="border-t border-line"><td className="px-4 py-2"><Link href={`/app/collaborateurs/${p.employeeId}`} className="font-medium text-ink hover:underline">{p.employeeName}</Link><span className="block text-xs text-text-muted">{p.gradeName}</span></td><td className="px-3">{p.projectName}<span className="block text-xs text-text-muted">{p.reference}</span></td><td className="px-3 tabular-nums">{fmtDate(p.endDate)}</td><td className="px-3 text-end"><Button size="sm" onClick={() => setForm(p)}>Évaluer</Button></td></tr>)}</tbody></table></Card>
        )
      ) : (
        rows.length === 0 ? <EmptyState icon={ClipboardCheck} title="Aucune évaluation visible" description="Les évaluations confidentielles ne sont lisibles que par leur auteur, les Partners et les RH." /> : (
          <div className="grid gap-4">{rows.map((r) => <Card key={r.employeeId}><div className="flex flex-wrap items-center justify-between gap-3"><div><Link href={`/app/collaborateurs/${r.employeeId}?tab=evaluations`} className="text-md font-semibold text-ink hover:underline">{r.name}</Link><p className="text-xs text-text-muted">{r.gradeName} · {r.departmentName} · dernière : {r.lastProject} ({fmtDate(r.lastDate)})</p></div><span className="flex gap-2"><Badge tone="info">{r.count} évaluation(s)</Badge>{r.confidentialCount > 0 && <Badge tone="alert" icon>{r.confidentialCount} confidentielle(s)</Badge>}<Button size="sm" variant="secondary" href={`/app/collaborateurs/${r.employeeId}?tab=evaluations`}>Voir la synthèse</Button></span></div></Card>)}</div>
        )
      )}
      {form && <EvalForm p={form} onClose={() => setForm(null)} onDone={() => { toast({ title: "Évaluation enregistrée", body: "Journalisée dans l’audit." }); setForm(null); }} />}
      <span hidden>{visibleEvaluations(s).length}</span>
    </>
  );
}

function EvalForm({ p, onClose, onDone }: { p: PendingEvaluation; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [r, setR] = useState<Partial<Record<EvalCriterion, 1 | 2 | 3 | 4 | 5>>>({});
  const [t, setT] = useState({ strengths: "", improvements: "", training: "" });
  const [conf, setConf] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Drawer open onClose={onClose} dirty width="40em" title="Évaluation de fin de mission" subtitle={`${p.employeeName} — ${p.projectName}`} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => { const x = act((d) => createEvaluation(d, { employeeId: p.employeeId, projectId: p.projectId, criteria: r, strengths: t.strengths, improvements: t.improvements, trainingRecommendation: t.training, confidential: conf })); if (x.ok) onDone(); else { setErr(x.error); toast({ title: "Refusé", body: x.error, tone: "warning" }); } }}>Enregistrer</Button></>}>
      <div className="flex flex-col gap-5">
        {err && <Callout tone="danger">{err}</Callout>}
        <Callout tone="neutral">Toutes les notes sont optionnelles. Aucune moyenne globale n’est calculée ; la synthèse affiche seulement des moyennes par critère.</Callout>
        <div className="flex flex-col gap-3">{EVAL_CRITERIA.map((c) => <fieldset key={c} className="flex flex-wrap items-center justify-between gap-2"><legend className="sr-only">{CRITERION_LABEL[c]}</legend><span className="text-sm font-medium text-ink">{CRITERION_LABEL[c]}</span><span className="flex gap-1" role="radiogroup" aria-label={CRITERION_LABEL[c]}>{([1, 2, 3, 4, 5] as const).map((n) => <button key={n} type="button" role="radio" aria-checked={r[c] === n} title={RATING_LABEL[n]} onClick={() => setR({ ...r, [c]: r[c] === n ? undefined : n })} className={`size-8 rounded-md border text-sm font-medium tabular-nums ${r[c] === n ? "border-primary bg-primary text-white" : "border-border-strong bg-bg text-text-secondary hover:border-primary"}`}>{n}</button>)}</span></fieldset>)}</div>
        <TextArea label="Points forts" rows={2} value={t.strengths} onChange={(v) => setT({ ...t, strengths: v })} /><TextArea label="Axes de progrès" rows={2} value={t.improvements} onChange={(v) => setT({ ...t, improvements: v })} /><TextArea label="Recommandation de formation" rows={2} value={t.training} onChange={(v) => setT({ ...t, training: v })} />
        <Checkbox checked={conf} onChange={setConf} label="Évaluation confidentielle — visible uniquement par moi, les Partners et les RH" />
      </div>
    </Drawer>
  );
}
