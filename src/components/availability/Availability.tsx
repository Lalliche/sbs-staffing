"use client";
import { CalendarPlus, Check, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { decideLeave, submitDraftLeave, submitLeave, withdrawLeave } from "@/lib/store/actions/leaves";
import { visibleLeaves, nameOf, visibleEmployees } from "@/lib/store/selectors/core";
import { absenceDaySet, availableHours, isWorkingDay, calendarOf } from "@/lib/engine/capacity";
import { ANNUAL_LEAVE_ALLOWANCE, annualLeaveTaken, impactedAssignments, leaveWorkingDays } from "@/lib/engine/leave";
import { addDays, addMonths, eachDay, monthEnd, monthStart } from "@/lib/engine/dates";
import { fmtDate, fmtDateShort, fmtHours, fmtMonth, fmtRange } from "@/lib/engine/format";
import { PersonCell } from "@/components/shared/PersonCell";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button, IconButton } from "@/components/ui/Button";
import { DateRangeInput } from "@/components/ui/Controls";
import { SelectInput, TextArea } from "@/components/ui/FormInputs";
import { Callout, Card, CardHeader, EmptyState, PageHeader, Skeleton } from "@/components/ui/Surface";
import { Modal } from "@/components/ui/Overlay";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { useFirstLoad } from "@/components/app/useSkeleton";
import { LEAVE_STATUS, LEAVE_TYPE } from "@/lib/ui-domain";
import type { LeaveType } from "@/lib/store/types";

type Tab = "mes" | "approbation" | "calendrier" | "feries";

export function Availability() {
  const { s, me, emp, can } = useSession();
  const q = useQueryState();
  const toast = useToast();
  const loading = useFirstLoad();
  const [month, setMonth] = useState(monthStart(s.now));
  const [reject, setReject] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const wantNew = q.get("nouveau") === "1" && can("leave.request");
  const [type, setType] = useState<LeaveType>("CONGE_ANNUEL");
  const [range, setRange] = useState({ start: addDays(s.now, 14), end: addDays(s.now, 18) });
  const [comment, setComment] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const leaves = visibleLeaves(s);
  const mine = leaves.filter((l) => l.employeeId === emp?.id);
  const queue = leaves.filter((l) => l.status === "SOUMISE" && can("leave.approve", { employeeId: l.employeeId }));
  const tabs: { value: Tab; label: string; count?: number }[] = [
    ...(can("leave.request") ? [{ value: "mes" as Tab, label: "Mes demandes", count: mine.length }] : []),
    ...(can("leave.approve") ? [{ value: "approbation" as Tab, label: "À approuver", count: queue.length }] : []),
    { value: "calendrier", label: "Calendrier global" },
    { value: "feries", label: "Jours fériés" },
  ];
  const tab = (q.get("vue") as Tab) || (queue.length ? "approbation" : !emp ? tabs.find((t) => t.value !== "mes")?.value : tabs[0].value) || "calendrier";
  const days = leaveWorkingDays(s, { employeeId: emp?.id ?? "", startDate: range.start, endDate: range.end });
  const taken = emp ? annualLeaveTaken(s, emp.id, Number(s.now.slice(0, 4))) : 0;

  const send = (asDraft: boolean) => {
    const r = act((d) => submitLeave(d, { type, startDate: range.start, endDate: range.end, comment, asDraft }));
    if (!r.ok) return setErr(r.error);
    setErr(null);
    q.set("nouveau", null);
    toast({ title: asDraft ? "Brouillon enregistré" : "Demande envoyée", body: asDraft ? undefined : "Votre manager est notifié." });
  };
  const decide = (id: string, d: "APPROUVEE" | "REFUSEE", why?: string) => {
    const r = act((x) => decideLeave(x, id, d, why));
    if (r.ok) toast({ title: d === "APPROUVEE" ? "Congé approuvé" : "Congé refusé", body: d === "APPROUVEE" ? "Les disponibilités sont recalculées : la personne n’apparaît plus comme disponible sur la période." : undefined, tone: "success" });
    else toast({ title: "Refusé", body: r.error, tone: "warning" });
    return r.ok;
  };

  const monthDays = eachDay(month, monthEnd(month));
  const people = visibleEmployees(s);
  const holidays = new Map(s.holidays.map((h) => [h.date, h.name]));

  return (
    <>
      <PageHeader title="Disponibilités et congés" description="Congés, absences, jours fériés et disponibilités : toute approbation recalcule immédiatement le staffing." actions={can("leave.request") && <Button icon={<CalendarPlus className="size-4" />} onClick={() => q.set("nouveau", "1")}>Nouvelle demande</Button>} />
      <Tabs label="Vues" value={tab} onChange={(v) => q.set("vue", v)} items={tabs} className="mb-5" />
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <>
          {tab === "mes" && (
            <div className="grid gap-4 xl:grid-cols-[1fr_20em]">
              <Card className="!p-0 overflow-hidden"><table className="w-full text-sm"><caption className="sr-only">Mes demandes de congé</caption><thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="px-4 py-2 text-start font-medium">Type</th><th className="px-3 text-start font-medium">Période</th><th className="px-3 text-end font-medium">Jours</th><th className="px-3 text-start font-medium">Statut</th><th className="w-24" /></tr></thead>
                <tbody>{mine.length === 0 && <tr><td colSpan={5}><EmptyState icon={CalendarPlus} title="Aucune demande" description="Posez un congé : votre manager est notifié." action={<Button onClick={() => q.set("nouveau", "1")}>Nouvelle demande</Button>} /></td></tr>}
                  {[...mine].sort((a, b) => b.startDate.localeCompare(a.startDate)).map((l) => (
                    <tr key={l.id} className="border-t border-line"><td className="px-4 py-2 font-medium text-ink">{LEAVE_TYPE[l.type]}</td><td className="px-3">{fmtRange(l.startDate, l.endDate)}</td><td className="px-3 text-end tabular-nums">{leaveWorkingDays(s, l)}</td>
                      <td className="px-3"><StatusPill tone={LEAVE_STATUS[l.status].tone} label={LEAVE_STATUS[l.status].label} />{l.comment && l.status !== "BROUILLON" && <span className="block text-2xs text-text-muted">{l.comment}</span>}</td>
                      <td className="px-3 text-end">{l.status === "BROUILLON" && <Button size="sm" variant="secondary" onClick={() => { const r = act((d) => submitDraftLeave(d, l.id)); toast({ title: r.ok ? "Demande envoyée" : "Refusé", body: r.ok ? undefined : r.error }); }}>Soumettre</Button>}{(l.status === "BROUILLON" || l.status === "SOUMISE") && <Button size="sm" variant="ghost" onClick={() => { act((d) => withdrawLeave(d, l.id)); toast({ title: "Demande retirée" }); }}>Retirer</Button>}</td></tr>))}</tbody></table></Card>
              <Card><CardHeader title="Solde de congé annuel" description={`Année ${s.now.slice(0, 4)}`} /><p className="text-kpi font-semibold tabular-nums text-ink">{ANNUAL_LEAVE_ALLOWANCE - taken}<span className="text-md font-normal text-text-secondary"> j restants</span></p><p className="mt-1 text-xs text-text-secondary">{taken} jour(s) ouvrés approuvés sur {ANNUAL_LEAVE_ALLOWANCE}. Les week-ends et jours fériés ne sont jamais décomptés, et un même jour n’est jamais compté deux fois.</p></Card>
            </div>
          )}

          {tab === "approbation" && (
            queue.length === 0 ? <EmptyState icon={Check} title="Aucune demande à approuver" description="Les nouvelles demandes de votre périmètre apparaîtront ici." /> : (
              <ul className="flex flex-col gap-3">
                {queue.map((l) => {
                  const impacted = impactedAssignments(s, l);
                  const e = s.employees.find((x) => x.id === l.employeeId)!;
                  const free = availableHours(s, e, s.now, addDays(s.now, 55));
                  return (
                    <li key={l.id}><Card>
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-[16em] flex-1">
                          <PersonCell person={e} sub={`${LEAVE_TYPE[l.type]} · ${fmtRange(l.startDate, l.endDate)} · ${leaveWorkingDays(s, l)} j ouvrés`} size="md" />
                          {l.comment && <p className="mt-2 text-sm text-text-secondary">« {l.comment} »</p>}
                          <div className="mt-3">
                            {impacted.length ? <Callout tone="alert" title="Impact sur le staffing">{impacted.map((a) => `${s.projects.find((p) => p.id === a.projectId)?.name} (${a.allocationPct} %)`).join(" ; ")} — le moteur signalera un conflit si la période est longue.</Callout> : <Callout tone="success" title="Aucune affectation impactée" />}
                            <p className="mt-2 text-xs text-text-secondary">Disponibilité des 8 prochaines semaines avant approbation : {fmtHours(free)} libres. Après approbation, ces heures disparaissent des candidats pour les périodes concernées.</p>
                          </div>
                        </div>
                        <span className="flex gap-2"><Button variant="secondary" icon={<X className="size-4" />} onClick={() => { setReject(l.id); setReason(""); }}>Refuser</Button><Button icon={<Check className="size-4" />} onClick={() => decide(l.id, "APPROUVEE")}>Approuver</Button></span>
                      </div>
                    </Card></li>
                  );
                })}
              </ul>
            )
          )}

          {tab === "calendrier" && (
            <Card className="!p-0">
              <div className="flex items-center justify-between border-b border-border p-3"><div className="flex items-center gap-2"><IconButton label="Mois précédent" onClick={() => setMonth(addMonths(month, -1))}>‹</IconButton><h2 className="w-40 text-center text-md font-semibold capitalize text-ink">{fmtMonth(month)}</h2><IconButton label="Mois suivant" onClick={() => setMonth(addMonths(month, 1))}>›</IconButton></div>
                <div className="flex flex-wrap gap-3 text-xs text-text-secondary"><Legend cls="bg-primary/80" label="Congé approuvé" /><Legend cls="border border-dashed border-alert bg-alert-bg" label="En attente" /><Legend cls="bg-[#efece4] bg-[image:var(--hatch-absent)]" label="Férié / week-end" /></div></div>
              <div className="scroll-thin max-h-[34em] overflow-auto"><table className="border-collapse text-2xs"><caption className="sr-only">Calendrier de disponibilité</caption>
                <thead className="sticky top-0 z-10 bg-paper"><tr><th className="sticky start-0 z-10 w-[14em] bg-paper px-3 py-1.5 text-start text-xs font-medium">Collaborateur</th>{monthDays.map((d) => <th key={d} title={holidays.get(d)} className="w-[1.9em] min-w-[1.9em] px-0 py-1 text-center font-normal tabular-nums text-text-secondary">{d.slice(8)}</th>)}</tr></thead>
                <tbody>{people.map((e) => {
                  const approved = absenceDaySet(s, e.id, month, monthEnd(month), ["APPROUVEE"]);
                  const pending = absenceDaySet(s, e.id, month, monthEnd(month), ["SOUMISE"]);
                  const raw = s.employees.find((x) => x.id === e.id)!;
                  const cal = calendarOf(s, raw);
                  return <tr key={e.id} className="border-t border-line"><th scope="row" className="sticky start-0 z-10 bg-bg px-3 py-1 text-start font-normal"><PersonCell person={e} size="xs" /></th>{monthDays.map((d) => {
                    const work = isWorkingDay(raw, cal, d);
                    const off = !work;
                    return <td key={d} title={approved.has(d) ? "Congé approuvé" : pending.has(d) ? "Demande en attente" : holidays.get(d) ?? ""} className={cn("h-6 border-s border-line p-0", off && "bg-[#efece4] bg-[image:var(--hatch-absent)]", work && approved.has(d) && "bg-primary/80", work && !approved.has(d) && pending.has(d) && "border border-dashed border-alert bg-alert-bg")} />;
                  })}</tr>;
                })}</tbody></table></div>
            </Card>
          )}

          {tab === "feries" && (
            <Card className="!p-0 overflow-hidden"><table className="w-full text-sm"><caption className="sr-only">Jours fériés</caption><thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="px-4 py-2 text-start font-medium">Date</th><th className="px-3 text-start font-medium">Jour férié</th><th className="px-3 text-start font-medium">Bureau</th></tr></thead><tbody>{s.holidays.map((h) => <tr key={h.id} className="border-t border-line"><td className="px-4 py-2 tabular-nums">{fmtDate(h.date)}</td><td className="px-3">{h.name}</td><td className="px-3 text-text-secondary">{h.officeId ? s.offices.find((o) => o.id === h.officeId)?.city : "Tous les bureaux"}</td></tr>)}</tbody></table>
              <p className="border-t border-border bg-paper/40 px-4 py-2 text-xs text-text-muted">Dates indicatives de démonstration — le calendrier réel de SBS se configure dans Administration › Référentiels.</p></Card>
          )}
        </>
      )}

      <Modal open={wantNew} onClose={() => q.set("nouveau", null)} title="Nouvelle demande de congé" subtitle="Votre manager sera notifié" footer={<><Button variant="secondary" onClick={() => send(true)}>Enregistrer en brouillon</Button><Button disabled={days === 0} onClick={() => send(false)}>Envoyer la demande</Button></>}>
        <div className="flex flex-col gap-4">
          {err && <Callout tone="danger">{err}</Callout>}
          <SelectInput label="Type" value={type} onChange={(v) => setType(v as LeaveType)} options={(Object.keys(LEAVE_TYPE) as LeaveType[]).map((t) => ({ value: t, label: LEAVE_TYPE[t] }))} />
          <DateRangeInput start={range.start} end={range.end} onChange={(st, en) => setRange({ start: st, end: en })} />
          <p className="text-sm text-text-secondary"><Badge tone="info" icon>{days} jour(s) ouvré(s)</Badge> <span className="ms-2">week-ends et jours fériés exclus.</span></p>
          <TextArea label="Commentaire (optionnel)" rows={2} value={comment} onChange={setComment} />
        </div>
      </Modal>
      <Modal open={!!reject} onClose={() => setReject(null)} title="Refuser la demande" subtitle={reject ? nameOf(s, s.leaves.find((l) => l.id === reject)?.employeeId) : undefined} footer={<><Button variant="secondary" onClick={() => setReject(null)}>Annuler</Button><Button variant="danger" disabled={!reason.trim()} onClick={() => { if (decide(reject!, "REFUSEE", reason)) setReject(null); }}>Refuser</Button></>}>
        <TextArea label="Motif du refus (obligatoire)" required rows={3} value={reason} onChange={setReason} />
      </Modal>
      <span hidden>{me?.id}{fmtDateShort(s.now)}</span>
    </>
  );
}
const Legend = ({ cls, label }: { cls: string; label: string }) => <span className="inline-flex items-center gap-1.5"><span className={cn("size-3.5 rounded-sm", cls)} aria-hidden />{label}</span>;
