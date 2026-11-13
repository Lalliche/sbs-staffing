"use client";
import { FileUp, Send, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { answer, SUGGESTIONS } from "@/lib/ai/router";
import type { AiAnswer } from "@/lib/ai/types";
import { applyCvAnalysis, simulateCvParse, type CvResult } from "@/lib/store/actions/ai";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextInput } from "@/components/ui/FormInputs";
import { Combobox } from "@/components/ui/Controls";
import { Callout } from "@/components/ui/Surface";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";

type Msg = { id: number; who: "user"; text: string } | { id: number; who: "ai"; a: AiAnswer };

/** SBS Staffing Intelligence (spec 8.15): deterministic, honest, sourced. Proposes, never decides. */
export function AssistantDrawer({ open, onClose, initialPrompt }: { open: boolean; onClose: () => void; initialPrompt?: string }) {
  const { s, can } = useSession();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [cv, setCv] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const ask = (t: string) => {
    const q = t.trim();
    if (!q) return;
    const a = answer(s, q);
    setMsgs((m) => [...m, { id: ++seq.current, who: "user", text: q }, { id: ++seq.current, who: "ai", a }]);
    setText("");
    if (a.action === "cv") setCv(true);
  };
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);
  const started = useRef(false);
  useEffect(() => { if (open && initialPrompt && !started.current) { started.current = true; ask(initialPrompt); } if (!open) started.current = false; });
  return (
    <>
      <Drawer open={open} onClose={onClose} width="38em" title="SBS Staffing Intelligence" subtitle="Assistant déterministe : chaque chiffre vient d’une requête sur vos données"
        footer={<form className="flex w-full items-center gap-2" onSubmit={(e) => { e.preventDefault(); ask(text); }}><div className="flex-1"><TextInput label="" value={text} onChange={setText} placeholder="Posez une question sur le staffing, la capacité, les disponibilités…" autoFocus /></div><Button type="submit" icon={<Send className="size-4" />} disabled={!text.trim()}>Envoyer</Button></form>}>
        <div className="flex flex-col gap-4" aria-live="polite">
          {msgs.length === 0 && (
            <div className="flex flex-col gap-3">
              <Callout tone="neutral" title="Ce que je sais faire">Chercher les meilleurs candidats d’une mission, répondre aux questions de direction (disponibilités, surcharges, missions non staffées, compétences, utilisation), signaler les risques, et analyser un CV avec votre validation. Je ne fais jamais d’affectation seul.</Callout>
              <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((x) => <button key={x} type="button" onClick={() => ask(x)} className="rounded-full border border-border-strong bg-bg px-3 py-1.5 text-start text-xs text-text-secondary hover:border-primary hover:text-ink">{x}</button>)}</div>
              {can("employee.create") && <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={() => setCv(true)}>Analyser un CV</Button>}
            </div>
          )}
          {msgs.map((m) => m.who === "user" ? <p key={m.id} className="ms-10 self-end rounded-lg bg-primary px-3 py-2 text-sm text-white">{m.text}</p> : <AnswerView key={m.id} a={m.a} onSuggest={ask} />)}
          <div ref={end} />
        </div>
        <p className="mt-6 border-t border-border pt-3 text-2xs text-text-muted">L’assistant ne prend aucune décision d’affectation ni décision RH ; il propose et cite ses sources. Il fonctionne sans service d’IA externe.</p>
      </Drawer>
      {cv && <CvFlow onClose={() => setCv(false)} />}
    </>
  );
}

function AnswerView({ a, onSuggest }: { a: AiAnswer; onSuggest: (q: string) => void }) {
  return (
    <div className={cn("me-6 rounded-lg border bg-bg p-4 text-sm", a.kind === "refusal" ? "border-alert/40" : a.kind === "unknown" ? "border-border-strong" : "border-border")}>
      <p className="flex items-center gap-2 text-xs font-medium text-text-muted"><Sparkles className="size-3.5" aria-hidden /> Intelligence{a.kind === "refusal" && <Badge tone="alert" icon>Refus</Badge>}{a.kind === "unknown" && <Badge tone="neutral" icon>Hors périmètre</Badge>}</p>
      {a.title && <h3 className="mt-1 text-md font-semibold text-ink">{a.title}</h3>}
      <p className="mt-1 text-text-secondary">{a.text}</p>
      {a.figures.length > 0 && <dl className="mt-3 grid grid-cols-2 gap-2">{a.figures.map((f) => <div key={f.label} className="rounded-md bg-canvas px-3 py-2"><dt className="text-2xs text-text-muted">{f.label}</dt><dd className="text-md font-semibold tabular-nums text-ink">{f.value}</dd>{f.hint && <dd className="text-2xs text-text-muted">{f.hint}</dd>}</div>)}</dl>}
      {a.table && <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><caption className="sr-only">{a.table.caption}</caption><thead className="text-text-muted"><tr>{a.table.columns.map((c) => <th key={c.key} className={cn("py-1 font-medium", c.align === "end" ? "text-end" : "text-start")}>{c.label}</th>)}</tr></thead><tbody>{a.table.rows.map((r, i) => <tr key={i} className="border-t border-line">{a.table!.columns.map((c, ci) => <td key={c.key} className={cn("py-1.5 pe-2", c.align === "end" && "text-end tabular-nums", r.tone === "conflict" && ci === a.table!.columns.length - 1 && "text-conflict")}>{ci === 0 && r.href ? <Link href={r.href} className="font-medium text-ink hover:underline">{r.cells[c.key]}</Link> : r.cells[c.key]}</td>)}</tr>)}</tbody></table></div>}
      {a.assumptions && <ul className="mt-3 list-disc ps-5 text-xs text-text-secondary">{a.assumptions.map((x) => <li key={x}>{x}</li>)}</ul>}
      {a.links.length > 0 && <p className="mt-3 flex flex-wrap gap-3">{a.links.map((l) => <Link key={l.href} href={l.href} className="text-xs font-medium text-primary hover:underline">{l.label} →</Link>)}</p>}
      {a.suggestions && <div className="mt-3 flex flex-wrap gap-2">{a.suggestions.map((x) => <button key={x} type="button" onClick={() => onSuggest(x)} className="rounded-full border border-border-strong px-2.5 py-1 text-start text-xs text-text-secondary hover:border-primary hover:text-ink">{x}</button>)}</div>}
      <p className="mt-3 border-t border-line pt-2 text-2xs text-text-muted">Source : {a.source}</p>
    </div>
  );
}

function CvFlow({ onClose }: { onClose: () => void }) {
  const { s } = useSession();
  const toast = useToast();
  const [target, setTarget] = useState("");
  const [res, setRes] = useState<CvResult | null>(null);
  const [file, setFile] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOff((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const apply = () => {
    if (!res || !target) return;
    const f: CvResult = { ...res, skills: res.skills.filter((k) => !off.has(`s:${k.skillId}`)), diplomas: res.diplomas.filter((d) => !off.has(`d:${d}`)), sectors: res.sectors.filter((d) => !off.has(`x:${d}`)), experiences: res.experiences.filter((d) => !off.has(`e:${d.label}`)), certificationIds: res.certificationIds.filter((d) => !off.has(`c:${d}`)) };
    const r = act((d) => applyCvAnalysis(d, target, f));
    toast({ title: r.ok ? "Profil enrichi" : "Refusé", body: r.ok ? `${r.value.addedSkills} compétence(s) ajoutée(s) comme « déclarées » — à valider par le manager. Journalisé.` : r.error, tone: r.ok ? "success" : "warning" });
    if (r.ok) onClose();
  };
  return (
    <Drawer open onClose={onClose} width="40em" dirty={!!res} title="Analyse de CV" subtitle="Extraction simulée — vous validez avant tout enregistrement"
      footer={res ? <><Button variant="secondary" onClick={onClose}>Annuler — ne rien enregistrer</Button><Button disabled={!target} onClick={apply}>Valider et enregistrer</Button></> : <Button variant="secondary" onClick={onClose}>Fermer</Button>}>
      {!res ? (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-canvas px-6 py-12 text-center hover:border-primary"><FileUp className="size-6 text-text-muted" aria-hidden /><span className="text-sm font-medium text-ink">Choisir un CV (PDF ou DOCX)</span><span className="text-xs text-text-muted">L’analyse est simulée : un même fichier donne toujours la même extraction.</span><input type="file" accept=".pdf,.docx,application/pdf" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f.name); setRes(simulateCvParse(f.name, f.size)); } }} /></label>
      ) : (
        <div className="flex flex-col gap-5">
          <Callout tone="alert" title="Extraction simulée de « " ><span className="flex items-center gap-2"><TriangleAlert className="size-4" aria-hidden />{file} — vérifiez et décochez ce qui est inexact. Rien n’est enregistré tant que vous n’avez pas validé.</span></Callout>
          <Combobox label="Collaborateur concerné" required value={target} onChange={setTarget} options={s.employees.filter((e) => e.status !== "ARCHIVE").map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))} />
          <Group title="Expériences">{res.experiences.map((x) => <Check key={x.label} k={`e:${x.label}`} off={off} t={toggle} label={`${x.label} — ${x.years} ans`} />)}</Group>
          <Group title="Compétences (niveaux proposés)">{res.skills.map((x) => <Check key={x.skillId} k={`s:${x.skillId}`} off={off} t={toggle} label={`${s.skills.find((k) => k.id === x.skillId)?.name} — niveau ${x.level}`} />)}</Group>
          <Group title="Diplômes">{res.diplomas.map((x) => <Check key={x} k={`d:${x}`} off={off} t={toggle} label={x} />)}</Group>
          <Group title="Certifications">{res.certificationIds.map((x) => <Check key={x} k={`c:${x}`} off={off} t={toggle} label={s.certifications.find((c) => c.id === x)?.name ?? x} />)}</Group>
          <Group title="Secteurs">{res.sectors.map((x) => <Check key={x} k={`x:${x}`} off={off} t={toggle} label={x} />)}</Group>
        </div>
      )}
    </Drawer>
  );
}
const Group = ({ title, children }: { title: string; children: React.ReactNode }) => <fieldset><legend className="mb-1.5 text-sm font-semibold text-ink">{title}</legend><div className="flex flex-col gap-1.5">{children}</div></fieldset>;
const Check = ({ k, off, t, label }: { k: string; off: Set<string>; t: (k: string) => void; label: string }) => <Checkbox checked={!off.has(k)} onChange={() => t(k)} label={label} />;
