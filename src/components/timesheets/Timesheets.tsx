"use client";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Download, Lock, PencilLine, Plus, Save, Send, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { openCorrection, rejectTimesheet, remindLate, requestCorrection, saveWeek, submitTimesheet, validateMany, validateTimesheet, type EntryInput } from "@/lib/store/actions/timesheets";
import { ACTIVITY_LABEL, ACTIVITY_TYPES, canCorrect, exportLines, exportSheets, historySheets, lateDrafts, monthUtilization, prefillPlan, queueStats, recentWeeks, toXlsHtml, validationQueue, weekModel, type SheetSummary } from "@/lib/store/selectors/timesheets";
import { addDays, weekStart } from "@/lib/engine/dates";
import { fmtDate, fmtDateShort, fmtHours, fmtPct, fmtWeekday } from "@/lib/engine/format";
import { downloadFile, toCsv } from "@/lib/download";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Controls";
import { Checkbox, SelectInput, TextArea } from "@/components/ui/FormInputs";
import { Callout, Card, CardHeader, EmptyState, PageHeader, Skeleton } from "@/components/ui/Surface";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useFirstLoad } from "@/components/app/useSkeleton";
import { PersonCell } from "@/components/shared/PersonCell";
import { TIMESHEET_STATUS } from "@/lib/ui-domain";
import type { ActivityType, ISODate } from "@/lib/store/types";

type View = "mes" | "validation" | "historique";

export function TimesheetsPage() {
  const { s, can, emp } = useSession();
  const q = useQueryState();
  const loading = useFirstLoad();
  const stats = queueStats(s);
  const tabs: { value: View; label: string; count?: number }[] = [
    ...(can("timesheet.own") ? [{ value: "mes" as View, label: "Mes timesheets" }] : []),
    ...(can("timesheet.view") || can("timesheet.validate") ? [{ value: "validation" as View, label: "Validation", count: stats.pending }, { value: "historique" as View, label: "Historique" }] : []),
  ];
  const view = (q.get("vue") as View) || (!emp ? tabs.find((t) => t.value !== "mes")?.value : tabs[0]?.value) || "mes";
  return (
    <>
      <PageHeader title="Timesheets" description="Saisie hebdomadaire des heures, soumission, validation par le manager. Une feuille validée est verrouillée : seule une correction tracée la rouvre." />
      {tabs.length > 1 && <Tabs label="Vues" value={view} onChange={(v) => q.set("vue", v)} items={tabs} className="mb-5" />}
      {loading ? <Skeleton className="h-72 w-full" /> : view === "mes" && emp ? <MyWeek employeeId={q.get("employee") && (can("timesheet.view") || can("timesheet.validate")) ? q.get("employee") : emp.id} /> : view === "validation" ? <Validation /> : view === "historique" ? <History /> : <EmptyState icon={Lock} title="Aucune feuille de temps" description="Votre profil n’a pas de feuille de temps personnelle." />}
    </>
  );
}

/* ---------------- collaborateur: weekly grid ---------------- */
function MyWeek({ employeeId }: { employeeId: string }) {
  const { s } = useSession();
  const q = useQueryState();
  const week = weekStart(q.get("week") || s.now);
  const m = weekModel(s, employeeId, week);
  if (!m) return <EmptyState icon={Lock} title="Feuille inaccessible" />;
  const util = monthUtilization(s, employeeId);
  const jump = recentWeeks(s, employeeId, 8);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_17em]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1"><IconButton label="Semaine précédente" onClick={() => q.set("week", addDays(week, -7))}><ChevronLeft className="size-4" /></IconButton><h2 className="px-2 text-md font-semibold text-ink">Semaine du {fmtDate(week)}</h2><IconButton label="Semaine suivante" onClick={() => q.set("week", addDays(week, 7))}><ChevronRight className="size-4" /></IconButton><Button size="sm" variant="secondary" onClick={() => q.set("week", null)}>Cette semaine</Button></div>
          <StatusPill tone={TIMESHEET_STATUS[m.status].tone} label={TIMESHEET_STATUS[m.status].label} />
        </div>
        {m.banner && <Callout tone={m.banner.tone === "danger" ? "danger" : m.banner.tone === "alert" ? "alert" : "info"} title={m.banner.title} className="mb-3">{m.banner.comment}</Callout>}
        {m.lockReason && <Callout tone="neutral" className="mb-3"><span className="flex items-center gap-2"><Lock className="size-4 shrink-0" aria-hidden />{m.lockReason}</span></Callout>}
        <Grid key={`${m.week}-${m.timesheet?.id}-${m.status}-${m.rows.length}`} m={m} />
      </div>
      <div className="flex flex-col gap-4">
        {util && <Card><CardHeader title="Ce mois-ci" description="Utilisation recalculée à chaque validation" /><dl className="space-y-2 text-sm"><div className="flex justify-between"><dt className="text-text-secondary">Planifiée</dt><dd className="tabular-nums font-medium">{fmtPct(util.planned)}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Réelle (heures validées)</dt><dd className="tabular-nums font-medium">{fmtPct(util.real)}</dd></div><div className="flex justify-between"><dt className="text-text-secondary">Facturable</dt><dd className="tabular-nums font-medium">{fmtPct(util.billability)}</dd></div></dl></Card>}
        <Card><CardHeader title="Semaines récentes" /><ul className="flex flex-col">{jump.map((j) => <li key={j.week}><button type="button" onClick={() => q.set("week", j.week === weekStart(s.now) ? null : j.week)} className={cn("flex w-full items-center justify-between rounded px-2 py-1.5 text-sm hover:bg-paper", j.week === week && "bg-select")}><span>{fmtDateShort(j.week)}</span><span className="flex items-center gap-2"><span className="tabular-nums text-xs text-text-muted">{j.exists ? fmtHours(j.total) : "—"}</span><StatusPill tone={j.exists ? TIMESHEET_STATUS[j.status].tone : "neutral"} label={j.exists ? TIMESHEET_STATUS[j.status].label : "Non créée"} /></span></button></li>)}</ul></Card>
      </div>
    </div>
  );
}

interface RowDraft { projectId: string; label: string; sub: string; billable: boolean; activityType: ActivityType; description: string; hours: Record<ISODate, number> }
function Grid({ m }: { m: NonNullable<ReturnType<typeof weekModel>> }) {
  const { s } = useSession();
  const toast = useToast();
  const [rows, setRows] = useState<RowDraft[]>(() => m.rows.map((r) => ({ projectId: r.projectId, label: r.label, sub: r.sub, billable: r.billable, activityType: r.activityType, description: Object.values(r.cells).find((c) => c?.description)?.description ?? "", hours: Object.fromEntries(Object.entries(r.cells).map(([d, c]) => [d, c?.hours ?? 0])) })));
  const [err, setErr] = useState<string | null>(null);
  const edit = m.canEdit;
  const dayTotal = (d: ISODate) => rows.reduce((a, r) => a + (r.hours[d] ?? 0), 0);
  const total = m.days.reduce((a, d) => a + dayTotal(d.date), 0);
  const entries = (): EntryInput[] => rows.flatMap((r) => Object.entries(r.hours).filter(([, h]) => h > 0).map(([date, hours]) => ({ projectId: r.projectId, date, hours, billable: r.billable, activityType: r.activityType, description: r.description || "Saisie hebdomadaire" })));
  const save = (submit: boolean) => {
    const res = act((d) => { const r = saveWeek(d, m.employee.id, m.week, entries()); if (!r.ok || !submit) return r; return submitTimesheet(d, r.value.id); });
    if (!res.ok) { setErr(res.error); return; }
    setErr(null);
    toast({ title: submit ? "Timesheet soumise" : "Brouillon enregistré", body: submit ? "Votre manager est notifié ; la feuille est verrouillée jusqu’à sa décision." : undefined });
  };
  const prefill = () => {
    const plan = prefillPlan(s, m.employee.id, m.week);
    setRows((cur) => {
      const next = cur.map((r) => ({ ...r, hours: { ...r.hours } }));
      for (const p of plan) {
        let r = next.find((x) => x.projectId === p.projectId);
        if (!r) { const pr = s.projects.find((x) => x.id === p.projectId); r = { projectId: p.projectId, label: pr?.name ?? p.projectId, sub: pr?.reference ?? "", billable: true, activityType: "REALISATION", description: "", hours: {} }; next.push(r); }
        r.hours[p.date] = p.hours;
      }
      return next;
    });
    toast({ title: "Pré-rempli d’après vos affectations", body: "Ajustez si besoin avant d’enregistrer." });
  };
  const add = (id: string) => { const a = m.addableProjects.find((x) => x.id === id); if (a && !rows.some((r) => r.projectId === id)) setRows([...rows, { projectId: id, label: a.label, sub: a.sub, billable: !id.startsWith("INT-"), activityType: id.startsWith("INT-FORM") ? "FORMATION" : id.startsWith("INT-") ? "ADMINISTRATIF" : "REALISATION", description: "", hours: {} }]); };
  return (
    <Card className="!p-0">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[46em] text-sm"><caption className="sr-only">Saisie des heures de la semaine</caption>
          <thead className="bg-paper/60 text-xs"><tr><th className="px-4 py-2 text-start font-medium text-text-secondary">Mission / code interne</th>{m.days.map((d) => <th key={d.date} scope="col" className={cn("w-[5.2em] px-1 py-2 text-center font-medium", d.reason ? "text-text-muted" : "text-text-secondary")} title={d.reason}><span className="block capitalize">{fmtWeekday(d.date)}</span><span className="block tabular-nums">{d.date.slice(8)}</span>{d.reason && <span className="block text-2xs font-normal">{d.holiday ? "Férié" : d.leave ? "Congé" : "—"}</span>}</th>)}<th className="w-14 px-2 text-end font-medium text-text-secondary">Total</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={m.days.length + 2}><EmptyState icon={PencilLine} title="Aucune ligne" description="Pré-remplissez d’après vos affectations ou ajoutez une mission." /></td></tr>}
            {rows.map((r, ri) => (
              <tr key={r.projectId} className="border-t border-line align-top">
                <td className="px-4 py-2"><span className="block font-medium text-ink">{r.label}</span><span className="block text-2xs text-text-muted">{r.sub}</span>
                  {edit && <span className="mt-1.5 flex flex-wrap items-center gap-2"><label className="flex items-center gap-1.5 text-xs"><Checkbox checked={r.billable} onChange={(v) => setRows(rows.map((x, i) => (i === ri ? { ...x, billable: v } : x)))} label={<span className="text-xs">Facturable</span>} /></label><select aria-label={`Activité — ${r.label}`} value={r.activityType} onChange={(e) => setRows(rows.map((x, i) => (i === ri ? { ...x, activityType: e.target.value as ActivityType } : x)))} className="rounded border border-border-strong bg-bg px-1.5 py-0.5 text-xs">{ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{ACTIVITY_LABEL[a]}</option>)}</select></span>}
                  {edit && <input aria-label={`Description — ${r.label}`} value={r.description} onChange={(e) => setRows(rows.map((x, i) => (i === ri ? { ...x, description: e.target.value } : x)))} placeholder="Description (optionnelle)" className="mt-1.5 w-full rounded border border-border bg-bg px-2 py-1 text-xs placeholder:text-text-muted" />}
                </td>
                {m.days.map((d) => <td key={d.date} className={cn("px-1 py-2 text-center", d.reason && "bg-[#efece4] bg-[image:var(--hatch-absent)]")}><input aria-label={`${r.label} — ${fmtDate(d.date)}`} type="number" inputMode="decimal" min={0} max={24} step={0.5} disabled={!edit} value={r.hours[d.date] || ""} onChange={(e) => setRows(rows.map((x, i) => (i === ri ? { ...x, hours: { ...x.hours, [d.date]: Number(e.target.value) } } : x)))} className="h-8 w-[4.2em] rounded border border-border-strong bg-bg text-center tabular-nums disabled:border-transparent disabled:bg-transparent" /></td>)}
                <td className="px-2 py-2 text-end tabular-nums font-medium">{Object.values(r.hours).reduce((a, h) => a + h, 0)}</td>
              </tr>))}
          </tbody>
          <tfoot className="border-t-2 border-border bg-paper/50 text-sm font-semibold"><tr><td className="px-4 py-2">Total de la semaine <span className="font-normal text-text-muted">· attendu {fmtHours(m.expected)}</span></td>{m.days.map((d) => <td key={d.date} className={cn("px-1 text-center tabular-nums", dayTotal(d.date) > s.settings.maxDailyHours && "text-conflict")}>{dayTotal(d.date) || ""}</td>)}<td className="px-2 text-end tabular-nums">{total}</td></tr></tfoot>
        </table>
      </div>
      {m.anomalies.length > 0 && <div className="border-t border-border p-3"><p className="mb-1.5 text-xs font-medium text-text-secondary">Anomalies détectées</p><ul className="flex flex-col gap-1">{m.anomalies.map((a, i) => <li key={i} className="flex items-start gap-2 text-xs"><Badge tone={a.severity === "ALERT" ? "alert" : "info"} icon>{a.label}</Badge><span className="text-text-secondary">{a.message}</span></li>)}</ul></div>}
      {err && <div className="border-t border-border p-3"><Callout tone="danger">{err}</Callout></div>}
      {edit && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-paper/40 p-3">
          <span className="flex flex-wrap items-center gap-2"><Button size="sm" variant="secondary" icon={<Wand2 className="size-4" />} onClick={prefill}>Pré-remplir d’après mes affectations</Button><div className="w-[16em]"><Combobox value="" onChange={add} placeholder="Ajouter une mission ou un code" options={m.addableProjects.filter((p) => !rows.some((r) => r.projectId === p.id)).map((p) => ({ value: p.id, label: p.label, hint: p.sub }))} /></div><Plus className="hidden" /></span>
          <span className="flex gap-2"><Button variant="secondary" icon={<Save className="size-4" />} onClick={() => save(false)}>Enregistrer le brouillon</Button><Button icon={<Send className="size-4" />} disabled={total <= 0} onClick={() => save(true)}>Soumettre</Button></span>
        </div>
      )}
    </Card>
  );
}

/* ---------------- manager: validation ---------------- */
function Validation() {
  const { s, can } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const queue = validationQueue(s);
  const late = lateDrafts(s);
  const exp = (kind: "csv" | "xls") => {
    const sel = queue.filter((x) => !picked.length || picked.includes(x.id));
    const e = exportSheets(s, sel);
    if (kind === "csv") downloadFile("timesheets.csv", toCsv(e.header, e.rows));
    else downloadFile("timesheets.xls", toXlsHtml(e.header, e.rows), "application/vnd.ms-excel");
    toast({ title: "Export prêt", body: `${sel.length} feuille(s).` });
  };
  const cleanIds = queue.filter((x) => x.clean && x.decide).map((x) => x.id);
  return (
    <div className="flex flex-col gap-5">
      <Card className="!p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
          <div><h2 className="text-md font-semibold text-ink">Feuilles à valider</h2><p className="text-xs text-text-secondary">{queue.length} en attente · {cleanIds.length} sans anomalie</p></div>
          <span className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={() => exp("csv")}>CSV</Button><Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={() => exp("xls")}>Excel</Button><Button size="sm" icon={<CheckCheck className="size-4" />} disabled={!cleanIds.length} onClick={() => { const r = act((d) => validateMany(d, cleanIds)); if (r.ok) toast({ title: `${r.value.done} feuille(s) validée(s)`, body: "Utilisation réelle recalculée." }); }}>Valider les feuilles sans anomalie ({cleanIds.length})</Button></span>
        </div>
        {queue.length === 0 ? <EmptyState icon={CheckCheck} title="Rien à valider" description="Toutes les feuilles soumises ont été traitées." /> : (
          <table className="w-full text-sm"><caption className="sr-only">File de validation</caption><thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="w-10 ps-4" /><th className="px-3 py-2 text-start font-medium">Collaborateur</th><th className="px-3 text-start font-medium">Semaine du</th><th className="px-3 text-end font-medium">Heures</th><th className="px-3 text-end font-medium">Facturables</th><th className="px-3 text-start font-medium">Anomalies</th><th className="w-24" /></tr></thead>
            <tbody>{queue.map((x) => (
              <tr key={x.id} className="border-t border-line">
                <td className="ps-4"><Checkbox checked={picked.includes(x.id)} onChange={(v) => setPicked(v ? [...picked, x.id] : picked.filter((i) => i !== x.id))} label={<span className="sr-only">Sélectionner</span>} /></td>
                <td className="px-3 py-2"><PersonCell person={{ firstName: x.firstName, lastName: x.lastName, departmentId: x.departmentId }} sub={x.matricule} /></td>
                <td className="px-3 tabular-nums">{fmtDate(x.weekStart)}</td><td className="px-3 text-end tabular-nums">{fmtHours(x.total)} <span className="text-text-muted">/ {fmtHours(x.expected)}</span></td><td className="px-3 text-end tabular-nums">{fmtHours(x.billable)}</td>
                <td className="px-3">{x.anomalies.filter((a) => a.severity === "ALERT").length ? <span className="flex flex-wrap gap-1">{x.anomalies.filter((a) => a.severity === "ALERT").map((a, i) => <Badge key={i} tone="alert" icon>{a.label}</Badge>)}</span> : <StatusPill tone="ok" label="Aucune" />}</td>
                <td className="px-3 text-end"><Button size="sm" variant="secondary" onClick={() => setOpen(x.id)}>Examiner</Button></td></tr>))}</tbody></table>
        )}
      </Card>
      {late.length > 0 && (
        <Card><CardHeader title="Rappels" description="Feuilles de semaines écoulées non soumises" /><ul>{late.map((x) => <li key={x.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0"><span><span className="font-medium text-ink">{x.employeeName}</span> <span className="text-text-muted">· semaine du {fmtDate(x.weekStart)}</span></span>{can("timesheet.validate") && <Button size="sm" variant="secondary" icon={<Bell className="size-4" />} onClick={() => { act((d) => remindLate(d, x.id)); toast({ title: "Rappel envoyé", body: x.employeeName }); }}>Relancer</Button>}</li>)}</ul></Card>
      )}
      {open && <SheetDrawer id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function SheetDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { s } = useSession();
  const toast = useToast();
  const ts = s.timesheets.find((t) => t.id === id);
  const m = ts ? weekModel(s, ts.employeeId, ts.weekStart) : undefined;
  const [ask, setAsk] = useState<null | "reject" | "correction">(null);
  const [comment, setComment] = useState("");
  if (!ts || !m) return null;
  const can = m.timesheet?.status === "SOUMIS" && !m.own;
  const decide = (kind: "ok" | "reject" | "correction") => {
    const r = act((d) => (kind === "ok" ? validateTimesheet(d, id) : kind === "reject" ? rejectTimesheet(d, id, comment) : requestCorrection(d, id, comment)));
    toast({ title: r.ok ? (kind === "ok" ? "Feuille validée — verrouillée" : kind === "reject" ? "Feuille rejetée" : "Correction demandée") : "Refusé", body: r.ok ? undefined : r.error, tone: r.ok ? "success" : "warning" });
    if (r.ok) onClose();
  };
  return (
    <>
      <Drawer open onClose={onClose} width="48em" title={`${m.employeeName} — semaine du ${fmtDate(m.week)}`} subtitle={`${fmtHours(m.total)} saisies · ${fmtHours(m.billable)} facturables · attendu ${fmtHours(m.expected)}`}
        footer={<><StatusPill tone={TIMESHEET_STATUS[m.status].tone} label={TIMESHEET_STATUS[m.status].label} />{can && <span className="flex gap-2"><Button variant="secondary" onClick={() => { setAsk("correction"); setComment(""); }}>Demander une correction</Button><Button variant="secondary" onClick={() => { setAsk("reject"); setComment(""); }}>Rejeter</Button><Button icon={<CheckCheck className="size-4" />} onClick={() => decide("ok")}>Valider</Button></span>}</>}>
        {m.anomalies.length > 0 ? <ul className="mb-4 flex flex-col gap-2">{m.anomalies.map((a, i) => <li key={i} className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", a.severity === "ALERT" ? "border-alert/30 bg-alert-bg text-alert" : "border-border bg-paper text-text-secondary")}><span className="font-semibold">{a.label} — </span>{a.message}</li>)}</ul> : <Callout tone="success" className="mb-4">Aucune anomalie détectée.</Callout>}
        <table className="w-full text-sm"><caption className="sr-only">Détail des heures</caption><thead className="text-xs text-text-secondary"><tr><th className="py-1 text-start font-medium">Mission</th>{m.days.map((d) => <th key={d.date} className="px-1 text-center font-medium capitalize">{fmtWeekday(d.date)}<span className="block tabular-nums">{d.date.slice(8)}</span></th>)}<th className="text-end font-medium">Total</th></tr></thead>
          <tbody>{m.rows.map((r) => <tr key={r.projectId} className="border-t border-line"><td className="py-1.5 pe-2"><span className="block font-medium text-ink">{r.label}</span><span className="text-2xs text-text-muted">{r.billable ? "Facturable" : "Non facturable"}</span></td>{m.days.map((d) => <td key={d.date} className={cn("px-1 text-center tabular-nums", d.reason && "bg-[#efece4]")}>{r.cells[d.date]?.hours || ""}</td>)}<td className="text-end font-medium tabular-nums">{r.total}</td></tr>)}</tbody></table>
        {ts.corrections.length > 0 && <div className="mt-4"><p className="mb-1 text-xs font-medium text-text-secondary">Corrections tracées</p><ul className="text-xs">{ts.corrections.map((c, i) => <li key={i} className="border-l-2 border-alert pl-2">{fmtDate(c.ts)} — {c.reason}</li>)}</ul></div>}
      </Drawer>
      <Modal open={!!ask} onClose={() => setAsk(null)} title={ask === "reject" ? "Rejeter la feuille" : "Demander une correction"} subtitle="Le commentaire est transmis au collaborateur" footer={<><Button variant="secondary" onClick={() => setAsk(null)}>Retour</Button><Button disabled={!comment.trim()} onClick={() => { decide(ask === "reject" ? "reject" : "correction"); setAsk(null); }}>Confirmer</Button></>}>
        <TextArea label="Commentaire (obligatoire)" required rows={3} value={comment} onChange={setComment} />
      </Modal>
    </>
  );
}

/* ---------------- history + traced correction ---------------- */
function History() {
  const { s, can } = useSession();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [corr, setCorr] = useState<SheetSummary | null>(null);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const list = useMemo(() => historySheets(s, { status: (status || undefined) as never }), [s, status]);
  const lines = () => { const e = exportLines(s, list); downloadFile("timesheets-detail.csv", toCsv(e.header, e.rows)); };
  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3"><SelectInput label="" value={status} onChange={setStatus} options={[{ value: "", label: "Tous les statuts" }, { value: "VALIDE", label: "Validées" }, { value: "REJETE", label: "Rejetées" }, { value: "CORRECTION_DEMANDEE", label: "Correction demandée" }]} /><Button variant="secondary" size="sm" icon={<Download className="size-4" />} onClick={lines}>Exporter le détail (CSV)</Button></div>
      <table className="w-full text-sm"><caption className="sr-only">Historique des feuilles</caption><thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="px-4 py-2 text-start font-medium">Collaborateur</th><th className="px-3 text-start font-medium">Semaine du</th><th className="px-3 text-end font-medium">Heures</th><th className="px-3 text-start font-medium">Statut</th><th className="px-3 text-start font-medium">Décision</th><th className="w-40" /></tr></thead>
        <tbody>{list.length === 0 && <tr><td colSpan={6}><EmptyState icon={Lock} title="Aucune feuille" /></td></tr>}{list.slice(0, 60).map((x) => (
          <tr key={x.id} className="border-t border-line"><td className="px-4 py-2"><PersonCell person={{ firstName: x.firstName, lastName: x.lastName, departmentId: x.departmentId }} /></td><td className="px-3 tabular-nums">{fmtDate(x.weekStart)}</td><td className="px-3 text-end tabular-nums">{fmtHours(x.total)}</td><td className="px-3"><StatusPill tone={TIMESHEET_STATUS[x.status].tone} label={TIMESHEET_STATUS[x.status].label} />{x.corrections > 0 && <span className="ms-2 text-2xs text-text-muted">{x.corrections} correction(s)</span>}</td><td className="px-3 text-xs text-text-secondary">{x.validatedAt ? `Validée le ${fmtDate(x.validatedAt)}${x.validatedBy ? ` par ${x.validatedBy}` : ""}` : x.comment ?? "—"}</td>
            <td className="px-3 text-end"><Button size="sm" variant="ghost" onClick={() => setOpen(x.id)}>Détail</Button>{x.status === "VALIDE" && canCorrect(s, x.employeeId) && <Button size="sm" variant="secondary" icon={<PencilLine className="size-4" />} onClick={() => { setCorr(x); setReason(""); }}>Corriger</Button>}</td></tr>))}</tbody></table>
      {open && <SheetDrawer id={open} onClose={() => setOpen(null)} />}
      <Modal open={!!corr} onClose={() => setCorr(null)} title="Correction tracée d’une feuille validée" subtitle={corr ? `${corr.employeeName} — semaine du ${fmtDate(corr.weekStart)}` : undefined} footer={<><Button variant="secondary" onClick={() => setCorr(null)}>Annuler</Button><Button disabled={reason.trim().length < 10} onClick={() => { const r = act((d) => openCorrection(d, corr!.id, reason)); toast({ title: r.ok ? "Correction ouverte — journalisée" : "Refusé", body: r.ok ? "La feuille repasse au collaborateur ; le motif est conservé." : r.error, tone: r.ok ? "success" : "warning" }); if (r.ok) setCorr(null); }}>Ouvrir la correction</Button></>}>
        <Callout tone="alert" className="mb-3">Une feuille validée est verrouillée. La rouvrir est une opération tracée : motif écrit, date et auteur sont conservés dans le journal d’audit.</Callout>
        <TextArea label="Motif de la correction" required rows={3} value={reason} onChange={setReason} hint="10 caractères minimum." />
      </Modal>
      <span hidden>{can("timesheet.view") ? "" : ""}</span>
    </Card>
  );
}
