"use client";
import { AlertTriangle, ArrowRight, Clock3, Download, FileText, Inbox, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { Bars, ChartCard, Donut, LineChart, StackedBars } from "@/components/charts/Charts";
import { Kpi } from "./Kpi";
import { PersonCell } from "@/components/shared/PersonCell";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, EmptyState, PageHeader, Skeleton } from "@/components/ui/Surface";
import { SelectInput } from "@/components/ui/FormInputs";
import { useFirstLoad } from "@/components/app/useSkeleton";
import { downloadFile, toCsv } from "@/lib/download";
import { useQueryState } from "@/lib/use-query-state";
import { fmtDate, fmtDateShort, fmtHours, fmtPct, relDays } from "@/lib/engine/format";
import { useSession } from "@/lib/store/hooks";
import { adminDashboard, executive, hrDashboard, myWeek, PERIOD_LABEL, resourceManager, teamDashboard, type DashFilters, type Period } from "@/lib/store/selectors/dashboard";
import { nameOf } from "@/lib/store/selectors/core";
import { PRIORITY, REQUEST_STATUS, TIMESHEET_STATUS } from "@/lib/ui-domain";
import type { AppState } from "@/lib/store/types";

const Grid = ({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 }) => <div className={`mt-4 grid gap-4 ${cols === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>{children}</div>;
const Row = ({ href, children, right }: { href: string; children: ReactNode; right?: ReactNode }) => (
  <Link href={href} className="flex items-center justify-between gap-3 border-b border-line px-1 py-2.5 text-sm last:border-b-0 hover:bg-canvas">
    <span className="min-w-0 flex-1">{children}</span>{right}<ArrowRight className="size-3.5 shrink-0 text-text-muted" />
  </Link>
);

/* ---------------- Executive ---------------- */
function Executive({ s, admin }: { s: AppState; admin?: boolean }) {
  const q = useQueryState();
  const f: DashFilters = { period: (q.get("periode") as Period) || "recent", dept: q.get("dept") || undefined, office: q.get("bureau") || undefined, grade: q.get("grade") || undefined, manager: q.get("manager") || undefined, type: q.get("type") || undefined };
  const d = useMemo(() => executive(s, f), [s, f.period, f.dept, f.office, f.grade, f.manager, f.type]); // eslint-disable-line react-hooks/exhaustive-deps
  const loading = useFirstLoad();
  const managers = s.employees.filter((e) => e.gradeId === "g-4" || e.gradeId === "g-5");
  const types = [...new Set(s.projects.map((p) => p.type))];
  const all = { value: "", label: "Tous" };
  const exportCsv = () => downloadFile("tableau-de-bord.csv", toCsv(["Indicateur", "Valeur", "Précision"], d.kpis.map((k) => [k.label, k.display, k.hint ?? ""])));
  return (
    <div className="print-area">
      <PageHeader title={admin ? "Vue d’ensemble de la plateforme" : "Tableau de bord exécutif"} description={`${d.headcount} collaborateurs dans le périmètre · ${PERIOD_LABEL[f.period]} (${fmtDateShort(d.from)} → ${fmtDate(d.to)})`}
        actions={<span className="no-print flex gap-2"><Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv}>Exporter (Excel)</Button><Button variant="secondary" icon={<FileText className="size-4" />} onClick={() => window.print()}>Exporter (PDF)</Button></span>} />
      <Card className="no-print mb-4 !p-3">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <SelectInput label="Période" value={f.period} onChange={(v) => q.set("periode", v)} options={(Object.keys(PERIOD_LABEL) as Period[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))} />
          <SelectInput label="Département" value={f.dept ?? ""} onChange={(v) => q.set("dept", v)} options={[all, ...s.departments.map((x) => ({ value: x.id, label: x.name }))]} />
          <SelectInput label="Bureau" value={f.office ?? ""} onChange={(v) => q.set("bureau", v)} options={[all, ...s.offices.map((x) => ({ value: x.id, label: x.city }))]} />
          <SelectInput label="Grade" value={f.grade ?? ""} onChange={(v) => q.set("grade", v)} options={[all, ...s.grades.map((x) => ({ value: x.id, label: x.name }))]} />
          <SelectInput label="Manager" value={f.manager ?? ""} onChange={(v) => q.set("manager", v)} options={[all, ...managers.map((x) => ({ value: x.id, label: `${x.firstName} ${x.lastName}` }))]} />
          <SelectInput label="Type de mission" value={f.type ?? ""} onChange={(v) => q.set("type", v)} options={[all, ...types.map((x) => ({ value: x, label: x }))]} />
        </div>
      </Card>
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{d.kpis.map((k) => <Kpi key={k.key} k={k} />)}</div>
          <p className="mt-2 text-2xs text-text-muted">Utilisation planifiée = heures affectées confirmées ÷ capacité théorique. Réelle = heures de timesheets validés ÷ capacité théorique. Les deux sont toujours distinguées.</p>
          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <ChartCard title="Tendance d’utilisation (8 semaines)" subtitle="Planifiée, réelle et facturable — séparées" source={`Basé sur ${d.headcount} collaborateurs · timesheets validés pour le réel`} table={{ head: ["Semaine du", "Planifiée %", "Réelle %", "Facturable %"], rows: d.trend.map((t) => [t.label, Math.round(t.planned), Math.round(t.real), Math.round(t.billable)]) }} summary="Courbes d’utilisation planifiée, réelle et facturable sur 8 semaines">
                <LineChart id={`trend-${f.dept}-${f.office}-${f.grade}`} labels={d.trend.map((t) => t.label)} unit="%" thresholds={[{ value: s.settings.thresholds.underUse, label: `Sous-occ. ${s.settings.thresholds.underUse} %` }, { value: s.settings.thresholds.overload, label: `Surcharge ${s.settings.thresholds.overload} %`, solid: true }]} series={[{ name: "Planifiée", values: d.trend.map((t) => Math.round(t.planned)) }, { name: "Réelle", values: d.trend.map((t) => Math.round(t.real)) }, { name: "Facturable", values: d.trend.map((t) => Math.round(t.billable)) }]} />
              </ChartCard>
            </div>
            <ChartCard title="Disponibilité (4 semaines)" subtitle="Répartition des collaborateurs" table={{ head: ["Niveau", "Collaborateurs"], rows: d.availSlices.map((x) => [x.label, x.value]) }} summary="Répartition par niveau de disponibilité">
              <Donut id="avail" slices={d.availSlices} center={{ value: String(d.headcount), label: "collaborateurs" }} />
            </ChartCard>
          </div>
          <Grid>
            <ChartCard title="Effectifs par grade" table={{ head: ["Grade", "Effectif"], rows: d.byGrade.map((x) => [x.label, x.value]) }}><Bars id="grade" labels={d.byGrade.map((x) => x.label)} series={[{ name: "Effectif", values: d.byGrade.map((x) => x.value) }]} h={170} /></ChartCard>
            <ChartCard title="Effectifs par département" table={{ head: ["Département", "Effectif"], rows: d.byDept.map((x) => [x.label, x.value]) }}><Bars id="dept" horizontal labels={d.byDept.map((x) => x.label)} series={[{ name: "Effectif", values: d.byDept.map((x) => x.value) }]} /></ChartCard>
            <ChartCard title="Charge par département" subtitle="Utilisation planifiée, 4 prochaines semaines" table={{ head: ["Département", "Planifiée %"], rows: d.workload.map((x) => [x.label, x.value]) }}><Bars id="workload" horizontal labels={d.workload.map((x) => x.label)} series={[{ name: "Planifiée", values: d.workload.map((x) => x.value) }]} max={120} formatValue={(v) => `${v} %`} /></ChartCard>
            <ChartCard title="Heures facturables / non facturables" subtitle="Timesheets validés, par semaine" table={{ head: ["Semaine du", "Facturables h", "Non facturables h"], rows: d.trend.map((t) => [t.label, Math.round(t.billableH), Math.round(t.worked - t.billableH)]) }}><StackedBars id="bill" labels={d.trend.map((t) => t.label)} stacks={[{ name: "Facturables", values: d.trend.map((t) => Math.round(t.billableH)) }, { name: "Non facturables", values: d.trend.map((t) => Math.round(t.worked - t.billableH)) }]} unit=" h" /></ChartCard>
            <ChartCard title="Missions par statut" table={{ head: ["Statut", "Missions"], rows: d.missionsByStatus.map((x) => [x.label, x.value]) }}><Bars id="mstatus" horizontal labels={d.missionsByStatus.map((x) => x.label)} series={[{ name: "Missions", values: d.missionsByStatus.map((x) => x.value) }]} /></ChartCard>
            <ChartCard title="Capacité à 3 mois" subtitle="Capacité disponible vs besoins pondérés (ETP)" source="Voir Capacité pour le détail et le « et si »" table={{ head: ["Grade", "Capacité ETP", "Besoins ETP", "Déficit (pers.)"], rows: d.forecast.map((x) => [x.label, x.supply, x.demand, x.deficit]) }}><Bars id="fc" labels={d.forecast.map((x) => x.label)} series={[{ name: "Capacité", values: d.forecast.map((x) => x.supply) }, { name: "Besoins", values: d.forecast.map((x) => x.demand) }]} /></ChartCard>
          </Grid>
          {d.forecast.some((x) => x.deficit > 0) && (
            <Card className="mt-4"><CardHeader title="Déficits de capacité à 3 mois" action={<Button href="/app/capacite" variant="secondary" size="sm">Ouvrir la capacité</Button>} /><div className="flex flex-wrap gap-2">{d.forecast.filter((x) => x.deficit > 0).map((x) => <StatusPill key={x.label} tone="conflict" label={`Déficit : ${x.deficit} ${x.label}${x.deficit > 1 ? "s" : ""}`} />)}</div></Card>
          )}
        </>
      )}
      {admin && <AdminExtra s={s} />}
    </div>
  );
}
function AdminExtra({ s }: { s: AppState }) {
  const a = adminDashboard(s);
  return (
    <Grid cols={2}>
      <Card><CardHeader title="Plateforme" description="Comptes, droits et traçabilité" />
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-text-muted">Utilisateurs actifs</dt><dd className="text-xl font-semibold tabular-nums">{a.activeUsers} / {a.users}</dd></div><div><dt className="text-text-muted">Permissions actives</dt><dd className="text-xl font-semibold tabular-nums">{a.perms}</dd></div><div><dt className="text-text-muted">Actions journalisées (7 j)</dt><dd className="text-xl font-semibold tabular-nums">{a.auditRecent}</dd></div><div><dt className="text-text-muted">E-mails simulés</dt><dd className="text-xl font-semibold tabular-nums">{a.emails}</dd></div></dl></Card>
      <Card><CardHeader title="Dernières actions" action={<Button href="/app/admin/audit" variant="secondary" size="sm">Journal complet</Button>} />
        <ul>{a.recent.map((r) => <li key={r.id}><Row href={`/app/admin/audit?q=${r.entityId}`}><span className="font-medium text-ink">{r.action}</span> <span className="text-text-secondary">— {r.label}</span></Row></li>)}</ul></Card>
    </Grid>
  );
}

/* ---------------- Resource Manager ---------------- */
function RM({ s }: { s: AppState }) {
  const d = resourceManager(s);
  return (
    <>
      <PageHeader title="Poste de pilotage du staffing" description={`${d.queue.length} demande(s) ouverte(s), ${d.conflicts.length} conflit(s) de planning, ${d.unstaffed.length} mission(s) sans équipe complète`} actions={<Button href="/app/planning">Ouvrir le planning</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi k={{ key: "rm-open", label: "Demandes ouvertes", value: d.queue.length, display: String(d.queue.length), href: "/app/demandes" }} />
        <Kpi k={{ key: "rm-urgent", label: "Urgentes", value: d.urgent.length, display: String(d.urgent.length), tone: d.urgent.length ? "conflict" : "ok", href: "/app/demandes?priorite=URGENTE" }} />
        <Kpi k={{ key: "rm-conf", label: "Conflits de planning", value: d.conflicts.length, display: String(d.conflicts.length), tone: d.conflicts.length ? "conflict" : "ok", href: "/app/planning" }} />
        <Kpi k={{ key: "rm-unst", label: "Missions à staffer", value: d.unstaffed.length, display: String(d.unstaffed.length), tone: d.unstaffed.length ? "alert" : "ok", href: "/app/missions?vue=attente" }} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card><CardHeader title="Missions sans équipe complète" description="Cliquez pour lancer le matching" />
          {d.unstaffed.length === 0 ? <EmptyState icon={ShieldCheck} title="Toutes les missions sont staffées" /> : <ul>{d.unstaffed.slice(0, 7).map((u) => <li key={u.project.id}><Row href={u.reqs[0] ? `/app/missions/${u.project.id}?tab=besoins&matching=${u.reqs[0].req.id}` : `/app/missions/${u.project.id}`} right={<StatusPill tone={u.project.status === "EN_ATTENTE_STAFFING" ? "alert" : "info"} label={`${u.cov.missing} poste${u.cov.missing > 1 ? "s" : ""} à pourvoir`} />}><span className="font-medium text-ink">{u.project.name}</span><span className="block text-xs text-text-muted">Démarre {relDays(u.project.startDate, s.now)} · taux de staffing {fmtPct(u.cov.rate * 100)}</span></Row></li>)}</ul>}
        </Card>
        <Card><CardHeader title="File des demandes" action={<Button href="/app/demandes" variant="secondary" size="sm">Ouvrir la file</Button>} />
          <div className="mb-3 flex flex-wrap gap-2">{d.byStatus.map((x) => <Badge key={x.status} tone={REQUEST_STATUS[x.status].tone}>{REQUEST_STATUS[x.status].label} · {x.count}</Badge>)}</div>
          <ul>{[...d.queue].sort((a, b) => (b.priority === "URGENTE" ? 1 : 0) - (a.priority === "URGENTE" ? 1 : 0)).slice(0, 5).map((r) => <li key={r.id}><Row href={`/app/demandes/${r.id}`} right={<StatusPill tone={PRIORITY[r.priority].tone} label={PRIORITY[r.priority].label} />}><span className="font-medium text-ink">{r.reference}</span> <span className="text-text-secondary">{s.projects.find((p) => p.id === r.projectId)?.name}</span></Row></li>)}</ul>
        </Card>
        <Card><CardHeader title="Conflits de planning" action={<Button href="/app/planning" variant="secondary" size="sm">Voir dans le planning</Button>} />
          {d.conflicts.length === 0 ? <EmptyState icon={ShieldCheck} title="Aucun conflit" /> : <ul>{d.conflicts.map((c, i) => <li key={i}><Row href={`/app/planning?employee=${c.employeeId}`} right={c.kind === "LEAVE_PENDING" ? <StatusPill tone="alert" label="Congé en attente" /> : <StatusPill tone={c.acknowledged ? "alert" : "conflict"} label={c.acknowledged ? "Exception accordée" : "Conflit"} />}><span className="font-medium text-ink">{nameOf(s, c.employeeId)}</span><span className="block text-xs text-text-secondary">{c.message}</span></Row></li>)}</ul>}
        </Card>
        <Card><CardHeader title="Surveillance" description="Réservations, congés, charge" />
          <ul>
            {d.expiring.map((a) => <li key={a.id}><Row href="/app/planning" right={<Badge tone="alert" icon>Expire {relDays(a.softExpiresAt!, s.now)}</Badge>}>Réservation de <span className="font-medium text-ink">{nameOf(s, a.employeeId)}</span></Row></li>)}
            {d.pendingLeaves.slice(0, 3).map((l) => <li key={l.id}><Row href="/app/disponibilites" right={<Badge tone="info" icon>Congé en attente</Badge>}>{nameOf(s, l.employeeId)} · {fmtDateShort(l.startDate)} → {fmtDateShort(l.endDate)}</Row></li>)}
            {d.over.map((x) => <li key={x.e.id}><Row href="/app/planning" right={<StatusPill tone="conflict" label={`Surchargé ${Math.round(x.planned)} %`} />}>{x.e.firstName} {x.e.lastName}</Row></li>)}
            {d.under.slice(0, 3).map((x) => <li key={x.e.id}><Row href="/app/collaborateurs?view=sous-occupes" right={<StatusPill tone="alert" label={`Sous-occupé ${Math.round(x.planned)} %`} />}>{x.e.firstName} {x.e.lastName}</Row></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}

/* ---------------- Manager / Partner ---------------- */
function Team({ s, partner }: { s: AppState; partner?: boolean }) {
  const d = teamDashboard(s);
  return (
    <>
      <PageHeader title={partner ? "Mon périmètre" : "Mon équipe"} description={`${d.rows.length} collaborateurs dans votre périmètre · charge des 4 prochaines semaines (réservations incluses)`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi k={{ key: "t-ts", label: "Timesheets à valider", value: d.waitingSheets, display: String(d.waitingSheets), href: "/app/timesheets?vue=validation", tone: d.waitingSheets ? "alert" : "ok" }} />
        <Kpi k={{ key: "t-lv", label: "Congés à approuver", value: d.pendingLeaves.length, display: String(d.pendingLeaves.length), href: "/app/disponibilites", tone: d.pendingLeaves.length ? "alert" : "ok" }} />
        <Kpi k={{ key: "t-pr", label: "Missions suivies", value: d.myProjects.length, display: String(d.myProjects.length), href: "/app/missions" }} />
        <Kpi k={{ key: "t-un", label: "Postes à pourvoir", value: d.myProjects.reduce((a, p) => a + p.cov.missing, 0), display: String(d.myProjects.reduce((a, p) => a + p.cov.missing, 0)), href: "/app/missions?vue=attente", tone: d.myProjects.some((p) => p.cov.missing) ? "alert" : "ok" }} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Card><CardHeader title="Charge de l’équipe" description="Par semaine, à partir de la semaine en cours" />
          <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Charge par semaine</caption><thead><tr className="text-xs text-text-muted"><th className="py-1 text-start font-medium">Collaborateur</th>{d.weeks.map((w) => <th key={w} className="px-2 py-1 text-end font-medium">{fmtDateShort(w)}</th>)}</tr></thead>
            <tbody>{d.rows.map((r) => <tr key={r.e.id} className="border-t border-line"><td className="py-1.5"><PersonCell person={r.e} href={`/app/collaborateurs/${r.e.id}`} /></td>{r.weeks.map((v, i) => <td key={i} className="px-1 py-1.5 text-end"><span className={`inline-flex min-w-[3.4em] items-center justify-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${v > s.settings.thresholds.overload ? "bg-conflict text-white" : v >= 85 ? "bg-av-full text-white" : v >= 50 ? "bg-av-part text-av-part-text" : "bg-av-free text-av-free-text"}`}>{v > s.settings.thresholds.overload && <AlertTriangle className="size-3" aria-hidden />}{v}%</span></td>)}</tr>)}</tbody></table></div>
          <p className="mt-2 text-2xs text-text-muted">Disponible &lt; 50 % · Partiel 50–84 % · Plein 85–100 % · Surchargé &gt; 100 % (icône ▲).</p>
        </Card>
        <Card><CardHeader title="Staffing de mes missions" />
          {d.myProjects.length === 0 ? <EmptyState icon={Inbox} title="Aucune mission suivie" /> : <ul>{d.myProjects.map((p) => <li key={p.project.id}><Row href={`/app/missions/${p.project.id}`} right={<Badge tone={p.cov.missing ? "alert" : "ok"} icon>{fmtPct(p.cov.rate * 100)}</Badge>}><span className="font-medium text-ink">{p.project.name}</span><span className="block text-xs text-text-muted">{p.cov.hard}/{p.cov.quantity} postes confirmés{p.cov.soft ? ` · ${p.cov.soft} réservé(s)` : ""}</span></Row></li>)}</ul>}
        </Card>
      </div>
    </>
  );
}

/* ---------------- RH ---------------- */
function RH({ s }: { s: AppState }) {
  const d = hrDashboard(s);
  return (
    <>
      <PageHeader title="Tableau de bord RH" description="Congés, effectifs, certifications et fins de contrat" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi k={{ key: "h-act", label: "Effectif actif", value: d.active, display: String(d.active), href: "/app/collaborateurs" }} />
        <Kpi k={{ key: "h-lv", label: "Congés en attente", value: d.pendingLeaves.length, display: String(d.pendingLeaves.length), href: "/app/disponibilites", tone: d.pendingLeaves.length ? "alert" : "ok" }} />
        <Kpi k={{ key: "h-cert", label: "Certifications < 30 j", value: d.certs.length, display: String(d.certs.length), tone: d.certs.length ? "alert" : "ok", href: "/app/collaborateurs" }} />
        <Kpi k={{ key: "h-arch", label: "Archivés", value: d.archived, display: String(d.archived), href: "/app/collaborateurs?view=archives" }} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card><CardHeader title="Certifications expirant sous 30 jours" />
          {d.certs.length === 0 ? <EmptyState icon={ShieldCheck} title="Aucune certification n’expire bientôt" /> : <ul>{d.certs.map((c) => <li key={c.employeeId + c.certificationId}><Row href={`/app/collaborateurs/${c.employeeId}?tab=certifications`} right={<StatusPill tone="alert" label={`Expire ${relDays(c.expiresAt, s.now)}`} />}><span className="font-medium text-ink">{nameOf(s, c.employeeId)}</span><span className="block text-xs text-text-muted">{s.certifications.find((x) => x.id === c.certificationId)?.name}</span></Row></li>)}</ul>}</Card>
        <Card><CardHeader title="Congés à examiner" action={<Button href="/app/disponibilites" variant="secondary" size="sm">Ouvrir</Button>} />
          <ul>{d.pendingLeaves.slice(0, 6).map((l) => <li key={l.id}><Row href="/app/disponibilites"><span className="font-medium text-ink">{nameOf(s, l.employeeId)}</span><span className="block text-xs text-text-muted">{fmtDateShort(l.startDate)} → {fmtDate(l.endDate)}</span></Row></li>)}</ul></Card>
        <ChartCard title="Effectifs par contrat" table={{ head: ["Contrat", "Effectif"], rows: d.byContract.map((x) => [x.label, x.value]) }}><Donut id="contract" slices={d.byContract.filter((x) => x.value)} /></ChartCard>
      </div>
      {d.ending.length > 0 && <Card className="mt-4"><CardHeader title="Fins de contrat à venir" /><ul>{d.ending.map((e) => <li key={e.id}><Row href={`/app/collaborateurs/${e.id}`} right={<Badge tone="info" icon>{fmtDate(e.endDate!)}</Badge>}>{e.firstName} {e.lastName} · {e.contract}</Row></li>)}</ul></Card>}
    </>
  );
}

/* ---------------- Collaborateur ---------------- */
function Me({ s }: { s: AppState }) {
  const d = myWeek(s);
  return (
    <>
      <PageHeader title={`Bonjour ${d.emp?.firstName ?? ""}`} description={`Votre semaine du ${fmtDate(d.week.from)} au ${fmtDate(d.week.to)}`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi k={{ key: "m-asg", label: "Mes affectations", value: d.assignments.length, display: String(d.assignments.length), href: "/app/planning" }} />
        <Kpi k={{ key: "m-ts", label: "Timesheets à compléter", value: d.todo.length, display: String(d.todo.length), tone: d.todo.length ? "alert" : "ok", href: "/app/timesheets" }} />
        <Kpi k={{ key: "m-lv", label: "Demandes de congé ouvertes", value: d.leaves.length, display: String(d.leaves.length), href: "/app/disponibilites" }} />
        <Kpi k={{ key: "m-op", label: "Opportunités ouvertes", value: d.opportunities.length, display: String(d.opportunities.length), href: "/app/marketplace" }} />
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Card><CardHeader title="Mes affectations de la semaine" />
          {d.assignments.length === 0 ? <EmptyState icon={Clock3} title="Aucune affectation cette semaine" description="Consultez la marketplace pour de nouvelles opportunités." action={<Button href="/app/marketplace" variant="secondary">Voir la marketplace</Button>} /> : <ul>{d.assignments.map((a) => <li key={a.id}><Row href={`/app/missions/${a.projectId}`} right={<Badge tone={a.status === "HARD" ? "ok" : "info"} icon>{a.status === "HARD" ? "Confirmée" : "Réservation"}</Badge>}><span className="font-medium text-ink">{s.projects.find((p) => p.id === a.projectId)?.name}</span><span className="block text-xs text-text-muted">{a.allocationPct} % · jusqu’au {fmtDate(a.endDate)}</span></Row></li>)}</ul>}
        </Card>
        <Card><CardHeader title="Mes timesheets" action={<Button href="/app/timesheets" size="sm">Saisir mes heures</Button>} />
          <ul>{d.timesheets.map((t) => <li key={t.id}><Row href={`/app/timesheets?week=${t.weekStart}`} right={<StatusPill tone={TIMESHEET_STATUS[t.status].tone} label={TIMESHEET_STATUS[t.status].label} />}>Semaine du {fmtDate(t.weekStart)}</Row></li>)}</ul>
          {d.util && <p className="mt-3 text-xs text-text-secondary">Ce mois : utilisation planifiée {fmtPct(d.util.planned)}{d.util.worked ? ` · réelle ${fmtPct(d.util.real)} (${fmtHours(d.util.worked)} validées)` : ""}.</p>}
        </Card>
        {d.certs.length > 0 && <Card><CardHeader title="Mes certifications" /><ul>{d.certs.map((c) => <li key={c.certificationId}><Row href={`/app/collaborateurs/${c.employeeId}?tab=certifications`} right={<StatusPill tone="alert" label={`Expire ${relDays(c.expiresAt, s.now)}`} />}>{s.certifications.find((x) => x.id === c.certificationId)?.name}</Row></li>)}</ul></Card>}
      </div>
    </>
  );
}

export function Dashboard() {
  const { s, me } = useSession();
  if (!me) return null;
  switch (me.role) {
    case "SUPER_ADMIN": case "ADMIN": return <Executive s={s} admin />;
    case "DIRECTION": return <Executive s={s} />;
    case "RESOURCE_MANAGER": return <RM s={s} />;
    case "PARTNER": return <Team s={s} partner />;
    case "MANAGER": return <Team s={s} />;
    case "RH": return <RH s={s} />;
    default: return <Me s={s} />;
  }
}
