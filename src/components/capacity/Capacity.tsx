"use client";
import { Download, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { capacityView, type CapacityInput } from "@/lib/store/selectors/capacity";
import { downloadFile, toCsv } from "@/lib/download";
import { fmtDec, fmtMonth, fmtPct } from "@/lib/engine/format";
import { audit, ok } from "@/lib/store/actions/core";
import { ChartCard, StackedBars } from "@/components/charts/Charts";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DateRangeInput, MultiSelect, NumberInput, Slider } from "@/components/ui/Controls";
import { SegmentedControl, SelectInput, Switch } from "@/components/ui/FormInputs";
import { Callout, Card, CardHeader, EmptyState, PageHeader, Skeleton } from "@/components/ui/Surface";
import { useToast } from "@/components/ui/Toast";
import { useFirstLoad } from "@/components/app/useSkeleton";
import { CERTAINTY } from "@/lib/ui-domain";
import type { Certainty, PipelineItem } from "@/lib/store/types";
import { addDays } from "@/lib/engine/dates";

export function CapacityPage() {
  const { s, can } = useSession();
  const q = useQueryState();
  const toast = useToast();
  const loading = useFirstLoad();
  const horizon = (Number(q.get("horizon")) || 3) as CapacityInput["horizon"];
  const dept = q.get("dept") || undefined;
  const byGrade = q.get("vue") !== "competence";
  const [weights, setWeights] = useState<Record<Certainty, number>>({ ...s.settings.forecastWeights });
  const [softOn, setSoft] = useState(false);
  const [wi, setWi] = useState<{ grade: string; qty: number; pct: number; start: string; end: string; certainty: Certainty; skills: string[] }>({ grade: "g-3", qty: 2, pct: 100, start: addDays(s.now, 45), end: addDays(s.now, 135), certainty: "PROBABLE", skills: [] });
  const [extra, setExtra] = useState<PipelineItem[]>([]);
  const [hires, setHires] = useState<Record<string, number>>({});
  const whatIf = can("capacity.whatif");
  const input: CapacityInput = { horizon, dept, weights, extraItems: extra, extraHires: hires, includeSoft: softOn };
  const base = useMemo(() => capacityView(s, { ...input, weights: s.settings.forecastWeights, extraItems: [], extraHires: {} }), [s, horizon, dept, softOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const v = useMemo(() => capacityView(s, input), [s, horizon, dept, weights, extra, hires, softOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const scenario = extra.length > 0 || Object.values(hires).some(Boolean) || (Object.keys(weights) as Certainty[]).some((c) => weights[c] !== s.settings.forecastWeights[c]);
  const reset = () => { setExtra([]); setHires({}); setWeights({ ...s.settings.forecastWeights }); };
  const saveRule = () => {
    act((d) => { const before = { ...d.settings.forecastWeights }; d.settings.forecastWeights = { ...weights }; audit(d, { action: "settings.update", entity: "Règles", entityId: "forecastWeights", label: "Pondérations de certitude", before, after: { ...weights } }); return ok(undefined); });
    toast({ title: "Pondérations enregistrées comme règle", body: "Journalisé dans l’audit." });
  };
  const exportNeeds = () => downloadFile("besoins-recrutement.csv", toCsv(["Grade", "Personnes à recruter", "Premier mois de déficit", "Missions concernées"], v.needs.map((n) => [n.gradeName, n.persons, n.firstDeficitMonth ?? "", n.drivers.map((d) => `${d.name} (${CERTAINTY[d.certainty].label})`).join(" ; ")])));
  const chartGrade = q.get("grade") || "";
  const fmtM = (k: string) => fmtMonth(`${k}-01`);

  return (
    <>
      <PageHeader title="Planification de capacité" description="Capacité disponible face aux besoins pondérés par la certitude des missions (100 / 60 / 25 % par défaut), par grade et par compétence." actions={<Button variant="secondary" icon={<Download className="size-4" />} onClick={exportNeeds} disabled={!v.needs.length}>Exporter les besoins (CSV)</Button>} />
      <Card className="mb-4 !p-3"><div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div><p className="mb-1.5 text-sm font-medium text-text">Horizon</p><SegmentedControl label="Horizon" value={String(horizon)} onChange={(x) => q.set("horizon", x)} options={[{ value: "1", label: "1 mois" }, { value: "3", label: "3 mois" }, { value: "6", label: "6 mois" }, { value: "12", label: "12 mois" }]} /></div>
        <div className="w-56"><SelectInput label="Département" value={dept ?? ""} onChange={(x) => q.set("dept", x || null)} options={[{ value: "", label: "Tous" }, ...s.departments.map((d) => ({ value: d.id, label: d.name }))]} /></div>
        <div><p className="mb-1.5 text-sm font-medium text-text">Vue</p><SegmentedControl label="Vue" value={byGrade ? "grade" : "competence"} onChange={(x) => q.set("vue", x === "grade" ? null : x)} options={[{ value: "grade", label: "Par grade" }, { value: "competence", label: "Par compétence" }]} /></div>
        <label className="flex items-center gap-2 pb-1 text-sm"><Switch size="sm" checked={softOn} onChange={setSoft} label="Inclure les réservations" />Inclure les réservations</label>
      </div></Card>
      {loading ? <Skeleton className="h-96 w-full" /> : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2" aria-live="polite">
            {v.deficitChips.length ? v.deficitChips.map((c) => <StatusPill key={c} tone="conflict" label={c} />) : <StatusPill tone="ok" label="Aucun déficit sur l’horizon" />}
            {scenario && <Badge tone="info" icon>Scénario simulé — non enregistré</Badge>}
            {scenario && base.deficitChips.join() !== v.deficitChips.join() && <span className="text-xs text-text-secondary">Situation actuelle : {base.deficitChips.join(" · ") || "aucun déficit"}</span>}
          </div>
          <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <ChartCard title="Besoins pondérés vs capacité" subtitle="ETP par mois — la partie hachurée est le déficit" source={`Besoins = postes non couverts des missions + pipeline, × pondération de certitude. Capacité = disponible après absences et affectations confirmées.`} table={{ head: ["Mois", ...v.stacks.map((x) => `${x.name} (ETP)`), "Besoins (ETP)", "Capacité (ETP)"], rows: v.labels.map((l, i) => [l, ...v.stacks.map((x) => x.values[i]), Math.round(v.stacks.reduce((a, x) => a + x.values[i], 0) * 10) / 10, v.capacity[i]]) }} summary="Besoins pondérés empilés par certitude et ligne de capacité">
              <StackedBars id={`cap-${horizon}-${dept}-${scenario}`} labels={v.labels} stacks={v.stacks} capacity={v.capacity} />
            </ChartCard>
            <Card><CardHeader title={byGrade ? "Par grade" : "Par compétence"} description={byGrade ? "Pire mois de l’horizon" : "Non additif : une personne peut cumuler plusieurs compétences"} />
              <table className="w-full text-sm"><caption className="sr-only">Équilibre capacité / besoins</caption><thead className="text-xs text-text-secondary"><tr><th className="py-1 text-start font-medium">{byGrade ? "Grade" : "Compétence"}</th><th className="text-end font-medium">Capacité</th><th className="text-end font-medium">Besoins</th><th className="text-end font-medium">Solde</th></tr></thead>
                <tbody>{(byGrade ? v.grades.map((g) => ({ k: g.gradeId, n: g.gradeName, sup: g.supplyFte, dem: g.demandFte, def: g.deficitPersons, sur: g.surplusPersons })) : v.skills.map((k) => ({ k: k.skillId, n: k.skillName, sup: k.supplyFte, dem: k.demandFte, def: k.deficitPersons, sur: 0 }))).map((r) => (
                  <tr key={r.k} className="border-t border-line"><td className="py-1.5 font-medium text-ink">{r.n}</td><td className="text-end tabular-nums">{fmtDec(r.sup)}</td><td className="text-end tabular-nums">{fmtDec(r.dem)}</td><td className="text-end">{r.def > 0 ? <StatusPill tone="conflict" label={`Déficit : ${r.def}`} /> : r.sur > 0 ? <StatusPill tone="info" label={`Excédent : ${r.sur}`} /> : <StatusPill tone="ok" label="Équilibré" />}</td></tr>))}</tbody></table>
              <p className="mt-2 text-2xs text-text-muted">ETP = équivalent temps plein, moyenne des mois où il existe un besoin.</p></Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card><CardHeader title="Besoins de recrutement" description="Déficit constaté au pire mois, par grade" />
              {v.needs.length === 0 ? <EmptyState icon={Save} title="Aucun besoin de recrutement" description="La capacité couvre les besoins pondérés sur cet horizon." /> : (
                <table className="w-full text-sm"><caption className="sr-only">Besoins de recrutement</caption><thead className="text-xs text-text-secondary"><tr><th className="py-1 text-start font-medium">Grade</th><th className="text-end font-medium">Personnes</th><th className="text-start ps-4 font-medium">Dès</th><th className="text-start font-medium">Missions</th></tr></thead>
                  <tbody>{v.needs.map((n) => <tr key={n.gradeId} className="border-t border-line align-top"><td className="py-2 font-medium text-ink">{n.gradeName}</td><td className="text-end tabular-nums">{n.persons}</td><td className="ps-4">{n.firstDeficitMonth ? fmtM(n.firstDeficitMonth) : "—"}</td><td className="text-xs text-text-secondary">{n.drivers.map((d) => <span key={d.name} className="block">{d.name} <Badge tone={CERTAINTY[d.certainty].tone}>{CERTAINTY[d.certainty].label}</Badge></span>)}</td></tr>)}</tbody></table>)}</Card>
            <Card><CardHeader title="Risques de surcharge" description="Collaborateurs au-dessus du seuil sur les 90 prochains jours" />
              {v.overload.length === 0 ? <p className="text-sm text-text-muted">Aucun risque de surcharge.</p> : <ul>{v.overload.map((x) => <li key={x.e.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0"><Link href={`/app/collaborateurs/${x.e.id}`} className="font-medium text-ink hover:underline">{x.e.firstName} {x.e.lastName}</Link><StatusPill tone="conflict" label={`${fmtPct(x.planned)} planifié`} /></li>)}</ul>}</Card>
          </div>

          <Card className="mt-4"><CardHeader title="Capacité mois par mois" description="Combien de personnes disponibles, par grade et par mois (ETP : capacité − besoins)" />
            <div className="scroll-thin overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Solde mensuel par grade</caption><thead className="text-xs text-text-secondary"><tr><th className="py-1 text-start font-medium">Grade</th>{v.monthKeys.map((k) => <th key={k} className="px-2 text-end font-medium capitalize">{fmtM(k)}</th>)}</tr></thead>
              <tbody>{v.gradeMonth.map((g) => <tr key={g.gradeId} className="border-t border-line"><th scope="row" className="py-1.5 text-start font-medium text-ink">{g.name}</th>{g.months.map((m) => <td key={m.key} className="px-2 text-end tabular-nums"><span title={`Capacité ${fmtDec(m.supply)} · besoins ${fmtDec(m.demand)}`} className={m.balance < -0.1 ? "font-semibold text-conflict" : m.balance > 0.1 ? "text-ok" : "text-text-secondary"}>{m.balance < -0.1 ? "▲ " : ""}{fmtDec(m.balance)}</span></td>)}</tr>)}</tbody></table></div>
            <p className="mt-2 text-2xs text-text-muted">Solde positif = personnes libres (ETP) ; ▲ = déficit. C’est ici que se lit « combien de Seniors seront disponibles en janvier ».</p></Card>

          {whatIf && (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <Card><CardHeader title="Pondérations de certitude" description="Scénario local — n’altère pas les règles tant que vous n’enregistrez pas" />
                <div className="flex flex-col gap-4">{(["CONFIRMEE", "PROBABLE", "OPPORTUNITE"] as Certainty[]).map((c) => <Slider key={c} label={CERTAINTY[c].label} value={weights[c]} onChange={(n) => setWeights({ ...weights, [c]: n })} format={(n) => `${n} %`} />)}</div>
                <div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" />} onClick={reset}>Réinitialiser le scénario</Button>{can("admin.settings") && <Button size="sm" icon={<Save className="size-4" />} onClick={saveRule}>Enregistrer comme règle</Button>}</div></Card>
              <Card><CardHeader title="Et si… ?" description="Ajoutez une mission probable ou des recrutements et voyez l’impact immédiat" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectInput label="Grade requis" value={wi.grade} onChange={(g) => setWi({ ...wi, grade: g })} options={s.grades.map((g) => ({ value: g.id, label: g.name }))} />
                  <NumberInput label="Quantité" min={1} value={wi.qty} onChange={(n) => setWi({ ...wi, qty: n })} />
                  <div className="sm:col-span-2"><DateRangeInput start={wi.start} end={wi.end} onChange={(a, b) => setWi({ ...wi, start: a, end: b })} /></div>
                  <SelectInput label="Certitude" value={wi.certainty} onChange={(c) => setWi({ ...wi, certainty: c as Certainty })} options={Object.entries(CERTAINTY).map(([k, x]) => ({ value: k, label: x.label }))} />
                  <NumberInput label="Allocation" suffix="%" min={5} max={100} step={5} value={wi.pct} onChange={(n) => setWi({ ...wi, pct: n })} />
                  <div className="sm:col-span-2"><MultiSelect label="Compétences" values={wi.skills} onChange={(x) => setWi({ ...wi, skills: x })} options={s.skills.map((k) => ({ value: k.id, label: k.name }))} /></div>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3"><Button onClick={() => setExtra([...extra, { id: `wi-${extra.length + 1}`, name: `Mission simulée ${extra.length + 1}`, clientLabel: "Scénario", departmentId: dept ?? s.departments[0].id, sector: "Banque & assurance", certainty: wi.certainty, startDate: wi.start, endDate: wi.end, needs: [{ gradeId: wi.grade, quantity: wi.qty, skillIds: wi.skills, allocationPct: wi.pct }] }])}>Ajouter la mission simulée</Button>
                  <div className="w-44"><NumberInput label="Recrutements (grade ci-dessus)" min={0} value={hires[wi.grade] ?? 0} onChange={(n) => setHires({ ...hires, [wi.grade]: n })} /></div></div>
                {extra.length > 0 && <ul className="mt-3 text-xs text-text-secondary">{extra.map((e) => <li key={e.id}>{e.name} — {e.needs[0].quantity} × {s.grades.find((g) => g.id === e.needs[0].gradeId)?.name} ({CERTAINTY[e.certainty].label})</li>)}</ul>}
              </Card>
            </div>
          )}
          {!whatIf && <Callout tone="neutral" className="mt-4">Le scénario « et si » est réservé aux profils habilités.</Callout>}
        </>
      )}
      <span hidden>{chartGrade}</span>
    </>
  );
}
