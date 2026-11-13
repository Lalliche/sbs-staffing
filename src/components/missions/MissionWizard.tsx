"use client";
import { Plus, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { createProject, referenceTaken, otpTaken, type ProjectInput, type RequirementInput } from "@/lib/store/actions/projects";
import { addDays, diffDays } from "@/lib/engine/dates";
import { Button } from "@/components/ui/Button";
import { Combobox, DateInput, MultiSelect, NumberInput, Stepper } from "@/components/ui/Controls";
import { SelectInput, TextArea, TextInput } from "@/components/ui/FormInputs";
import { Callout } from "@/components/ui/Surface";
import { Drawer } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { PRIORITY } from "@/lib/ui-domain";
import type { Priority } from "@/lib/store/types";
import { SECTORS } from "@/lib/store/seed/referentials";

const TYPES = ["Audit légal", "Audit contractuel", "Audit interne", "Audit SI", "Tenue comptable", "Conseil comptable", "Conseil fiscal", "Juridique", "Stratégie", "Étude de marché", "Due diligence", "Évaluation", "Organisation"];
const STEPS = ["Informations générales", "Planning", "Finances", "Besoins en ressources"];
type Row = RequirementInput & { key: number };

/** Create-mission wizard (spec 8.3): 4 steps, per-step validation, requirement rows (1 Manager + 2 Seniors + 3 Juniors in the demo). */
export function MissionWizard({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { s, me, emp, can } = useSession();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string | null>(null);
  const seq = s.projects.length + 1;
  const [f, setF] = useState(() => ({
    name: "", clientId: "", departmentId: emp?.departmentId ?? "", type: "Audit légal", priority: "NORMALE" as Priority, sector: "Banque & assurance", leadId: emp?.id ?? "",
    reference: `MIS-2026-${String(500 + seq)}`, otp: `OTP-26-${String(4500 + seq * 3)}`, description: "", startDate: s.now, endDate: addDays(s.now, 90), estimatedDays: 60,
    budget: 0, resourceBudget: 0, estimatedDailyCost: 0, dailySellPrice: 0,
  }));
  const [phases, setPhases] = useState([{ name: "Cadrage", startDate: f.startDate, endDate: addDays(f.startDate, 14) }, { name: "Exécution", startDate: addDays(f.startDate, 15), endDate: addDays(f.endDate, -10) }, { name: "Restitution", startDate: addDays(f.endDate, -9), endDate: f.endDate }]);
  const [miles, setMiles] = useState([{ name: "Point d’étape client", date: addDays(f.startDate, 45) }]);
  const [rows, setRows] = useState<Row[]>([]);
  const k = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const canFin = can("project.finance.read");
  const skillOpts = s.skills.map((x) => ({ value: x.id, label: x.name }));
  const leads = s.employees.filter((e) => e.status !== "ARCHIVE" && (e.gradeId === "g-4" || e.gradeId === "g-5" || e.id === emp?.id));
  const newRow = (gradeMin: string, quantity: number): Row => ({ key: Math.random(), gradeMin, quantity, mandatorySkillIds: [], desiredSkillIds: [], minExperienceYears: 0, startDate: f.startDate, endDate: f.endDate, allocationPct: 100, priority: f.priority });
  const dirty = !!f.name || rows.length > 0;

  const validate = (st: number): string | null => {
    if (st === 0) {
      if (!f.name.trim()) return "Le nom de la mission est obligatoire.";
      if (!f.clientId) return "Choisissez un client.";
      if (!f.departmentId || !f.leadId) return "Département et responsable sont obligatoires.";
      if (referenceTaken(s, f.reference)) return "Cette référence existe déjà.";
      if (otpTaken(s, f.otp)) return "Ce numéro OTP existe déjà.";
    }
    if (st === 1) {
      if (f.startDate > f.endDate) return "La date de fin doit suivre la date de début.";
      if (!(f.estimatedDays > 0)) return "La durée estimée doit être positive.";
    }
    if (st === 3) {
      if (!rows.length) return "Ajoutez au moins un besoin en ressources (ou le modèle d’équipe).";
      if (rows.some((r) => !r.gradeMin || r.quantity < 1 || r.startDate > r.endDate)) return "Chaque besoin doit avoir un grade, une quantité et une période valide.";
    }
    return null;
  };
  const next = () => { const e = validate(step); setErrors(e); if (!e) setStep(step + 1); };
  const submit = () => {
    const e = validate(3);
    setErrors(e);
    if (e) return;
    const input: ProjectInput = {
      name: f.name.trim(), clientId: f.clientId, departmentId: f.departmentId, leadId: f.leadId, type: f.type, priority: f.priority, sector: f.sector, reference: f.reference.trim(), otp: f.otp.trim(),
      description: f.description, startDate: f.startDate, endDate: f.endDate, estimatedDays: f.estimatedDays, phases, milestones: miles,
      finance: canFin ? { budget: f.budget, resourceBudget: f.resourceBudget, estimatedDailyCost: f.estimatedDailyCost, dailySellPrice: f.dailySellPrice || undefined } : undefined,
      requirements: rows.map(({ key, ...r }) => { void key; return r; }),
    };
    const res = act((d) => createProject(d, input));
    if (!res.ok) return setErrors(res.error);
    toast({ title: "Mission créée", body: `${res.value.name} — ${rows.reduce((a, r) => a + r.quantity, 0)} poste(s) à pourvoir. Les Resource Managers ont été notifiés.` });
    onClose();
    onCreated(res.value.id);
  };
  const updRow = (key: number, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  return (
    <Drawer open={open} onClose={onClose} dirty={dirty} width="54em" title="Nouvelle mission" subtitle={me ? `Créée par ${me.firstName} ${me.lastName}` : undefined}
      footer={<><Button variant="ghost" disabled={step === 0} onClick={() => { setErrors(null); setStep(step - 1); }}>Précédent</Button><span className="flex gap-2"><Button variant="secondary" onClick={onClose}>Annuler</Button>{step < 3 ? <Button onClick={next}>Suivant</Button> : <Button onClick={submit}>Créer la mission</Button>}</span></>}>
      <div className="flex flex-col gap-5">
        <Stepper steps={STEPS} current={step} />
        {errors && <Callout tone="danger">{errors}</Callout>}
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><TextInput label="Nom de la mission" required value={f.name} onChange={(v) => k({ name: v })} placeholder="Ex. Audit légal 2026 — Client X" /></div>
            <Combobox label="Client" required value={f.clientId} onChange={(v) => k({ clientId: v })} options={s.clients.map((c) => ({ value: c.id, label: c.name, hint: c.sector }))} />
            <SelectInput label="Département" required value={f.departmentId} onChange={(v) => k({ departmentId: v })} options={s.departments.map((d) => ({ value: d.id, label: d.name }))} placeholder="Choisir" />
            <SelectInput label="Type de mission" value={f.type} onChange={(v) => k({ type: v })} options={TYPES.map((t) => ({ value: t, label: t }))} />
            <SelectInput label="Secteur" value={f.sector} onChange={(v) => k({ sector: v })} options={SECTORS.map((t) => ({ value: t, label: t }))} />
            <SelectInput label="Priorité" value={f.priority} onChange={(v) => k({ priority: v as Priority })} options={(Object.keys(PRIORITY) as Priority[]).map((p) => ({ value: p, label: PRIORITY[p].label }))} />
            <Combobox label="Responsable de mission" required value={f.leadId} onChange={(v) => k({ leadId: v })} options={leads.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}`, hint: s.grades.find((g) => g.id === e.gradeId)?.name }))} />
            <TextInput label="Référence (unique)" required value={f.reference} onChange={(v) => k({ reference: v })} hint="Identifiant de la mission" />
            <TextInput label="Numéro OTP (unique)" required value={f.otp} onChange={(v) => k({ otp: v })} hint="Clé partagée avec SBS 360°" />
            <div className="sm:col-span-2"><TextArea label="Description" rows={3} value={f.description} onChange={(v) => k({ description: v })} /></div>
          </div>
        )}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <DateInput label="Début" value={f.startDate} onChange={(v) => k({ startDate: v })} />
              <DateInput label="Fin" value={f.endDate} min={f.startDate} onChange={(v) => k({ endDate: v })} />
              <NumberInput label="Durée estimée" value={f.estimatedDays} suffix="j" min={1} onChange={(v) => k({ estimatedDays: v })} hint={`Calendrier : ${diffDays(f.startDate, f.endDate) + 1} jours`} />
            </div>
            <fieldset><legend className="mb-2 text-sm font-semibold text-ink">Phases</legend>
              {phases.map((p, i) => (<div key={i} className="mb-2 grid items-end gap-2 sm:grid-cols-[1fr_9em_9em_auto]"><TextInput label={i ? undefined : "Nom"} value={p.name} onChange={(v) => setPhases(phases.map((x, j) => (j === i ? { ...x, name: v } : x)))} /><DateInput label={i ? undefined : "Début"} value={p.startDate} onChange={(v) => setPhases(phases.map((x, j) => (j === i ? { ...x, startDate: v } : x)))} /><DateInput label={i ? undefined : "Fin"} value={p.endDate} onChange={(v) => setPhases(phases.map((x, j) => (j === i ? { ...x, endDate: v } : x)))} /><Button variant="ghost" size="sm" aria-label="Retirer la phase" onClick={() => setPhases(phases.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></div>))}
              <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setPhases([...phases, { name: "Nouvelle phase", startDate: f.startDate, endDate: f.endDate }])}>Ajouter une phase</Button></fieldset>
            <fieldset><legend className="mb-2 text-sm font-semibold text-ink">Jalons</legend>
              {miles.map((m, i) => (<div key={i} className="mb-2 grid items-end gap-2 sm:grid-cols-[1fr_9em_auto]"><TextInput value={m.name} onChange={(v) => setMiles(miles.map((x, j) => (j === i ? { ...x, name: v } : x)))} /><DateInput value={m.date} onChange={(v) => setMiles(miles.map((x, j) => (j === i ? { ...x, date: v } : x)))} /><Button variant="ghost" size="sm" aria-label="Retirer le jalon" onClick={() => setMiles(miles.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></div>))}
              <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setMiles([...miles, { name: "Nouveau jalon", date: f.endDate }])}>Ajouter un jalon</Button></fieldset>
          </div>
        )}
        {step === 2 && (canFin ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberInput label="Budget de la mission" suffix="DZD" min={0} step={100000} value={f.budget} onChange={(v) => k({ budget: v })} />
            <NumberInput label="Budget ressources" suffix="DZD" min={0} step={100000} value={f.resourceBudget} onChange={(v) => k({ resourceBudget: v })} />
            <NumberInput label="Coût journalier estimé" suffix="DZD / j" min={0} step={500} value={f.estimatedDailyCost} onChange={(v) => k({ estimatedDailyCost: v })} />
            <NumberInput label="Prix de vente journalier (si disponible)" suffix="DZD / j" min={0} step={1000} value={f.dailySellPrice} onChange={(v) => k({ dailySellPrice: v })} />
            <p className="text-xs text-text-muted sm:col-span-2">Devise : DZD. Ces champs ne sont visibles qu’avec la permission « budget et coûts des missions ».</p>
          </div>
        ) : <Callout tone="neutral" title="Données financières">Les champs financiers (budget, budget ressources, coût et prix journaliers) sont réservés aux profils habilités. Cette étape peut être ignorée : un Partner ou la Direction les complétera.</Callout>)}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text-secondary">Un besoin = un poste à pourvoir : grade minimum, quantité, compétences, période et % d’allocation.</p>
              <span className="flex gap-2">
                <Button variant="secondary" size="sm" icon={<Users className="size-4" />} onClick={() => setRows([newRow("g-4", 1), newRow("g-3", 2), newRow("g-1", 3)])}>Modèle : 1 Manager + 2 Seniors + 3 Juniors</Button>
                <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setRows([...rows, newRow("g-3", 1)])}>Ajouter un besoin</Button>
              </span>
            </div>
            {rows.length === 0 && <Callout tone="neutral">Aucun besoin pour l’instant.</Callout>}
            {rows.map((r, i) => (
              <div key={r.key} className="rounded-lg border border-border bg-canvas/50 p-3">
                <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold text-ink">Besoin {i + 1}</p><Button variant="ghost" size="sm" aria-label={`Retirer le besoin ${i + 1}`} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}><Trash2 className="size-4" /></Button></div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <SelectInput label="Grade minimum" value={r.gradeMin} onChange={(v) => updRow(r.key, { gradeMin: v })} options={s.grades.map((g) => ({ value: g.id, label: g.name }))} />
                  <NumberInput label="Quantité" min={1} value={r.quantity} onChange={(v) => updRow(r.key, { quantity: v })} />
                  <NumberInput label="Allocation" suffix="%" min={5} max={100} step={5} value={r.allocationPct} onChange={(v) => updRow(r.key, { allocationPct: v })} />
                  <NumberInput label="Expérience min." suffix="ans" min={0} value={r.minExperienceYears} onChange={(v) => updRow(r.key, { minExperienceYears: v })} />
                  <DateInput label="Début" value={r.startDate} onChange={(v) => updRow(r.key, { startDate: v })} />
                  <DateInput label="Fin" value={r.endDate} min={r.startDate} onChange={(v) => updRow(r.key, { endDate: v })} />
                  <SelectInput label="Priorité" value={r.priority} onChange={(v) => updRow(r.key, { priority: v as Priority })} options={(Object.keys(PRIORITY) as Priority[]).map((p) => ({ value: p, label: PRIORITY[p].label }))} />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MultiSelect label="Compétences obligatoires" values={r.mandatorySkillIds} onChange={(v) => updRow(r.key, { mandatorySkillIds: v })} options={skillOpts} />
                  <MultiSelect label="Compétences souhaitées" values={r.desiredSkillIds} onChange={(v) => updRow(r.key, { desiredSkillIds: v })} options={skillOpts} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
}
