"use client";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileText, Flame, GripVertical, OctagonX, Plus } from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { createAssignment, updateAssignment, type AssignmentPatch } from "@/lib/store/actions/assignments";
import { conflictIds, groupSummary, heatCells, lanesFor, planningRows, ticks, VIEW_LABEL, ZOOM, defaultStart, shiftStart, type Lens, type PlanRow, type View, type HeatState } from "@/lib/store/selectors/planning";
import { addDays, diffDays, dow } from "@/lib/engine/dates";
import { fmtDateShort, fmtHours, fmtRange } from "@/lib/engine/format";
import { plannedHoursFor } from "@/lib/engine/capacity";
import { downloadFile, toCsv } from "@/lib/download";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { Combobox, DateRangeInput, NumberInput } from "@/components/ui/Controls";
import { SearchInput, SegmentedControl, SelectInput, Switch } from "@/components/ui/FormInputs";
import { Callout, EmptyState, PageHeader, Skeleton } from "@/components/ui/Surface";
import { Modal } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { useFirstLoad } from "@/components/app/useSkeleton";
import { ExceptionModal, type Failure } from "@/components/missions/ExceptionModal";
import { deptColor } from "@/lib/ui-domain";
import type { Assignment } from "@/lib/store/types";

const LEFT = 15, LANE = 2.375, BLOCK = 2, ROW_MIN = 3;
type DragMode = "move" | "start" | "end";
interface Drag { id: string; mode: DragMode; days: number; empId?: string }
type Pending = { id: string; patch: AssignmentPatch; prev: AssignmentPatch; result: Failure } | { create: { employeeId: string; projectId: string; requirementId?: string; startDate: string; endDate: string; allocationPct: number; status: "SOFT" | "HARD" }; result: Failure };

const HEAT: Record<Exclude<HeatState, "absent">, { label: string; cls: string; icon: string }> = {
  free: { label: "Dispo", cls: "bg-av-free text-av-free-text", icon: "○" },
  part: { label: "Partiel", cls: "bg-av-part text-av-part-text", icon: "◐" },
  full: { label: "Plein", cls: "bg-av-full text-white", icon: "●" },
  over: { label: "Surchargé", cls: "bg-conflict text-white bg-[image:var(--hatch-conflict)]", icon: "▲" },
};

export function PlanningGrid() {
  const { s, can, me } = useSession();
  const q = useQueryState();
  const toast = useToast();
  const loading = useFirstLoad(400);
  const lens = (q.get("lens") || "personnes") as Lens;
  const view = (q.get("view") || "semaine") as View;
  const mode = q.get("mode") === "chaleur" ? "chaleur" : "blocs";
  const includeSoft = q.get("soft") !== "0";
  const start = q.get("date") || defaultStart(s, view);
  const filters = { dept: q.get("dept") || undefined, grade: q.get("grade") || undefined, office: q.get("bureau") || undefined, mission: q.get("mission") || undefined, q: q.get("q") || undefined, employee: q.get("employee") || undefined };
  const z = ZOOM[view];
  const tk = useMemo(() => ticks(start, view), [start, view]);
  const rows = useMemo(() => planningRows(s, lens, filters), [s, lens, filters.dept, filters.grade, filters.office, filters.mission, filters.q, filters.employee]); // eslint-disable-line react-hooks/exhaustive-deps
  const conflicts = useMemo(() => conflictIds(s), [s]);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [pop, setPop] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ employeeId: string; date: string } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [heatOnly, setHeatOnly] = useState<HeatState | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowRects = useRef<{ key: string; empId: string; top: number; bottom: number }[]>([]);
  const canEdit = can("planning.edit");
  const width = z.days * z.ppd;
  const office = s.offices[0];
  const holidays = useMemo(() => new Map(s.holidays.map((h) => [h.date, h.name])), [s.holidays]);
  const emPx = () => parseFloat(getComputedStyle(bodyRef.current ?? document.body).fontSize) || 16;
  const asgById = useMemo(() => new Map(s.assignments.map((a) => [a.id, a])), [s.assignments]);
  const todayX = diffDays(start, s.now) * z.ppd;

  const setQ = (patch: Record<string, string | null>) => q.setMany({ date: null, ...patch });
  const page = (dir: -1 | 1) => q.set("date", shiftStart(start, view, dir));

  const commit = useCallback((id: string, patch: AssignmentPatch, reason?: string, silent = false) => {
    const a = asgById.get(id);
    if (!a) return;
    const prev: AssignmentPatch = { employeeId: a.employeeId, startDate: a.startDate, endDate: a.endDate, allocationPct: a.allocationPct };
    const r = act((d) => updateAssignment(d, id, patch, reason));
    if (r.ok) {
      if (!silent) toast({ title: "Affectation déplacée", body: "Le moteur a validé le nouveau créneau.", undo: () => act((d) => updateAssignment(d, id, prev, reason ? "Annulation du déplacement (retour à l’état précédent)" : undefined)) });
      setLive("Affectation mise à jour.");
      return;
    }
    setShake(id);
    setTimeout(() => setShake(null), 1300);
    setLive(`Refusé : ${r.error}`);
    if (r.code === "NEEDS_EXCEPTION") setPending({ id, patch, prev, result: r });
    else toast({ title: "Modification refusée", body: r.error, tone: "warning" });
  }, [asgById, toast]);

  /* ---- pointer drag (move / resize) ---- */
  const begin = (e: React.PointerEvent, a: Assignment, m: DragMode) => {
    if (!canEdit || !can("assignment.edit", { projectId: a.projectId }) && !can("planning.edit", { projectId: a.projectId })) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const x0 = e.clientX, y0 = e.clientY;
    const px = emPx();
    rowRects.current = [...(bodyRef.current?.querySelectorAll<HTMLElement>("[data-emp]") ?? [])].map((el) => { const r = el.getBoundingClientRect(); return { key: el.dataset.rowkey!, empId: el.dataset.emp!, top: r.top, bottom: r.bottom }; });
    let moved = false;
    let last = "";
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      const days = Math.round(dx / (z.ppd * px) / z.snap) * z.snap;
      const row = m === "move" && lens !== "missions" ? rowRects.current.find((r) => ev.clientY >= r.top && ev.clientY <= r.bottom) : undefined;
      const next: Drag = { id: a.id, mode: m, days, empId: row && row.empId !== a.employeeId ? row.empId : undefined };
      const sig = `${next.days}|${next.empId}`;
      if (sig !== last) { last = sig; setDrag(next); } // React state only when the target cell changes
    };
    const up = (ev: PointerEvent) => {
      (e.target as HTMLElement).releasePointerCapture?.(ev.pointerId);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (!moved) { setSel(a.id); setPop(a.id); return; }
      const days = Math.round((ev.clientX - x0) / (z.ppd * px) / z.snap) * z.snap;
      const row = m === "move" && lens !== "missions" ? rowRects.current.find((r) => ev.clientY >= r.top && ev.clientY <= r.bottom) : undefined;
      if (m === "move") commit(a.id, { startDate: addDays(a.startDate, days), endDate: addDays(a.endDate, days), employeeId: row && row.empId !== a.employeeId ? row.empId : undefined });
      else if (m === "start") commit(a.id, { startDate: addDays(a.startDate, Math.min(days, diffDays(a.startDate, a.endDate))) });
      else commit(a.id, { endDate: addDays(a.endDate, Math.max(days, -diffDays(a.startDate, a.endDate))) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /* ---- keyboard move / resize mode (WCAG 2.5.7 alternative) ---- */
  const [kb, setKb] = useState<{ id: string; mode: DragMode; days: number } | null>(null);
  useEffect(() => {
    if (!kb) return;
    const a = asgById.get(kb.id);
    const onKey = (e: KeyboardEvent) => {
      const unit = z.snap * (e.shiftKey ? 5 : 1);
      if (e.key === "Escape") { setKb(null); setDrag(null); setLive("Déplacement annulé."); return; }
      if (e.key === "Enter" && a) {
        e.preventDefault();
        const days = kb.days;
        setKb(null); setDrag(null);
        if (!days) return setLive("Aucun changement.");
        if (kb.mode === "move") commit(a.id, { startDate: addDays(a.startDate, days), endDate: addDays(a.endDate, days) });
        else commit(a.id, { endDate: addDays(a.endDate, Math.max(days, -diffDays(a.startDate, a.endDate))) });
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const days = kb.days + (e.key === "ArrowRight" ? unit : -unit);
        setKb({ ...kb, days });
        setDrag({ id: kb.id, mode: kb.mode, days });
        if (a) setLive(`${kb.mode === "move" ? "Début" : "Fin"} : ${fmtDateShort(addDays(kb.mode === "move" ? a.startDate : a.endDate, days))}. Entrée pour valider, Échap pour annuler.`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kb, asgById, commit, z.snap]);

  const exportCsv = () => {
    const list = rows.flatMap((r) => r.lanes.map((l) => l.a));
    downloadFile("planning.csv", toCsv(["Collaborateur", "Mission", "Statut", "Allocation %", "Début", "Fin", "Heures"], list.map((a) => [s.employees.find((e) => e.id === a.employeeId) ? `${s.employees.find((e) => e.id === a.employeeId)!.firstName} ${s.employees.find((e) => e.id === a.employeeId)!.lastName}` : "", s.projects.find((p) => p.id === a.projectId)?.name, a.status === "HARD" ? "Confirmée" : "Réservation", a.allocationPct, a.startDate, a.endDate, a.plannedHours])));
  };
  const visibleRows = rows.filter((r) => !(r.deptId && collapsed.includes(r.deptId) && r.kind === "person" && lens === "departements"));
  const popA = pop ? asgById.get(pop) : undefined;
  const conflictCount = [...conflicts].length;

  const rowH = (r: PlanRow) => (r.kind === "group" ? 2.25 : Math.max(ROW_MIN, r.laneCount * LANE + 0.75));

  return (
    <div className="print-area">
      <PageHeader title="Staffing et planning" description="Qui travaille sur quoi, et quand — les déplacements sont validés par le moteur (conflits, congés, contrats, temps partiel)." actions={<span className="no-print flex gap-2"><Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv}>CSV</Button><Button variant="secondary" icon={<FileText className="size-4" />} onClick={() => window.print()}>PDF (impression)</Button></span>} />
      <div className="no-print mb-3 flex flex-col gap-3 rounded-lg border border-border bg-bg p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SegmentedControl size="sm" label="Regroupement" value={lens} onChange={(v) => setQ({ lens: v })} options={[{ value: "personnes", label: "Par collaborateur" }, { value: "missions", label: "Par mission" }, { value: "departements", label: "Par département" }]} />
          <SegmentedControl size="sm" label="Zoom" value={view} onChange={(v) => setQ({ view: v })} options={(Object.keys(VIEW_LABEL) as View[]).map((v) => ({ value: v, label: VIEW_LABEL[v] }))} />
          <SegmentedControl size="sm" label="Mode d’affichage" value={mode} onChange={(v) => q.set("mode", v === "chaleur" ? "chaleur" : null)} options={[{ value: "blocs", label: "Affectations" }, { value: "chaleur", label: "Carte de charge" }]} />
          <label className="flex items-center gap-2 text-sm"><Switch size="sm" checked={includeSoft} onChange={(v) => q.set("soft", v ? null : "0")} label="Inclure les réservations" />Inclure les réservations</label>
          <span className="ms-auto flex items-center gap-1">
            <IconButton label="Période précédente" onClick={() => page(-1)}><ChevronLeft className="size-4" /></IconButton>
            <Button size="sm" variant="secondary" onClick={() => q.set("date", null)}>Aujourd’hui</Button>
            <IconButton label="Période suivante" onClick={() => page(1)}><ChevronRight className="size-4" /></IconButton>
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <SearchInput value={q.get("q")} onChange={(v) => setQ({ q: v || null })} placeholder="Rechercher une personne…" />
          <SelectInput label="" value={filters.dept ?? ""} onChange={(v) => setQ({ dept: v || null })} options={[{ value: "", label: "Tous les départements" }, ...s.departments.map((d) => ({ value: d.id, label: d.name }))]} />
          <SelectInput label="" value={filters.grade ?? ""} onChange={(v) => setQ({ grade: v || null })} options={[{ value: "", label: "Tous les grades" }, ...s.grades.map((d) => ({ value: d.id, label: d.name }))]} />
          <SelectInput label="" value={filters.office ?? ""} onChange={(v) => setQ({ bureau: v || null })} options={[{ value: "", label: "Tous les bureaux" }, ...s.offices.map((d) => ({ value: d.id, label: d.city }))]} />
          <SelectInput label="" value={filters.mission ?? ""} onChange={(v) => setQ({ mission: v || null })} options={[{ value: "", label: "Toutes les missions" }, ...s.projects.filter((p) => p.status !== "TERMINEE" && p.status !== "ANNULEE").map((d) => ({ value: d.id, label: d.name }))]} />
          <div className="flex items-center gap-2">{conflictCount ? <StatusPill tone="conflict" label={`${conflictCount} bloc(s) en conflit`} /> : <StatusPill tone="ok" label="Aucun conflit" />}</div>
        </div>
        {mode === "chaleur" && (
          <div className="flex flex-wrap items-center gap-2 text-xs" role="group" aria-label="Légende de la carte de charge">
            {(Object.keys(HEAT) as (keyof typeof HEAT)[]).map((k) => (
              <button key={k} type="button" aria-pressed={heatOnly === k} onClick={() => setHeatOnly(heatOnly === k ? null : k)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium", HEAT[k].cls, heatOnly === k ? "ring-2 ring-focus" : "border-transparent")}>{HEAT[k].icon} {HEAT[k].label} {k === "free" ? "< 50 %" : k === "part" ? "50–84 %" : k === "full" ? "85–100 %" : `> ${s.settings.thresholds.overload} %`}</button>
            ))}
            <span className="text-text-muted">Cliquer pour isoler un niveau · valeurs = charge moyenne (maximale en vue Jour)</span>
          </div>
        )}
      </div>

      {loading ? <Skeleton className="h-96 w-full" /> : rows.length === 0 ? <EmptyState icon={AlertTriangle} title="Aucune ligne à afficher" description="Aucun collaborateur ou mission ne correspond aux filtres de votre périmètre." action={<Button variant="secondary" onClick={() => q.setMany({ q: null, dept: null, grade: null, bureau: null, mission: null, employee: null })}>Effacer les filtres</Button>} /> : (
        <div className="plan-print scroll-thin overflow-auto rounded-lg border border-border bg-bg" style={{ maxHeight: "calc(100svh - 18em)" }}>
          <div role="grid" aria-label="Planning des affectations" aria-rowcount={visibleRows.length} style={{ width: `${LEFT + width}em` }} ref={bodyRef} className="relative">
            {/* header */}
            <div className="sticky top-0 z-20 flex border-b border-border bg-paper/95 backdrop-blur-sm" style={{ height: "4em" }}>
              <div className="sticky start-0 z-30 flex items-end border-e border-border bg-paper px-3 pb-1.5 text-xs font-medium text-text-secondary" style={{ width: `${LEFT}em` }}>{lens === "missions" ? "Mission" : "Collaborateur"}</div>
              <div className="relative" style={{ width: `${width}em` }}>
                {tk.top.map((t, i) => <div key={i} className="absolute top-0 truncate border-s border-border px-1.5 pt-1 text-xs font-semibold capitalize text-ink" style={{ left: `${t.x}em`, width: `${t.w}em`, height: "2em" }}>{t.label}</div>)}
                {tk.bottom.map((t) => <div key={t.date} className={cn("absolute bottom-0 border-s px-1 pb-1 text-2xs tabular-nums text-text-secondary", t.major ? "border-border" : "border-line")} style={{ left: `${t.x}em`, height: "2em", paddingTop: "0.4em" }}>{t.label}</div>)}
                {todayX >= 0 && todayX <= width && <span className="absolute bottom-0 -translate-x-1/2 rounded-t bg-info px-1.5 text-2xs font-medium text-white" style={{ left: `${todayX}em` }}>Auj. {fmtDateShort(s.now)}</span>}
              </div>
            </div>
            {/* background layer: non-working days, holidays, today */}
            <div aria-hidden className="pointer-events-none absolute z-0" style={{ left: `${LEFT}em`, top: "4em", bottom: 0, width: `${width}em` }}>
              {(view === "jour" || view === "semaine") && Array.from({ length: z.days }, (_, i) => {
                const d = addDays(start, i);
                const off = !(office?.workingWeekdays ?? [0, 1, 2, 3, 4]).includes(dow(d));
                const hol = holidays.get(d);
                if (!off && !hol) return null;
                return <div key={d} title={hol} className="absolute inset-y-0 bg-[#efece4] bg-[image:var(--hatch-absent)]" style={{ left: `${i * z.ppd}em`, width: `${z.ppd}em` }} />;
              })}
              {tk.bottom.map((t) => <div key={t.date} className="absolute inset-y-0 border-s border-line" style={{ left: `${t.x}em` }} />)}
              {todayX >= 0 && todayX <= width && <div className="absolute inset-y-0 w-0.5 bg-info" style={{ left: `${todayX}em` }} />}
            </div>
            {visibleRows.map((r, idx) => (
              <Row key={r.key} r={r} idx={idx} rowH={rowH(r)} start={start} view={view} mode={mode} includeSoft={includeSoft} heatOnly={heatOnly} drag={drag} sel={sel} shake={shake} conflicts={conflicts} canEdit={canEdit} collapsed={collapsed} toggleGroup={(id) => setCollapsed((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))}
                begin={begin} onKbStart={(a, m) => { setKb({ id: a.id, mode: m, days: 0 }); setLive(`Mode ${m === "move" ? "déplacement" : "redimensionnement"} : flèches gauche/droite, Entrée pour valider, Échap pour annuler.`); }} onOpen={(id) => { setSel(id); setPop(id); }} onEmpty={(empId, date) => canEdit && setCreating({ employeeId: empId, date })} />
            ))}
          </div>
        </div>
      )}
      <p className="no-print mt-2 text-2xs text-text-muted">Bloc plein = affectation confirmée · hachuré en tirets = réservation (soft) · cadre rouge + icône ▲ = conflit · {canEdit ? "glisser pour déplacer, poignées pour redimensionner ; sans glisser : clic sur un bloc (dates, %, personne) ou touche M puis ← →." : "lecture seule pour votre profil."}</p>
      <div className="sr-only" aria-live="polite">{live}</div>

      {popA && <AssignmentPopover key={popA.id} a={popA} canEdit={canEdit} onClose={() => setPop(null)} onSave={(patch) => { setPop(null); commit(popA.id, patch, undefined, true); }} />}
      {creating && <NewBooking key={creating.employeeId + creating.date} init={creating} onClose={() => setCreating(null)} onCreate={(input) => {
        const r = act((d) => createAssignment(d, input));
        if (r.ok) { toast({ title: input.status === "HARD" ? "Affectation créée" : "Réservation créée" }); setCreating(null); }
        else if (r.code === "NEEDS_EXCEPTION") { setCreating(null); setPending({ create: input, result: r }); }
        else toast({ title: "Refusé", body: r.error, tone: "warning" });
      }} />}
      <ExceptionModal open={!!pending} result={pending?.result ?? null} onCancel={() => setPending(null)} onConfirm={(reason) => {
        const p = pending!; setPending(null);
        if ("create" in p) { const r = act((d) => createAssignment(d, { ...p.create, exceptionReason: reason })); toast({ title: r.ok ? "Exception enregistrée" : "Refusé", body: r.ok ? "Visible dans le journal d’audit." : r.error, tone: r.ok ? "success" : "warning" }); }
        else { const r = act((d) => updateAssignment(d, p.id, p.patch, reason)); toast({ title: r.ok ? "Exception enregistrée" : "Refusé", body: r.ok ? "Visible dans le journal d’audit." : r.error, tone: r.ok ? "success" : "warning", undo: r.ok ? () => act((d) => updateAssignment(d, p.id, p.prev, "Annulation de l’exception (retour à l’état précédent)")) : undefined }); }
      }} />
      <span hidden>{me?.id}</span>
    </div>
  );
}

/* ---------------- one row ---------------- */
const Row = memo(function Row({ r, idx, rowH, start, view, mode, includeSoft, heatOnly, drag, sel, shake, conflicts, canEdit, collapsed, toggleGroup, begin, onKbStart, onOpen, onEmpty }: {
  r: PlanRow; idx: number; rowH: number; start: string; view: View; mode: "blocs" | "chaleur"; includeSoft: boolean; heatOnly: HeatState | null; drag: Drag | null; sel: string | null; shake: string | null; conflicts: Set<string>; canEdit: boolean; collapsed: string[];
  toggleGroup: (id: string) => void; begin: (e: React.PointerEvent, a: Assignment, m: DragMode) => void; onKbStart: (a: Assignment, m: DragMode) => void; onOpen: (id: string) => void; onEmpty: (empId: string, date: string) => void;
}) {
  const { s } = useSession();
  const z = ZOOM[view];
  const width = z.days * z.ppd;
  const dept = r.deptId ? deptColor(r.deptId) : "var(--color-s7)";
  if (r.kind === "group") {
    const sm = groupSummary(s, r.groupId!, start, addDays(start, z.days - 1), includeSoft);
    const off = collapsed.includes(r.groupId!);
    return (
      <div role="row" aria-rowindex={idx + 2} className="relative z-10 flex border-b border-border bg-paper/70" style={{ height: "2.25em" }}>
        <button type="button" onClick={() => toggleGroup(r.groupId!)} aria-expanded={!off} className="sticky start-0 z-10 flex items-center gap-2 border-e border-border bg-paper px-3 text-start text-sm font-semibold text-ink" style={{ width: `${LEFT}em` }}>
          <ChevronRight className={cn("size-3.5 transition-transform", !off && "rotate-90")} aria-hidden /><span className="size-2 rounded-full" style={{ background: dept }} aria-hidden />{r.label}
        </button>
        <div className="flex items-center gap-3 px-3 text-xs text-text-secondary"><span>{r.sub}</span><span className="tabular-nums">charge moyenne {Math.round(sm.avg)} %</span>{sm.over > 0 && <Badge tone="conflict" icon>{sm.over} surchargé(s)</Badge>}</div>
      </div>
    );
  }
  const emp = r.employee;
  const heat = mode === "chaleur" && emp ? heatCells(s, emp, start, view, includeSoft) : null;
  return (
    <div role="row" aria-rowindex={idx + 2} data-rowkey={r.key} data-emp={emp?.id} className="relative z-10 flex border-b border-line" style={{ height: `${rowH}em` }}>
      <div role="rowheader" className="sticky start-0 z-10 flex items-center gap-2 border-e border-border bg-bg px-3" style={{ width: `${LEFT}em` }}>
        {emp ? <><Avatar person={emp} size="sm" /><Link href={`/app/collaborateurs/${emp.id}`} className="min-w-0 leading-tight hover:underline"><span className="block truncate text-sm font-medium text-ink">{r.label}</span><span className="block truncate text-2xs text-text-muted">{r.sub}</span></Link></> :
          r.kind === "placeholder" ? <Link href={`/app/missions/${r.projectId}?tab=besoins&matching=${r.requirement!.id}`} className="min-w-0 leading-tight"><span className="flex items-center gap-1 text-xs font-medium text-alert"><AlertTriangle className="size-3.5 shrink-0" aria-hidden /><span className="truncate">{r.label}</span></span><span className="block truncate text-2xs text-text-muted">{r.sub}</span></Link> :
          <Link href={`/app/missions/${r.projectId}`} className="min-w-0 leading-tight hover:underline"><span className="flex items-center gap-1.5"><span className="size-2 shrink-0 rounded-full" style={{ background: dept }} aria-hidden /><span className="block truncate text-sm font-medium text-ink">{r.label}</span></span><span className="block truncate text-2xs text-text-muted">{r.sub}</span></Link>}
      </div>
      <div className="relative overflow-hidden" style={{ width: `${width}em` }} onClick={(e) => { if (e.target !== e.currentTarget || !emp || mode === "chaleur") return; const rect = e.currentTarget.getBoundingClientRect(); const px = parseFloat(getComputedStyle(e.currentTarget).fontSize) || 16; onEmpty(emp.id, addDays(start, Math.floor((e.clientX - rect.left) / (z.ppd * px)))); }}>
        {r.kind === "placeholder" && (() => { const rq = r.requirement!; const x = Math.max(0, diffDays(start, rq.startDate)) * z.ppd; const w = (diffDays(rq.startDate < start ? start : rq.startDate, rq.endDate) + 1) * z.ppd; return <Link href={`/app/missions/${r.projectId}?tab=besoins&matching=${rq.id}`} className="absolute top-2 flex items-center gap-1 rounded-md border border-dashed border-alert bg-alert-bg px-2 text-xs font-medium text-alert" style={{ left: `${x}em`, width: `${Math.max(w, 6)}em`, height: `${BLOCK}em` }}><AlertTriangle className="size-3.5" aria-hidden />Trouver des candidats</Link>; })()}
        {heat ? heat.map((c) => {
          const h = HEAT[c.state as keyof typeof HEAT];
          return <div key={c.from} title={`${emp?.firstName} ${emp?.lastName} · ${fmtRange(c.from, c.to)} · ${Math.round(c.pct)} %`} className={cn("absolute top-1 flex flex-col items-center justify-center overflow-hidden rounded-sm border border-white text-2xs font-medium tabular-nums", h.cls, heatOnly && heatOnly !== c.state && "opacity-25")} style={{ left: `${c.x}em`, width: `${c.w}em`, height: `${rowH - 0.5}em` }}>{c.w >= 2.2 ? <><span aria-hidden>{h.icon}</span>{Math.round(c.pct)}</> : <span aria-hidden>{h.icon}</span>}<span className="sr-only">{h.label}</span></div>;
        }) : (
          <>
            {r.leaves.map((l) => { const x = diffDays(start, l.startDate) * z.ppd; const w = (diffDays(l.startDate, l.endDate) + 1) * z.ppd; if (x + w < 0 || x > width) return null; return <div key={l.id} title={`Absence approuvée : ${fmtRange(l.startDate, l.endDate)}`} className="absolute inset-y-1 rounded-sm border border-neutral/40 bg-paper bg-[image:var(--hatch-absent)]" style={{ left: `${Math.max(0, x)}em`, width: `${w}em` }} />; })}
            {r.lanes.map(({ a, lane }) => {
              const dragging = drag?.id === a.id;
              const moved = dragging ? { start: drag!.mode === "end" ? a.startDate : addDays(a.startDate, drag!.days), end: drag!.mode === "start" ? a.endDate : addDays(a.endDate, drag!.mode === "move" ? drag!.days : drag!.days) } : null;
              return <BlockView key={a.id} a={a} r={r} lane={lane} start={start} z={z} selected={sel === a.id} ghost={dragging} conflict={conflicts.has(a.id)} shake={shake === a.id} canEdit={canEdit} begin={begin} onKbStart={onKbStart} onOpen={onOpen} preview={moved && !drag!.empId ? moved : null} />;
            })}
            {drag && drag.empId === emp?.id && (() => { const a = s.assignments.find((x) => x.id === drag.id)!; const st = addDays(a.startDate, drag.days), en = addDays(a.endDate, drag.days); const x = diffDays(start, st) * z.ppd; return <PreviewBar x={x} w={(diffDays(st, en) + 1) * z.ppd} label={`${fmtRange(st, en)} · ${diffDays(st, en) + 1} j · ${fmtHours(plannedHoursFor(s, emp!, st, en, a.allocationPct))}`} />; })()}
          </>
        )}
      </div>
    </div>
  );
});

function PreviewBar({ x, w, label }: { x: number; w: number; label: string }) {
  return <div className="pointer-events-none absolute top-2 z-20 flex items-center rounded-md border-2 border-focus bg-select/80 px-2 text-xs font-medium text-ink shadow-md transition-[left] duration-75" style={{ left: `${x}em`, width: `${Math.max(w, 2)}em`, height: `${BLOCK}em` }}><span className="whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-2xs text-white -translate-y-[1.6em] absolute start-0">{label}</span></div>;
}

const BlockView = memo(function BlockView({ a, r, lane, start, z, selected, ghost, conflict, shake, canEdit, begin, onKbStart, onOpen, preview }: { a: Assignment; r: PlanRow; lane: number; start: string; z: (typeof ZOOM)[View]; selected: boolean; ghost: boolean; conflict: boolean; shake: boolean; canEdit: boolean; begin: (e: React.PointerEvent, a: Assignment, m: DragMode) => void; onKbStart: (a: Assignment, m: DragMode) => void; onOpen: (id: string) => void; preview: { start: string; end: string } | null }) {
  const { s } = useSession();
  const p = s.projects.find((x) => x.id === a.projectId);
  const emp = s.employees.find((e) => e.id === a.employeeId);
  const st = preview?.start ?? a.startDate, en = preview?.end ?? a.endDate;
  const x0 = diffDays(start, st) * z.ppd;
  const x1 = x0 + (diffDays(st, en) + 1) * z.ppd;
  const x = Math.max(x0, 0);
  const w = Math.max(Math.min(x1, z.days * z.ppd) - x, 1.5);
  const cutL = x0 < 0, cutR = x1 > z.days * z.ppd;
  const soft = a.status === "SOFT";
  const color = deptColor(p?.departmentId ?? "");
  const label = r.kind === "mission" ? `${emp?.firstName} ${emp?.lastName}` : p?.name;
  const ack = !!a.exceptionReason;
  const aria = `${label}, ${a.allocationPct} pour cent, du ${fmtRange(a.startDate, a.endDate)}, ${soft ? "réservation" : "confirmée"}${conflict ? ", conflit" : ""}`;
  return (
    <div
      role="gridcell"
      className={cn("group/b absolute z-10", ghost && "opacity-40", shake && "plan-shake")}
      style={{ left: `${x}em`, width: `${w}em`, top: `${0.375 + lane * LANE}em`, height: `${BLOCK}em` }}
    >
      <button
        type="button"
        aria-label={aria}
        title={`${p?.name} — ${emp?.firstName} ${emp?.lastName}\n${a.allocationPct} % · ${fmtRange(a.startDate, a.endDate)} · ${fmtHours(a.plannedHours)}${soft ? "\nRéservation (soft)" : ""}${a.exceptionReason ? `\nException : ${a.exceptionReason}` : ""}`}
        onPointerDown={(e) => begin(e, a, "move")}
        onClick={() => { if (!canEdit) onOpen(a.id); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onOpen(a.id); } if (canEdit && (e.key === "m" || e.key === "M")) onKbStart(a, "move"); if (canEdit && (e.key === "r" || e.key === "R")) onKbStart(a, "end"); }}
        className={cn("flex size-full touch-none items-center gap-1 overflow-hidden border px-1.5 text-start text-xs text-ink", cutL ? "rounded-s-none" : "rounded-s-md", cutR ? "rounded-e-none" : "rounded-e-md", canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", soft ? "border-dashed bg-[image:var(--hatch-soft)]" : "", conflict ? "border-2 border-conflict" : ack ? "border-2 border-dashed border-conflict" : "", selected && "ring-2 ring-focus")}
        style={{ background: soft ? `color-mix(in srgb, ${color} 10%, white)` : `color-mix(in srgb, ${color} 16%, white)`, borderColor: conflict || ack ? undefined : color, backgroundImage: soft ? "var(--hatch-soft)" : undefined }}
      >
        <span aria-hidden className="h-full w-1 shrink-0 rounded-sm" style={{ background: color }} />
        {(conflict || ack) && <OctagonX className="size-3.5 shrink-0 text-conflict" aria-hidden />}
        {w >= 3 && <span className="shrink-0 font-semibold tabular-nums">{a.allocationPct}%</span>}
        {w >= 6 && <span className="min-w-0 flex-1 truncate font-medium">{label}{soft ? " · réserv." : ""}</span>}
        {w >= 10 && <span className="shrink-0 tabular-nums text-text-secondary">{Math.round(a.plannedHours)} h</span>}
        {canEdit && w >= 8 && <GripVertical className="size-3 shrink-0 text-text-muted opacity-0 group-hover/b:opacity-100" aria-hidden />}
      </button>
      {canEdit && (
        <>
          <span onPointerDown={(e) => begin(e, a, "start")} className="absolute inset-y-0 start-0 z-10 w-2 cursor-ew-resize touch-none rounded-s-md opacity-0 transition-opacity group-hover/b:opacity-100 focus-visible:opacity-100" style={{ background: "linear-gradient(to right, var(--color-ink), transparent)" }} aria-hidden />
          <span onPointerDown={(e) => begin(e, a, "end")} className="absolute inset-y-0 end-0 z-10 w-2 cursor-ew-resize touch-none rounded-e-md opacity-0 transition-opacity group-hover/b:opacity-100" style={{ background: "linear-gradient(to left, var(--color-ink), transparent)" }} aria-hidden />
        </>
      )}
    </div>
  );
});

/* ---------------- non-drag alternative: popover with steppers (WCAG 2.5.7) ---------------- */
function AssignmentPopover({ a, canEdit, onClose, onSave }: { a: Assignment; canEdit: boolean; onClose: () => void; onSave: (p: AssignmentPatch) => void }) {
  const { s } = useSession();
  const [v, setV] = useState({ start: a.startDate, end: a.endDate, pct: a.allocationPct, emp: a.employeeId });
  const p = s.projects.find((x) => x.id === a.projectId);
  const shift = (d: number) => setV((x) => ({ ...x, start: addDays(x.start, d), end: addDays(x.end, d) }));
  const emp = s.employees.find((e) => e.id === v.emp);
  const hours = emp ? plannedHoursFor(s, emp, v.start, v.end, v.pct) : 0;
  return (
    <Modal open onClose={onClose} title={p?.name ?? "Affectation"} subtitle={`${a.status === "HARD" ? "Affectation confirmée" : "Réservation"} · ${fmtRange(a.startDate, a.endDate)}`} footer={<><Button variant="secondary" onClick={onClose}>Fermer</Button>{canEdit && <Button onClick={() => onSave({ startDate: v.start, endDate: v.end, allocationPct: v.pct, employeeId: v.emp })}>Appliquer</Button>}</>}>
      <div className="flex flex-col gap-4">
        {a.exceptionReason && <Callout tone="alert" title="Exception accordée">{a.exceptionReason}</Callout>}
        {canEdit ? (
          <>
            <Combobox label="Collaborateur" value={v.emp} onChange={(x) => setV({ ...v, emp: x })} options={s.employees.filter((e) => e.status !== "ARCHIVE").map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}`, hint: s.grades.find((g) => g.id === e.gradeId)?.name }))} />
            <DateRangeInput start={v.start} end={v.end} onChange={(st, en) => setV({ ...v, start: st, end: en })} />
            <div>
              <p className="mb-1.5 text-sm font-medium text-text">Décaler la période</p>
              <div className="flex flex-wrap gap-2">{[[-7, "−1 sem."], [-1, "−1 j"], [1, "+1 j"], [7, "+1 sem."]].map(([d, l]) => <Button key={String(l)} size="sm" variant="secondary" onClick={() => shift(d as number)}>{l}</Button>)}</div>
            </div>
            <NumberInput label="Allocation" suffix="%" min={5} max={100} step={5} value={v.pct} onChange={(n) => setV({ ...v, pct: n })} hint={`≈ ${fmtHours(hours)} sur la période — le moteur contrôlera les conflits à l’application.`} />
          </>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm"><dt className="text-text-muted">Collaborateur</dt><dd>{emp?.firstName} {emp?.lastName}</dd><dt className="text-text-muted">Allocation</dt><dd>{a.allocationPct} %</dd><dt className="text-text-muted">Heures</dt><dd>{fmtHours(a.plannedHours)}</dd></dl>
        )}
        <Link href={`/app/missions/${a.projectId}?tab=equipe`} className="text-sm font-medium text-primary hover:underline">Ouvrir la mission</Link>
      </div>
    </Modal>
  );
}

function NewBooking({ init, onClose, onCreate }: { init: { employeeId: string; date: string }; onClose: () => void; onCreate: (i: { employeeId: string; projectId: string; requirementId?: string; startDate: string; endDate: string; allocationPct: number; status: "SOFT" | "HARD" }) => void }) {
  const { s, can } = useSession();
  const emp = s.employees.find((e) => e.id === init.employeeId)!;
  const [v, setV] = useState({ projectId: "", requirementId: "", start: init.date, end: addDays(init.date, 13), pct: 50, status: "SOFT" as "SOFT" | "HARD" });
  const projects = s.projects.filter((p) => p.status !== "TERMINEE" && p.status !== "ANNULEE" && can("planning.edit", { projectId: p.id }));
  const reqs = s.requirements.filter((r) => r.projectId === v.projectId);
  return (
    <Modal open onClose={onClose} title="Nouvelle réservation ou affectation" subtitle={`${emp.firstName} ${emp.lastName} — clic dans le planning (alternative au glisser-déposer)`} footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button disabled={!v.projectId} icon={<Plus className="size-4" />} onClick={() => onCreate({ employeeId: emp.id, projectId: v.projectId, requirementId: v.requirementId || undefined, startDate: v.start, endDate: v.end, allocationPct: v.pct, status: v.status })}>Créer</Button></>}>
      <div className="flex flex-col gap-4">
        <Combobox label="Mission" required value={v.projectId} onChange={(x) => setV({ ...v, projectId: x, requirementId: "" })} options={projects.map((p) => ({ value: p.id, label: p.name, hint: p.reference }))} />
        {reqs.length > 0 && <Combobox label="Besoin couvert (optionnel)" value={v.requirementId} onChange={(x) => { const r = reqs.find((q) => q.id === x); setV({ ...v, requirementId: x, ...(r ? { start: r.startDate > v.start ? r.startDate : v.start, end: r.endDate, pct: r.allocationPct } : {}) }); }} options={reqs.map((r) => ({ value: r.id, label: `${r.quantity} × ${s.grades.find((g) => g.id === r.gradeMin)?.name} · ${r.allocationPct} %` }))} />}
        <DateRangeInput start={v.start} end={v.end} onChange={(st, en) => setV({ ...v, start: st, end: en })} />
        <NumberInput label="Allocation" suffix="%" min={5} max={100} step={5} value={v.pct} onChange={(n) => setV({ ...v, pct: n })} />
        <SegmentedControl label="Type" value={v.status} onChange={(x) => setV({ ...v, status: x })} options={[{ value: "SOFT", label: "Réservation (soft)" }, ...(can("assignment.create") ? [{ value: "HARD" as const, label: "Affectation confirmée" }] : [])]} />
      </div>
    </Modal>
  );
}
void Flame; void lanesFor;
