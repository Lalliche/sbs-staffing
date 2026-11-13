"use client";
import { CalendarClock, Plus, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { applyToOpportunity, closeOpportunity, publishOpportunity, reviewApplication, withdrawApplication } from "@/lib/store/actions/marketplace";
import { requirementLike, scoreCandidate } from "@/lib/engine/matching";
import { addDays } from "@/lib/engine/dates";
import { fmtDate, fmtPct, fmtRange, relDays } from "@/lib/engine/format";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DateInput, DateRangeInput, MultiSelect, NumberInput } from "@/components/ui/Controls";
import { SearchInput, SelectInput, TextArea, TextInput } from "@/components/ui/FormInputs";
import { Callout, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/Surface";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { useFirstLoad } from "@/components/app/useSkeleton";
import { PersonCell } from "@/components/shared/PersonCell";
import { Store } from "lucide-react";
import type { Opportunity } from "@/lib/store/types";

const APP_TONE = { ENVOYEE: "info", PRESELECTIONNEE: "ok", NON_RETENUE: "neutral", RETIREE: "neutral" } as const;
const APP_LABEL = { ENVOYEE: "Envoyée", PRESELECTIONNEE: "Présélectionnée", NON_RETENUE: "Non retenue", RETIREE: "Retirée" } as const;

export function MarketplacePage() {
  const { s, can, emp } = useSession();
  const q = useQueryState();
  const toast = useToast();
  const loading = useFirstLoad();
  const [apply, setApply] = useState<Opportunity | null>(null);
  const [motivation, setMotivation] = useState("");
  const [review, setReview] = useState<Opportunity | null>(null);
  const text = q.get("q").toLowerCase();
  const list = s.opportunities.filter((o) => (!q.get("dept") || o.departmentId === q.get("dept")) && (!q.get("skill") || o.skillIds.includes(q.get("skill"))) && (!text || `${o.title} ${o.description}`.toLowerCase().includes(text)));
  const mine = s.applications.filter((a) => a.employeeId === emp?.id);
  const myLevels = new Map(s.employeeSkills.filter((x) => x.employeeId === emp?.id).map((x) => [x.skillId, x.level]));
  const create = q.get("nouveau") === "1" && can("marketplace.publish");
  return (
    <>
      <PageHeader title="Talent marketplace" description="Opportunités de missions ouvertes aux collaborateurs. Une candidature n’affecte personne : la décision reste à un utilisateur habilité, via le moteur de staffing." actions={can("marketplace.publish") && <Button icon={<Plus className="size-4" />} onClick={() => q.set("nouveau", "1")}>Publier une opportunité</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3"><SearchInput className="w-[18em]" value={q.get("q")} onChange={(v) => q.set("q", v || null)} placeholder="Rechercher une opportunité…" /><SelectInput label="" value={q.get("dept")} onChange={(v) => q.set("dept", v || null)} options={[{ value: "", label: "Tous les départements" }, ...s.departments.map((d) => ({ value: d.id, label: d.name }))]} /><SelectInput label="" value={q.get("skill")} onChange={(v) => q.set("skill", v || null)} options={[{ value: "", label: "Toutes les compétences" }, ...s.skills.filter((k) => s.opportunities.some((o) => o.skillIds.includes(k.id))).map((k) => ({ value: k.id, label: k.name }))]} /></div>
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <div className="grid gap-4 xl:grid-cols-[1fr_22em]">
          <div className="grid gap-4 md:grid-cols-2">
            {list.length === 0 && <div className="md:col-span-2"><EmptyState icon={Store} title="Aucune opportunité" description="Aucune opportunité ne correspond à ces filtres." /></div>}
            {list.map((o) => {
              const applied = mine.find((a) => a.opportunityId === o.id && a.status !== "RETIREE");
              const apps = s.applications.filter((a) => a.opportunityId === o.id && a.status !== "RETIREE");
              const closed = o.status === "CLOTUREE" || o.deadline < s.now;
              return (
                <Card key={o.id} className="flex flex-col">
                  <div className="flex items-start justify-between gap-2"><h2 className="text-md font-semibold text-ink">{o.title}</h2><StatusPill tone={closed ? "neutral" : "ok"} label={closed ? "Clôturée" : "Ouverte"} /></div>
                  <p className="mt-1 text-sm text-text-secondary">{o.description}</p>
                  <p className="mt-3 flex flex-wrap gap-1.5">{o.skillIds.map((k) => { const lvl = myLevels.get(k); return <Badge key={k} tone={emp ? (lvl ? "ok" : "neutral") : "primary"} icon={!!emp && !!lvl}>{s.skills.find((x) => x.id === k)?.name}{emp ? (lvl ? ` · niveau ${lvl}` : " · non déclarée") : ""}</Badge>; })}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-1.5 text-xs"><dt className="text-text-muted">Période</dt><dd>{fmtRange(o.startDate, o.endDate)}</dd><dt className="text-text-muted">Allocation</dt><dd>{fmtPct(o.allocationPct)}</dd><dt className="text-text-muted">Échéance</dt><dd className="flex items-center gap-1"><CalendarClock className="size-3.5" aria-hidden />{fmtDate(o.deadline)} ({relDays(o.deadline, s.now)})</dd><dt className="text-text-muted">Publié par</dt><dd>{s.users.find((u) => u.id === o.publisherId)?.firstName} {s.users.find((u) => u.id === o.publisherId)?.lastName}</dd></dl>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
                    {can("marketplace.review") ? <span className="flex items-center gap-2"><Badge tone="info">{apps.length} candidature(s)</Badge></span> : <span />}
                    <span className="flex gap-2">
                      {can("marketplace.review") && <Button size="sm" variant="secondary" onClick={() => setReview(o)}>Examiner</Button>}
                      {can("marketplace.review") && !closed && <Button size="sm" variant="ghost" onClick={() => { act((d) => closeOpportunity(d, o.id)); toast({ title: "Opportunité clôturée" }); }}>Clôturer</Button>}
                      {can("marketplace.apply") && (applied ? <StatusPill tone={APP_TONE[applied.status]} label={`Ma candidature : ${APP_LABEL[applied.status]}`} /> : <Button size="sm" disabled={closed} icon={<Send className="size-4" />} onClick={() => { setApply(o); setMotivation(""); }}>Postuler</Button>)}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
          {can("marketplace.apply") && (
            <Card className="h-fit"><h2 className="mb-3 text-md font-semibold text-ink">Mes candidatures</h2>
              {mine.length === 0 ? <p className="text-sm text-text-muted">Vous n’avez pas encore postulé.</p> : <ul>{mine.map((a) => <li key={a.id} className="border-b border-line py-2.5 text-sm last:border-0"><p className="font-medium text-ink">{s.opportunities.find((o) => o.id === a.opportunityId)?.title}</p><div className="mt-1 flex items-center justify-between"><StatusPill tone={APP_TONE[a.status]} label={APP_LABEL[a.status]} />{a.status === "ENVOYEE" && <Button size="sm" variant="ghost" onClick={() => { act((d) => withdrawApplication(d, a.id)); toast({ title: "Candidature retirée" }); }}>Retirer</Button>}</div></li>)}</ul>}
              <Callout tone="neutral" className="mt-3">Postuler exprime un intérêt ; l’affectation, si elle a lieu, est décidée par le Resource Manager.</Callout></Card>
          )}
        </div>
      )}
      <Modal open={!!apply} onClose={() => setApply(null)} title="Postuler" subtitle={apply?.title} footer={<><Button variant="secondary" onClick={() => setApply(null)}>Annuler</Button><Button onClick={() => { const r = act((d) => applyToOpportunity(d, apply!.id, motivation)); toast({ title: r.ok ? "Candidature envoyée" : "Refusé", body: r.ok ? "Le publieur est notifié. Aucune affectation n’est créée." : r.error, tone: r.ok ? "success" : "warning" }); if (r.ok) setApply(null); }}>Envoyer ma candidature</Button></>}>
        <TextArea label="Motivation" required rows={4} value={motivation} onChange={setMotivation} hint="10 caractères minimum." />
      </Modal>
      {review && <ReviewDrawer o={review} onClose={() => setReview(null)} />}
      {create && <PublishDrawer onClose={() => q.set("nouveau", null)} />}
    </>
  );
}

function ReviewDrawer({ o, onClose }: { o: Opportunity; onClose: () => void }) {
  const { s } = useSession();
  const toast = useToast();
  const apps = s.applications.filter((a) => a.opportunityId === o.id && a.status !== "RETIREE");
  const project = o.projectId ? s.projects.find((p) => p.id === o.projectId) : undefined;
  return (
    <Drawer open onClose={onClose} width="40em" title="Candidatures" subtitle={o.title}>
      <Callout tone="neutral" className="mb-4">Le score est celui du moteur de staffing (compétences réellement déclarées, disponibilité sur la période). Présélectionner ne crée aucune affectation : utilisez « Ouvrir le staffing ».</Callout>
      {apps.length === 0 ? <EmptyState icon={Store} title="Aucune candidature" /> : <ul className="flex flex-col gap-3">{apps.map((a) => {
        const e = s.employees.find((x) => x.id === a.employeeId)!;
        const m = scoreCandidate(s, e, { ...requirementLike({ id: "x", projectId: o.projectId ?? "", gradeMin: "g-1", quantity: 1, mandatorySkillIds: o.skillIds, desiredSkillIds: [], minExperienceYears: 0, startDate: o.startDate > s.now ? o.startDate : addDays(s.now, 1), endDate: o.endDate, allocationPct: o.allocationPct, priority: "NORMALE" }, project) });
        return <li key={a.id} className="rounded-lg border border-border p-3"><div className="flex items-start justify-between gap-3"><PersonCell person={e} sub={s.grades.find((g) => g.id === e.gradeId)?.name} href={`/app/collaborateurs/${e.id}`} /><span className="text-end"><span className="block text-lg font-semibold tabular-nums text-ink">{m.score}</span><span className="text-2xs text-text-muted">score moteur</span></span></div>
          <p className="mt-2 text-sm text-text-secondary">« {a.motivation} »</p>{!m.compatible && <p className="mt-1 text-xs text-conflict">Non compatible : {m.blocking.map((b) => b.label).join(", ")}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><StatusPill tone={APP_TONE[a.status]} label={APP_LABEL[a.status]} /><span className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => { act((d) => reviewApplication(d, a.id, "NON_RETENUE")); toast({ title: "Candidature non retenue" }); }}>Ne pas retenir</Button><Button size="sm" variant="secondary" onClick={() => { act((d) => reviewApplication(d, a.id, "PRESELECTIONNEE")); toast({ title: "Candidature présélectionnée", body: "Aucune affectation créée." }); }}>Présélectionner</Button><Button size="sm" href={o.projectId ? `/app/missions/${o.projectId}?tab=besoins` : "/app/planning"}>Ouvrir le staffing</Button></span></div></li>;
      })}</ul>}
      <Link href="/app/missions" className="hidden" />
    </Drawer>
  );
}
function PublishDrawer({ onClose }: { onClose: () => void }) {
  const { s, emp } = useSession();
  const toast = useToast();
  const [v, setV] = useState({ title: "", projectId: "", description: "", skillIds: [] as string[], start: addDays(s.now, 14), end: addDays(s.now, 75), pct: 100, deadline: addDays(s.now, 10), dept: emp?.departmentId ?? s.departments[0].id });
  return (
    <Drawer open onClose={onClose} dirty={!!v.title} width="42em" title="Publier une opportunité" footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={() => { const r = act((d) => publishOpportunity(d, { title: v.title, projectId: v.projectId || undefined, description: v.description, skillIds: v.skillIds, startDate: v.start, endDate: v.end, allocationPct: v.pct, deadline: v.deadline, departmentId: v.dept })); toast({ title: r.ok ? "Opportunité publiée" : "Refusé", body: r.ok ? "Les collaborateurs sont notifiés." : r.error, tone: r.ok ? "success" : "warning" }); if (r.ok) onClose(); }}>Publier</Button></>}>
      <div className="flex flex-col gap-4"><TextInput label="Titre" required value={v.title} onChange={(x) => setV({ ...v, title: x })} /><SelectInput label="Mission associée (optionnelle)" value={v.projectId} onChange={(x) => setV({ ...v, projectId: x })} options={[{ value: "", label: "Aucune" }, ...s.projects.filter((p) => p.status !== "TERMINEE" && p.status !== "ANNULEE").map((p) => ({ value: p.id, label: p.name }))]} /><SelectInput label="Département" value={v.dept} onChange={(x) => setV({ ...v, dept: x })} options={s.departments.map((d) => ({ value: d.id, label: d.name }))} /><TextArea label="Description" rows={3} value={v.description} onChange={(x) => setV({ ...v, description: x })} /><MultiSelect label="Compétences" values={v.skillIds} onChange={(x) => setV({ ...v, skillIds: x })} options={s.skills.map((k) => ({ value: k.id, label: k.name }))} /><DateRangeInput start={v.start} end={v.end} onChange={(a, b) => setV({ ...v, start: a, end: b })} /><div className="grid grid-cols-2 gap-3"><NumberInput label="Allocation" suffix="%" min={5} max={100} step={5} value={v.pct} onChange={(n) => setV({ ...v, pct: n })} /><DateInput label="Échéance des candidatures" value={v.deadline} onChange={(x) => setV({ ...v, deadline: x })} /></div></div>
    </Drawer>
  );
}
