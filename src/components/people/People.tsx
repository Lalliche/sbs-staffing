"use client";
import { Archive, FileUp, Plus, RotateCcw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { archiveEmployee, createEmployee, importEmployees, restoreEmployee, updateEmployee, validateEmployeeInput, validateImportRows, CONTRACT_LABEL, CONTRACTS, type EmployeeInput, type FieldErrors, type ImportRow } from "@/lib/store/actions/people";
import { filterPeople, peopleFilterOptions, peopleRows, PEOPLE_VIEWS, showsCost, STATUS_LABEL, viewCounts, type PeopleFilters, type PeopleRow, type PeopleView } from "@/lib/store/selectors/people";
import { downloadFile, toCsv } from "@/lib/download";
import { fmtDZD, fmtPct } from "@/lib/engine/format";
import { PersonCell } from "@/components/shared/PersonCell";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox, DateInput, NumberInput, Stepper } from "@/components/ui/Controls";
import { DataTable, SavedViews, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { SearchInput, SelectInput, TextArea, TextInput } from "@/components/ui/FormInputs";
import { PRESENCE_META, PresenceBadge } from "@/components/presence/PresenceBadge";
import { Callout, EmptyState, PageHeader, Skeleton } from "@/components/ui/Surface";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { useFirstLoad } from "@/components/app/useSkeleton";
import { SECTORS } from "@/lib/store/seed/referentials";
import type { AppState, Contract } from "@/lib/store/types";
import { Users } from "lucide-react";

const AVAIL_TONE = { LIBRE: "ok", PARTIELLE: "info", PLEINE: "primary", SURCHARGEE: "conflict", INDISPONIBLE: "neutral" } as const;
const AVAIL_LABEL = { LIBRE: "Libre", PARTIELLE: "Partielle", PLEINE: "Pleine", SURCHARGEE: "Surchargée", INDISPONIBLE: "Indisponible" } as const;

export function PeoplePage() {
  const { s, can } = useSession();
  const q = useQueryState();
  const router = useRouter();
  const toast = useToast();
  const loading = useFirstLoad();
  const [form, setForm] = useState<{ id?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [archiving, setArchiving] = useState<PeopleRow[] | null>(null);
  const [reason, setReason] = useState("");
  const all = useMemo(() => peopleRows(s), [s]);
  const f: PeopleFilters = { q: q.get("q"), dept: q.get("dept"), grade: q.get("grade"), office: q.get("bureau"), status: q.get("status"), skill: q.get("skill"), view: ((q.get("view") as PeopleView) || "tous") };
  const presenceF = q.get("presence");
  const rows = filterPeople(all, f).filter((r) => !presenceF || r.presence === presenceF);
  const counts = viewCounts(all, f);
  const opts = peopleFilterOptions(s);
  const cost = showsCost(all);
  const cols: Column<PeopleRow>[] = [
    { key: "name", header: "Collaborateur", required: true, cell: (r) => <PersonCell person={r.emp} sub={r.emp.email} />, sort: (a, b) => a.fullName.localeCompare(b.fullName), csv: (r) => r.fullName },
    { key: "mat", header: "Matricule", cell: (r) => <span className="font-mono text-xs">{r.emp.matricule}</span>, csv: (r) => r.emp.matricule, hideBelow: "lg" },
    { key: "job", header: "Poste", cell: (r) => r.emp.jobTitle, hideBelow: "lg", csv: (r) => r.emp.jobTitle },
    { key: "grade", header: "Grade", cell: (r) => r.gradeName, sort: (a, b) => b.gradeRank - a.gradeRank, csv: (r) => r.gradeName },
    { key: "dept", header: "Département", cell: (r) => r.departmentName, hideBelow: "md", csv: (r) => r.departmentName },
    { key: "mgr", header: "Manager", cell: (r) => r.managerName, defaultHidden: true, csv: (r) => r.managerName },
    { key: "skills", header: "Compétences principales", cell: (r) => <span className="flex flex-wrap gap-1">{r.topSkills.map((k) => <Badge key={k.name}>{k.name}</Badge>)}</span>, hideBelow: "lg", csv: (r) => r.topSkills.map((k) => k.name).join(" ; ") },
    { key: "util", header: "Utilisation (mois)", align: "end", cell: (r) => (r.utilization === null ? "—" : <span className={r.utilizationStatus === "OVER" ? "font-semibold text-conflict" : r.utilizationStatus === "UNDER" ? "text-alert" : ""}>{fmtPct(r.utilization)}</span>), sort: (a, b) => (a.utilization ?? -1) - (b.utilization ?? -1), csv: (r) => (r.utilization === null ? "" : Math.round(r.utilization)) },
    { key: "presence", header: "Aujourd’hui", cell: (r) => (r.presence ? <PresenceBadge presence={r.presence} short /> : "—"), csv: (r) => (r.presence ? PRESENCE_META[r.presence].label : ""), hideBelow: "md" },
    { key: "avail", header: "Disponibilité (4 sem.)", cell: (r) => <StatusPill tone={AVAIL_TONE[r.availability.status]} label={AVAIL_LABEL[r.availability.status]} />, csv: (r) => AVAIL_LABEL[r.availability.status] },
    ...(cost ? [{ key: "cost", header: "Coût journalier (DZD)", align: "end" as const, defaultHidden: true, cell: (r: PeopleRow) => (typeof r.emp.dailyCost === "number" ? fmtDZD(r.emp.dailyCost) : "—"), csv: (r: PeopleRow) => r.emp.dailyCost }] : []),
    { key: "status", header: "Statut", cell: (r) => <StatusPill tone={r.emp.status === "ACTIF" ? "ok" : r.emp.status === "ARCHIVE" ? "neutral" : "alert"} label={STATUS_LABEL[r.emp.status]} />, csv: (r) => STATUS_LABEL[r.emp.status] },
  ];
  const exportXls = () => { const cs = cols.filter((c) => c.csv && !c.defaultHidden); downloadFile("collaborateurs.xls", toCsv(cs.map((c) => c.header), rows.map((r) => cs.map((c) => c.csv!(r)))), "application/vnd.ms-excel"); };
  const doArchive = () => {
    const targets = archiving!;
    let done = 0;
    for (const t of targets) { const r = act((d) => archiveEmployee(d, t.id, reason)); if (r.ok) done++; else toast({ title: `Archivage refusé — ${t.fullName}`, body: r.error, tone: "warning" }); }
    if (done) toast({ title: `${done} collaborateur(s) archivé(s)`, body: "L’historique est conservé ; « Restaurer » reste possible." });
    setArchiving(null); setReason("");
  };
  return (
    <>
      <PageHeader title="Collaborateurs" description="Annuaire des collaborateurs : profil, compétences, charge et disponibilité calculées par le moteur." actions={<span className="flex flex-wrap gap-2">{can("employee.import") && <Button variant="secondary" icon={<Upload className="size-4" />} onClick={() => setImporting(true)}>Importer</Button>}<Button variant="secondary" onClick={exportXls}>Exporter (Excel)</Button>{can("employee.create") && <Button icon={<Plus className="size-4" />} onClick={() => setForm({})}>Nouveau collaborateur</Button>}</span>} />
      <SavedViews value={f.view!} onChange={(v) => q.set("view", v === "tous" ? null : v)} views={PEOPLE_VIEWS.map((v) => ({ ...v, count: counts[v.value] }))} />
      {loading ? <Skeleton className="h-72 w-full" /> : (
        <DataTable rows={rows} columns={cols} getId={(r) => r.id} caption="Collaborateurs" exportName="collaborateurs" selectable={can("employee.archive")} onRowClick={(r) => router.push(`/app/collaborateurs/${r.id}`)} pageSize={25}
          bulk={(sel, clear) => <><Button size="sm" variant="inverse" icon={<Archive className="size-4" />} onClick={() => { setArchiving(sel.filter((x) => x.emp.status !== "ARCHIVE")); clear(); }}>Archiver</Button></>}
          toolbar={<><SearchInput className="w-[18em]" value={f.q ?? ""} onChange={(v) => q.set("q", v || null)} placeholder="Nom, matricule, poste, compétence…" /><FilterBar values={{ presence: presenceF ?? "", dept: f.dept ?? "", grade: f.grade ?? "", bureau: f.office ?? "", status: f.status ?? "", skill: f.skill ?? "" }} onChange={(k, v) => q.set(k, v)} onClear={() => q.setMany({ dept: null, grade: null, bureau: null, status: null, skill: null, presence: null })} defs={[{ key: "presence", label: "Présence aujourd’hui", options: [{ value: "ONSITE", label: "Présentiel" }, { value: "REMOTE", label: "À distance" }, { value: "ABSENT", label: "Absent(e)" }] }, { key: "dept", label: "Département", options: opts.dept }, { key: "grade", label: "Grade", options: opts.grade }, { key: "bureau", label: "Bureau", options: opts.office }, { key: "status", label: "Statut", options: opts.status }, { key: "skill", label: "Compétence", options: opts.skill }]} /></>}
          empty={<EmptyState icon={Users} title="Aucun collaborateur" description="Aucun résultat pour ces critères." action={<Button variant="secondary" onClick={() => q.setMany({ q: null, dept: null, grade: null, bureau: null, status: null, skill: null, presence: null, view: null })}>Effacer les filtres</Button>} />}
          rowActions={(r) => (r.emp.status === "ARCHIVE" ? can("employee.archive") && <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => { const x = act((d) => restoreEmployee(d, r.id)); toast({ title: x.ok ? `${r.fullName} restauré(e)` : "Refusé", body: x.ok ? undefined : x.error }); }}>Restaurer</Button> : can("employee.archive") && <Button size="sm" variant="ghost" aria-label={`Archiver ${r.fullName}`} onClick={() => setArchiving([r])}><Archive className="size-4" /></Button>)} />
      )}
      {form && <EmployeeForm id={form.id} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); router.push(`/app/collaborateurs/${id}`); }} />}
      {importing && <ImportWizard onClose={() => setImporting(false)} />}
      <Modal open={!!archiving} onClose={() => setArchiving(null)} title={`Archiver ${archiving && archiving.length > 1 ? archiving.length + " collaborateurs" : archiving?.[0]?.fullName ?? ""}`} subtitle="Jamais supprimé : l’historique des missions et timesheets est conservé" footer={<><Button variant="secondary" onClick={() => setArchiving(null)}>Annuler</Button><Button variant="danger" disabled={reason.trim().length < 5} onClick={doArchive}>Archiver</Button></>}>
        <TextArea label="Motif (départ, fin de contrat…)" required rows={3} value={reason} onChange={setReason} />
        <Callout tone="alert" className="mt-3">Les affectations futures de la personne sont annulées ; les anciennes restent consultables.</Callout>
      </Modal>
    </>
  );
}

/* ---------------- create / edit form ---------------- */
const empty = (s: AppState): EmployeeInput => ({ matricule: `SBS-${1300 + s.employees.length}`, firstName: "", lastName: "", email: "", phone: "", jobTitle: "", gradeId: "g-2", departmentId: s.departments[0].id, officeId: s.offices[0].id, managerId: null, contract: "CDI", weeklyHours: 40, startDate: s.now, bio: "", yearsExperience: 0, sectors: [], languages: ["Français", "Arabe"], diplomas: [], dailyCost: undefined, dailyRate: undefined });
export function EmployeeForm({ id, onClose, onSaved }: { id?: string; onClose: () => void; onSaved: (id: string) => void }) {
  const { s, can } = useSession();
  const toast = useToast();
  const cur = id ? s.employees.find((e) => e.id === id) : undefined;
  const [v, setV] = useState<EmployeeInput>(() => (cur ? { ...cur } as EmployeeInput : empty(s)));
  const [errs, setErrs] = useState<FieldErrors>({});
  const money = can("employee.salary.read");
  const set = (p: Partial<EmployeeInput>) => setV((x) => ({ ...x, ...p }));
  const save = () => {
    const e = validateEmployeeInput(s, v, { selfId: id });
    setErrs(e);
    if (Object.keys(e).length) return;
    const r = act((d) => (id ? updateEmployee(d, id, v) : createEmployee(d, v)));
    if (!r.ok) return toast({ title: "Refusé", body: r.error, tone: "warning" });
    toast({ title: id ? "Fiche mise à jour" : "Collaborateur créé", body: "Modification journalisée." });
    onSaved(r.value.id);
  };
  return (
    <Drawer open onClose={onClose} dirty width="46em" title={id ? "Modifier le collaborateur" : "Nouveau collaborateur"} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save}>{id ? "Enregistrer" : "Créer"}</Button></>}>
      <div className="flex flex-col gap-6">
        <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold text-ink">Personnel</legend>
          <TextInput label="Prénom" required value={v.firstName} onChange={(x) => set({ firstName: x })} error={errs.firstName} /><TextInput label="Nom" required value={v.lastName} onChange={(x) => set({ lastName: x })} error={errs.lastName} />
          <TextInput label="E-mail" required type="email" value={v.email} onChange={(x) => set({ email: x })} error={errs.email} /><TextInput label="Téléphone" value={v.phone} onChange={(x) => set({ phone: x })} error={errs.phone} /></fieldset>
        <fieldset className="grid gap-4 sm:grid-cols-2"><legend className="mb-2 text-sm font-semibold text-ink">Professionnel</legend>
          <TextInput label="Matricule (unique)" required value={v.matricule} onChange={(x) => set({ matricule: x })} error={errs.matricule} /><TextInput label="Poste" required value={v.jobTitle} onChange={(x) => set({ jobTitle: x })} error={errs.jobTitle} />
          <SelectInput label="Grade" value={v.gradeId} onChange={(x) => set({ gradeId: x })} options={s.grades.map((g) => ({ value: g.id, label: g.name }))} /><SelectInput label="Département" value={v.departmentId} onChange={(x) => set({ departmentId: x })} options={s.departments.map((g) => ({ value: g.id, label: g.name }))} />
          <SelectInput label="Bureau" value={v.officeId} onChange={(x) => set({ officeId: x })} options={s.offices.map((g) => ({ value: g.id, label: g.name }))} />
          <Combobox label="Manager" value={v.managerId ?? ""} onChange={(x) => set({ managerId: x || null })} options={[{ value: "", label: "Aucun" }, ...s.employees.filter((e) => e.status !== "ARCHIVE" && e.id !== id && ["g-4", "g-5"].includes(e.gradeId)).map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))]} />
          <SelectInput label="Contrat" value={v.contract} onChange={(x) => set({ contract: x as Contract })} options={CONTRACTS.map((c) => ({ value: c, label: CONTRACT_LABEL[c] }))} /><NumberInput label="Heures par semaine" suffix="h" min={4} max={48} value={v.weeklyHours} onChange={(x) => set({ weeklyHours: x })} error={errs.weeklyHours} hint="Moins de 40 h = temps partiel" />
          <DateInput label="Date d’entrée" value={v.startDate} onChange={(x) => set({ startDate: x })} error={errs.startDate} /><DateInput label="Fin de contrat" value={v.endDate ?? ""} onChange={(x) => set({ endDate: x || undefined })} error={errs.endDate} />
          {money && <><NumberInput label="Coût journalier" suffix="DZD" min={0} step={500} value={v.dailyCost ?? 0} onChange={(x) => set({ dailyCost: x })} /><NumberInput label="Tarif journalier" suffix="DZD" min={0} step={1000} value={v.dailyRate ?? 0} onChange={(x) => set({ dailyRate: x })} /></>}</fieldset>
        <fieldset className="grid gap-4"><legend className="mb-2 text-sm font-semibold text-ink">Profil et complémentaire</legend>
          <TextArea label="Biographie" rows={3} value={v.bio} onChange={(x) => set({ bio: x })} /><NumberInput label="Années d’expérience" min={0} value={v.yearsExperience} onChange={(x) => set({ yearsExperience: x })} />
          <TextInput label="Secteurs (séparés par des virgules)" value={v.sectors.join(", ")} onChange={(x) => set({ sectors: x.split(",").map((t) => t.trim()).filter(Boolean) })} hint={`Ex. ${SECTORS.slice(0, 3).join(", ")}`} /><TextInput label="Langues" value={v.languages.join(", ")} onChange={(x) => set({ languages: x.split(",").map((t) => t.trim()).filter(Boolean) })} /><TextInput label="Diplômes" value={v.diplomas.join(", ")} onChange={(x) => set({ diplomas: x.split(",").map((t) => t.trim()).filter(Boolean) })} /></fieldset>
      </div>
    </Drawer>
  );
}

/* ---------------- import wizard ---------------- */
const FIELDS = [["matricule", "Matricule"], ["firstName", "Prénom"], ["lastName", "Nom"], ["email", "E-mail"], ["jobTitle", "Poste"], ["gradeId", "Grade"], ["departmentId", "Département"], ["officeId", "Bureau"], ["contract", "Contrat"], ["weeklyHours", "Heures/sem."], ["startDate", "Date d’entrée"]] as const;
const SAMPLE = `matricule;prenom;nom;email;poste;grade;departement;bureau;contrat;heures;debut
SBS-2101;Aïcha;Merzouk;aicha.merzouk@sbs-demo.example;Auditrice;Consultant;Audit;Alger;CDI;40;2026-11-01
SBS-2102;Omar;Taibi;omar.taibi@sbs-demo.example;Juriste-fiscaliste;Junior;Conseil juridique & fiscal;Oran;CDI;40;2026-11-15
SBS-2103;Lydia;Benhamou;lydia.benhamou@sbs-demo.example;Consultante stratégie;Senior;Stratégie & conseil;Alger;CDI;40;2026-10-01
SBS-2104;Réda;Mebarki;reda.mebarki@sbs-demo.example;Analyste;Directeur;Transactions;Alger;CDD;40;2026-11-20
SBS-2105;Nina;Aliouche;nina.aliouche@sbs-demo.example;Assistante comptable;Junior;Expertise comptable;Oran;CDI;32;2026-11-08
SBS-2106;Samir;Hadjeres;samir.hadjeres@sbs-demo.example;Auditeur;Consultant;Audit;Alger;CDI;40;2026-11-12`;
const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const HEAD_ALIAS: Record<string, string> = { matricule: "matricule", prenom: "firstName", nom: "lastName", email: "email", poste: "jobTitle", grade: "gradeId", departement: "departmentId", bureau: "officeId", contrat: "contract", heures: "weeklyHours", debut: "startDate" };

function ImportWizard({ onClose }: { onClose: () => void }) {
  const { s } = useSession();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState("");
  const [table, setTable] = useState<string[][]>([]);
  const [map, setMap] = useState<Record<number, string>>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [result, setResult] = useState<{ created: number; rejected: { line: number; errors: FieldErrors }[] } | null>(null);
  const parse = (text: string, name: string) => {
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
    const t = lines.map((l) => l.split(l.includes(";") ? ";" : ","));
    setTable(t); setFile(name);
    setMap(Object.fromEntries(t[0].map((h, i) => [i, HEAD_ALIAS[norm(h)] ?? ""])));
  };
  const toInput = (cells: string[], m: Record<number, string>): Partial<EmployeeInput> => {
    const o: Record<string, unknown> = { phone: "", bio: "", yearsExperience: 0, sectors: [], languages: ["Français"], diplomas: [], managerId: null };
    cells.forEach((c, i) => {
      const f = m[i]; if (!f) return;
      const v = c.trim();
      if (f === "gradeId") o[f] = s.grades.find((g) => norm(g.name) === norm(v))?.id ?? v;
      else if (f === "departmentId") o[f] = s.departments.find((g) => norm(g.name) === norm(v))?.id ?? v;
      else if (f === "officeId") o[f] = s.offices.find((g) => norm(g.city) === norm(v) || norm(g.name) === norm(v))?.id ?? v;
      else if (f === "weeklyHours") o[f] = Number(v);
      else o[f] = v;
    });
    return o as Partial<EmployeeInput>;
  };
  const goValidate = () => { setRows(table.slice(1).map((c, i) => ({ line: i + 1, input: toInput(c, map) }))); setStep(2); };
  const errors = useMemo(() => validateImportRows(s, rows), [s, rows]);
  const fix = (line: number, patch: Partial<EmployeeInput>) => setRows((r) => r.map((x) => (x.line === line ? { ...x, input: { ...x.input, ...patch } } : x)));
  const run = () => {
    const r = act((d) => importEmployees(d, rows, { fileName: file || "import.csv" }));
    if (!r.ok) return toast({ title: "Import refusé", body: r.error, tone: "warning" });
    setResult({ created: r.value.created.length, rejected: r.value.rejected.map((x) => ({ line: x.line, errors: x.errors })) });
    setStep(3);
  };
  const errCount = errors.size;
  const report = () => downloadFile("rapport-erreurs-import.csv", toCsv(["Ligne", "Champ", "Erreur"], (result?.rejected ?? []).flatMap((x) => Object.entries(x.errors).map(([f, e]) => [x.line, f, e]))));
  return (
    <Drawer open onClose={onClose} width="62em" title="Importer des collaborateurs" subtitle="Fichier → correspondance des colonnes → contrôle → résultat" dirty={step > 0 && step < 3}
      footer={<><Button variant="ghost" disabled={step === 0 || step === 3} onClick={() => setStep(step - 1)}>Précédent</Button><span className="flex gap-2">{step === 0 && <Button disabled={!table.length} onClick={() => setStep(1)}>Suivant</Button>}{step === 1 && <Button onClick={goValidate}>Contrôler</Button>}{step === 2 && <Button onClick={run}>{errCount ? `Importer (${rows.length - errCount} valides, ${errCount} rejetée${errCount > 1 ? "s" : ""})` : "Importer"}</Button>}{step === 3 && <Button onClick={onClose}>Terminer</Button>}</span></>}>
      <div className="flex flex-col gap-5">
        <Stepper steps={["Fichier", "Colonnes", "Contrôle", "Résultat"]} current={step} />
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-canvas px-6 py-10 text-center hover:border-primary"><FileUp className="size-6 text-text-muted" aria-hidden /><span className="text-sm font-medium text-ink">Choisir un fichier CSV</span><span className="text-xs text-text-muted">Séparateur « ; » ou « , » — première ligne = en-têtes</span><input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) parse(await f.text(), f.name); }} /></label>
            <div className="flex items-center gap-3"><span className="h-px flex-1 bg-border" /><span className="text-xs text-text-muted">ou</span><span className="h-px flex-1 bg-border" /></div>
            <Button variant="secondary" onClick={() => parse(SAMPLE, "exemple-collaborateurs.csv")}>Utiliser le fichier d’exemple (contient volontairement une ligne invalide)</Button>
            {table.length > 0 && <Callout tone="success" title={`${file} — ${table.length - 1} ligne(s) détectée(s)`}>Colonnes : {table[0].join(", ")}</Callout>}
          </div>
        )}
        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">{table[0].map((h, i) => <SelectInput key={i} label={`Colonne « ${h} »`} value={map[i] ?? ""} onChange={(v) => setMap({ ...map, [i]: v })} options={[{ value: "", label: "Ignorer" }, ...FIELDS.map(([k, l]) => ({ value: k, label: l }))]} hint={`Exemple : ${table[1]?.[i] ?? ""}`} />)}</div>
        )}
        {step === 2 && (
          <div className="flex flex-col gap-3">
            <Callout tone={errCount ? "alert" : "success"} title={errCount ? `${errCount} ligne(s) à corriger` : "Toutes les lignes sont valides"}>{errCount ? "Corrigez directement dans le tableau, ou importez : les lignes invalides seront rejetées et listées dans un rapport." : "Vous pouvez lancer l’import."}</Callout>
            <div className="scroll-thin overflow-x-auto rounded-lg border border-border"><table className="w-full text-xs"><caption className="sr-only">Contrôle des lignes</caption><thead className="bg-paper/60"><tr><th className="px-2 py-1.5 text-start">#</th>{FIELDS.map(([, l]) => <th key={l} className="px-2 text-start font-medium">{l}</th>)}<th className="px-2 text-start">État</th></tr></thead>
              <tbody>{rows.map((r) => { const er = errors.get(r.line); const val = (k: string) => String((r.input as Record<string, unknown>)[k] ?? ""); return (
                <tr key={r.line} className={er ? "bg-conflict-bg/40" : ""}><td className="px-2 py-1 tabular-nums">{r.line}</td>{FIELDS.map(([k]) => { const e = er?.[k as keyof EmployeeInput]; const isRef = k === "gradeId" || k === "departmentId" || k === "officeId"; const list = k === "gradeId" ? s.grades : k === "departmentId" ? s.departments : s.offices; return (
                  <td key={k} className="px-1 py-1 align-top">{e ? (isRef ? <select aria-label={`${k} ligne ${r.line}`} value={val(k)} onChange={(ev) => fix(r.line, { [k]: ev.target.value })} className="w-full rounded border border-conflict bg-bg px-1 py-1"><option value="">Choisir…</option>{list.map((x) => <option key={x.id} value={x.id}>{"city" in x ? x.city : x.name}</option>)}</select> : <input aria-label={`${k} ligne ${r.line}`} value={val(k)} onChange={(ev) => fix(r.line, { [k]: k === "weeklyHours" ? Number(ev.target.value) : ev.target.value })} className="w-full rounded border border-conflict bg-bg px-1 py-1" />) : <span className="px-1">{isRef ? (list.find((x) => x.id === val(k)) ? ("city" in list[0] ? (list as typeof s.offices).find((x) => x.id === val(k))?.city : (list as typeof s.grades).find((x) => x.id === val(k))?.name) : val(k)) : val(k)}</span>}{e && <span className="block text-2xs text-conflict">{e}</span>}</td>); })}<td className="px-2 py-1">{er ? <StatusPill tone="conflict" label="Erreur" /> : <StatusPill tone="ok" label="Valide" />}</td></tr>); })}</tbody></table></div>
          </div>
        )}
        {step === 3 && result && (
          <div className="flex flex-col gap-3"><Callout tone="success" title={`${result.created} collaborateur(s) créé(s)`}>L’import est journalisé dans l’audit (fichier, lignes, rejets).</Callout>
            {result.rejected.length > 0 && <Callout tone="alert" title={`${result.rejected.length} ligne(s) rejetée(s)`} action={<Button size="sm" variant="secondary" onClick={report}>Rapport d’erreurs (CSV)</Button>}>{result.rejected.map((x) => `Ligne ${x.line} : ${Object.values(x.errors).join(" ; ")}`).join(" — ")}</Callout>}</div>
        )}
      </div>
    </Drawer>
  );
}
