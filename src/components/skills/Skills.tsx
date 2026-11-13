"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { categoryCounts, defaultWindow, levelLabel, rampStep, searchPeople, sectorsOf, skillMatrix, skillRows, AXIS_LABEL, type MatrixAxis, type SearchCriteria } from "@/lib/store/selectors/skills";
import { ChartCard } from "@/components/charts/Charts";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Controls";
import { SearchInput, SegmentedControl, SelectInput, Switch, TextInput } from "@/components/ui/FormInputs";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/Surface";
import { useToast } from "@/components/ui/Toast";
import { Tabs } from "@/components/ui/Tabs";
import { fmtDec, fmtHours, fmtPct } from "@/lib/engine/format";
import type { SkillLevel } from "@/lib/store/types";
import { addReferential } from "@/lib/store/actions/admin";

export function SkillsPage() {
  const { s, can } = useSession();
  const q = useQueryState();
  const view = q.get("view") || "referentiel";
  return (
    <>
      <PageHeader title="Compétences" description="Référentiel, recherche avancée multi-critères et matrice des compétences par département, grade et secteur." />
      <Tabs label="Vues" value={view} onChange={(v) => q.set("view", v === "referentiel" ? null : v)} className="mb-5" items={[{ value: "referentiel", label: "Référentiel" }, ...(can("skill.search") ? [{ value: "recherche", label: "Recherche avancée" }, { value: "matrice", label: "Matrice" }] : [])]} />
      {view === "recherche" && can("skill.search") ? <Search_ /> : view === "matrice" && can("skill.search") ? <Matrix_ /> : <Referential />}
      <span hidden>{s.skills.length}</span>
    </>
  );
}

function Referential() {
  const { s, can } = useSession();
  const q = useQueryState();
  const toast = useToast();
  const [name, setName] = useState("");
  const rows = skillRows(s, { q: q.get("q"), category: q.get("cat") || undefined });
  const cats = categoryCounts(s);
  return (
    <div className="grid gap-4 xl:grid-cols-[16em_1fr]">
      <Card className="h-fit !p-2"><ul><li><button type="button" onClick={() => q.set("cat", null)} className={cn("flex w-full justify-between rounded px-3 py-1.5 text-sm hover:bg-paper", !q.get("cat") && "bg-select font-medium")}>Toutes<span className="tabular-nums text-text-muted">{s.skills.length}</span></button></li>{cats.map((c) => <li key={c.id}><button type="button" onClick={() => q.set("cat", c.id)} className={cn("flex w-full justify-between rounded px-3 py-1.5 text-sm hover:bg-paper", q.get("cat") === c.id && "bg-select font-medium")}>{c.name}<span className="tabular-nums text-text-muted">{c.count}</span></button></li>)}</ul></Card>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2"><SearchInput className="w-[20em]" value={q.get("q")} onChange={(v) => q.set("q", v || null)} placeholder="Rechercher une compétence…" />{can("skill.edit") && <span className="ms-auto flex items-end gap-2"><div className="w-56"><TextInput label="" value={name} onChange={setName} placeholder="Nouvelle catégorie…" /></div><Button variant="secondary" onClick={() => { const r = act((d) => addReferential(d, "category", name)); toast({ title: r.ok ? "Catégorie ajoutée" : "Refusé", body: r.ok ? undefined : r.error, tone: r.ok ? "success" : "warning" }); if (r.ok) setName(""); }}>Ajouter</Button></span>}</div>
        <Card className="!p-0 overflow-hidden"><table className="w-full text-sm"><caption className="sr-only">Référentiel de compétences</caption><thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="px-4 py-2 text-start font-medium">Compétence</th><th className="px-3 text-start font-medium">Catégorie</th><th className="px-3 text-start font-medium">Niveau attendu</th><th className="px-3 text-start font-medium">Certifications associées</th><th className="px-3 text-end font-medium">Titulaires</th></tr></thead>
          <tbody>{rows.length === 0 && <tr><td colSpan={5}><EmptyState icon={Search} title="Aucune compétence" /></td></tr>}{rows.map((r) => <tr key={r.skill.id} className="border-t border-line"><td className="px-4 py-2"><span className="font-medium text-ink">{r.skill.name}</span><span className="block text-xs text-text-muted">{r.skill.description}</span></td><td className="px-3">{r.categoryName}</td><td className="px-3">{levelLabel(s, r.skill.expectedLevel)}</td><td className="px-3 text-xs">{r.certifications.map((c) => c.name).join(", ") || "—"}</td><td className="px-3 text-end tabular-nums">{r.holders} <span className="text-text-muted">({r.atExpected} au niveau)</span></td></tr>)}</tbody></table></Card>
      </div>
    </div>
  );
}

function Search_() {
  const { s } = useSession();
  const [crit, setCrit] = useState<SearchCriteria>({ skills: [{ skillId: "sk-audit-fin", minLevel: 3 }], sector: "Banque & assurance", certificationId: "ce-ifrs", mode: "all" });
  const [avail, setAvail] = useState(false);
  const hits = useMemo(() => searchPeople(s, { ...crit, ...defaultWindow(s), availableOnly: avail }), [s, crit, avail]);
  const setSkill = (i: number, p: Partial<{ skillId: string; minLevel: SkillLevel }>) => setCrit({ ...crit, skills: crit.skills.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  return (
    <div className="grid gap-4 xl:grid-cols-[22em_1fr]">
      <Card className="h-fit"><CardHeader title="Critères" description="Ex. niveau avancé en audit financier + secteur bancaire + certification IFRS" />
        <div className="flex flex-col gap-3">{crit.skills.map((k, i) => <div key={i} className="flex items-end gap-2"><div className="flex-1"><Combobox label={i ? undefined : "Compétence"} value={k.skillId} onChange={(v) => setSkill(i, { skillId: v })} options={s.skills.map((x) => ({ value: x.id, label: x.name }))} /></div><div className="w-28"><SelectInput label={i ? "" : "Niveau min."} value={String(k.minLevel)} onChange={(v) => setSkill(i, { minLevel: Number(v) as SkillLevel })} options={[1, 2, 3, 4].map((l) => ({ value: String(l), label: levelLabel(s, l) }))} /></div></div>)}
          <Button size="sm" variant="secondary" onClick={() => setCrit({ ...crit, skills: [...crit.skills, { skillId: "sk-ifrs", minLevel: 2 }] })}>+ Compétence</Button>
          <SelectInput label="Secteur" value={crit.sector ?? ""} onChange={(v) => setCrit({ ...crit, sector: v || undefined })} options={[{ value: "", label: "Indifférent" }, ...sectorsOf(s).map((x) => ({ value: x, label: x }))]} />
          <SelectInput label="Certification détenue" value={crit.certificationId ?? ""} onChange={(v) => setCrit({ ...crit, certificationId: v || undefined })} options={[{ value: "", label: "Indifférent" }, ...s.certifications.map((c) => ({ value: c.id, label: c.name }))]} />
          <SelectInput label="Grade" value={crit.gradeId ?? ""} onChange={(v) => setCrit({ ...crit, gradeId: v || undefined })} options={[{ value: "", label: "Tous" }, ...s.grades.map((c) => ({ value: c.id, label: c.name }))]} />
          <SegmentedControl label="Mode" value={crit.mode ?? "all"} onChange={(v) => setCrit({ ...crit, mode: v })} options={[{ value: "all", label: "Tous les critères" }, { value: "any", label: "Au moins un" }]} />
          <label className="flex items-center justify-between text-sm"><span>Disponibles sur les 4 prochaines semaines</span><Switch size="sm" checked={avail} onChange={setAvail} label="Disponibles" /></label></div></Card>
      <Card className="!p-0 overflow-hidden"><div className="border-b border-border px-4 py-3 text-sm"><span className="font-semibold text-ink">{hits.length}</span> résultat(s) <span className="text-text-muted">— mis à jour instantanément</span></div>
        {hits.length === 0 ? <EmptyState icon={Search} title="Aucun profil ne correspond" description="Assouplissez un critère." /> : <ul>{hits.slice(0, 30).map((h) => <li key={h.employee.id} className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0"><Avatar person={h.employee} size="sm" /><div className="min-w-[10em] flex-1"><Link href={`/app/collaborateurs/${h.employee.id}`} className="font-medium text-ink hover:underline">{h.employee.firstName} {h.employee.lastName}</Link><p className="text-xs text-text-muted">{h.gradeName} · {h.departmentName}</p></div><p className="flex flex-wrap gap-1">{h.skills.map((k) => <Badge key={k.skillId} tone={k.ok ? "ok" : "neutral"} icon={k.ok}>{k.name} · {k.level ? levelLabel(s, k.level) : "non déclarée"}</Badge>)}{h.sector && <Badge tone={h.sector.ok ? "ok" : "neutral"} icon={h.sector.ok}>{h.sector.wanted}</Badge>}{h.certification && <Badge tone={h.certification.ok ? "ok" : "neutral"} icon={h.certification.ok}>{h.certification.wanted}</Badge>}</p><span className="text-end text-xs"><StatusPill tone={h.freeRatio >= 0.5 ? "ok" : "alert"} label={`${fmtPct(h.freeRatio * 100)} libre`} /><span className="block text-text-muted">{fmtHours(h.freeHours)}</span></span></li>)}</ul>}</Card>
    </div>
  );
}

function Matrix_() {
  const { s } = useSession();
  const [o, setO] = useState({ rows: "department" as MatrixAxis, cols: "grade" as MatrixAxis, skill: "all", minLevel: 2 as SkillLevel, metric: "count" as "count" | "avg" });
  const m = skillMatrix(s, o);
  const table = { head: ["", ...m.cols.map((c) => c.label)], rows: m.rows.map((r, i) => [r.label, ...m.cells[i].map((c) => (o.metric === "avg" ? (c.avg === null ? "—" : fmtDec(c.avg)) : c.count))]) };
  return (
    <div className="flex flex-col gap-4">
      <Card className="!p-3"><div className="grid gap-3 sm:grid-cols-5"><SelectInput label="Lignes" value={o.rows} onChange={(v) => setO({ ...o, rows: v as MatrixAxis })} options={(Object.keys(AXIS_LABEL) as MatrixAxis[]).map((a) => ({ value: a, label: AXIS_LABEL[a] }))} /><SelectInput label="Colonnes" value={o.cols} onChange={(v) => setO({ ...o, cols: v as MatrixAxis })} options={(Object.keys(AXIS_LABEL) as MatrixAxis[]).map((a) => ({ value: a, label: AXIS_LABEL[a] }))} /><Combobox label="Compétence" value={o.skill} onChange={(v) => setO({ ...o, skill: v })} options={[{ value: "all", label: "Toutes" }, ...s.skills.map((k) => ({ value: k.id, label: k.name }))]} /><SelectInput label="Niveau minimum" value={String(o.minLevel)} onChange={(v) => setO({ ...o, minLevel: Number(v) as SkillLevel })} options={[1, 2, 3, 4].map((l) => ({ value: String(l), label: levelLabel(s, l) }))} /><SelectInput label="Mesure" value={o.metric} onChange={(v) => setO({ ...o, metric: v as "count" | "avg" })} options={[{ value: "count", label: "Nombre de personnes" }, { value: "avg", label: "Niveau moyen" }]} /></div></Card>
      <ChartCard title={`Matrice — ${m.skillLabel}`} subtitle={`${m.people} personne(s) distincte(s) · ${AXIS_LABEL[o.rows]} × ${AXIS_LABEL[o.cols]}`} table={table}>
        <div className="scroll-thin overflow-x-auto"><table className="w-full border-separate border-spacing-1 text-sm"><caption className="sr-only">Matrice des compétences</caption><thead><tr><th />{m.cols.map((c) => <th key={c.key} scope="col" className="px-2 py-1 text-center text-xs font-medium text-text-secondary">{c.label}</th>)}</tr></thead>
          <tbody>{m.rows.map((r, i) => <tr key={r.key}><th scope="row" className="pe-3 text-end text-xs font-medium text-text-secondary">{r.label}</th>{m.cells[i].map((c) => { const st = c.value ? rampStep(c.value, m.max) : 0; return <td key={c.colKey} title={c.people.map((p) => `${p.name} (${levelLabel(s, p.level)})`).join("\n") || "Aucune personne"} className={cn("h-10 rounded text-center text-sm font-medium tabular-nums", st === 0 ? "bg-paper text-text-muted" : st >= 6 ? "text-white" : "text-ink")} style={st ? { background: `var(--color-ramp-${st})` } : undefined}>{o.metric === "avg" ? (c.avg === null ? "" : fmtDec(c.avg)) : c.count || ""}</td>; })}</tr>)}</tbody></table></div>
      </ChartCard>
    </div>
  );
}
