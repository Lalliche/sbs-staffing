"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, SavedViews, type Column } from "@/components/ui/DataTable";
import { FilterBar } from "@/components/ui/FilterBar";
import { SearchInput } from "@/components/ui/FormInputs";
import { EmptyState, PageHeader, ProgressBar, Skeleton } from "@/components/ui/Surface";
import { useFirstLoad } from "@/components/app/useSkeleton";
import { MissionWizard } from "./MissionWizard";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { inMissionView, missionRows, MISSION_VIEWS, type MissionRow, type MissionView } from "@/lib/store/selectors/missions";
import { fmtDZD, fmtDateShort, fmtPct } from "@/lib/engine/format";
import { CERTAINTY, PRIORITY, PROJECT_STATUS } from "@/lib/ui-domain";
import { ClipboardList } from "lucide-react";

export function MissionList() {
  const { s, can, me } = useSession();
  const q = useQueryState();
  const router = useRouter();
  const loading = useFirstLoad();
  const wizard = q.get("nouveau") === "1" && can("project.create");
  const setWizard = (o: boolean) => q.set("nouveau", o ? "1" : null);
  const view = (q.get("vue") || "toutes") as MissionView;
  const text = q.get("q").toLowerCase();
  const rows = useMemo(() => missionRows(s), [s]);
  const filtered = rows.filter((r) => inMissionView(s, r, view, me?.employeeId) && (!q.get("statut") || r.p.status === q.get("statut")) && (!q.get("dept") || r.p.departmentId === q.get("dept")) && (!q.get("client") || r.p.clientId === q.get("client")) && (!q.get("certitude") || r.p.certainty === q.get("certitude")) && (!text || `${r.p.name} ${r.p.reference} ${r.p.otp} ${r.client}`.toLowerCase().includes(text)));
  const showBudget = rows.some((r) => typeof r.p.budget === "number");
  const cols: Column<MissionRow>[] = [
    { key: "ref", header: "Référence", cell: (r) => <span className="font-mono text-xs">{r.p.reference}</span>, sort: (a, b) => a.p.reference.localeCompare(b.p.reference), csv: (r) => r.p.reference },
    { key: "name", header: "Mission", required: true, cell: (r) => <span><span className="font-medium text-ink">{r.p.name}</span><span className="block text-xs text-text-muted">OTP {r.p.otp}</span></span>, sort: (a, b) => a.p.name.localeCompare(b.p.name), csv: (r) => r.p.name },
    { key: "client", header: "Client", cell: (r) => r.client, sort: (a, b) => a.client.localeCompare(b.client), csv: (r) => r.client, hideBelow: "lg" },
    { key: "dept", header: "Département", cell: (r) => r.department, hideBelow: "lg", csv: (r) => r.department },
    { key: "lead", header: "Responsable", cell: (r) => r.lead, hideBelow: "md", csv: (r) => r.lead },
    { key: "dates", header: "Période", cell: (r) => `${fmtDateShort(r.p.startDate)} → ${fmtDateShort(r.p.endDate)}`, sort: (a, b) => a.p.startDate.localeCompare(b.p.startDate), csv: (r) => `${r.p.startDate} → ${r.p.endDate}`, hideBelow: "md" },
    ...(showBudget ? [{ key: "budget", header: "Budget (DZD)", align: "end" as const, defaultHidden: true, cell: (r: MissionRow) => (typeof r.p.budget === "number" ? fmtDZD(r.p.budget) : "—"), sort: (a: MissionRow, b: MissionRow) => (a.p.budget ?? 0) - (b.p.budget ?? 0), csv: (r: MissionRow) => r.p.budget }] : []),
    { key: "need", header: "Besoin / affecté", align: "end", cell: (r) => <span className="tabular-nums">{r.cov.quantity} / {r.cov.hard}{r.cov.soft ? <span className="text-text-muted"> (+{r.cov.soft})</span> : null}</span>, csv: (r) => `${r.cov.quantity}/${r.cov.hard}` },
    { key: "rate", header: "Taux de staffing", cell: (r) => <span className="flex items-center gap-2"><ProgressBar className="w-16" value={r.cov.rate} tone={r.cov.rate >= 1 ? "ok" : r.cov.rate > 0 ? "alert" : "conflict"} label={`Taux de staffing ${fmtPct(r.cov.rate * 100)}`} /><span className="w-10 text-end text-xs tabular-nums">{fmtPct(r.cov.rate * 100)}</span></span>, sort: (a, b) => a.cov.rate - b.cov.rate, csv: (r) => Math.round(r.cov.rate * 100) },
    { key: "cert", header: "Certitude", cell: (r) => <Badge tone={CERTAINTY[r.p.certainty].tone}>{CERTAINTY[r.p.certainty].label}</Badge>, defaultHidden: true, csv: (r) => CERTAINTY[r.p.certainty].label },
    { key: "prio", header: "Priorité", cell: (r) => <Badge tone={PRIORITY[r.p.priority].tone}>{PRIORITY[r.p.priority].label}</Badge>, defaultHidden: true, csv: (r) => PRIORITY[r.p.priority].label },
    { key: "status", header: "Statut", cell: (r) => <StatusPill tone={PROJECT_STATUS[r.p.status].tone} label={PROJECT_STATUS[r.p.status].label} />, sort: (a, b) => a.p.status.localeCompare(b.p.status), csv: (r) => PROJECT_STATUS[r.p.status].label },
  ];
  const counts = Object.fromEntries(MISSION_VIEWS.map((v) => [v.value, rows.filter((r) => inMissionView(s, r, v.value, me?.employeeId)).length])) as Record<MissionView, number>;
  const values = { statut: q.get("statut"), dept: q.get("dept"), client: q.get("client"), certitude: q.get("certitude") };
  return (
    <>
      <PageHeader title="Missions et projets" description="Missions, besoins en ressources et taux de staffing — chaque mission est identifiée par sa référence et son numéro OTP." actions={can("project.create") && <Button icon={<Plus className="size-4" />} onClick={() => setWizard(true)}>Nouvelle mission</Button>} />
      <SavedViews value={view} onChange={(v) => q.set("vue", v === "toutes" ? null : v)} views={MISSION_VIEWS.map((v) => ({ ...v, count: counts[v.value] }))} />
      {loading ? <Skeleton className="h-72 w-full" /> : (
        <DataTable
          rows={filtered} columns={cols} getId={(r) => r.p.id} caption="Liste des missions" exportName="missions" onRowClick={(r) => router.push(`/app/missions/${r.p.id}`)}
          toolbar={<><SearchInput className="w-[18em]" value={q.get("q")} onChange={(v) => q.set("q", v || null)} placeholder="Rechercher une mission, un client, un OTP…" /><FilterBar values={values} onChange={(k, v) => q.set(k, v)} onClear={() => q.setMany({ statut: null, dept: null, client: null, certitude: null })} defs={[{ key: "statut", label: "Statut", options: Object.entries(PROJECT_STATUS).map(([value, x]) => ({ value, label: x.label })) }, { key: "dept", label: "Département", options: s.departments.map((d) => ({ value: d.id, label: d.name })) }, { key: "client", label: "Client", options: s.clients.map((c) => ({ value: c.id, label: c.name })) }, { key: "certitude", label: "Certitude", options: Object.entries(CERTAINTY).map(([value, x]) => ({ value, label: x.label })) }]} /></>}
          empty={<EmptyState icon={ClipboardList} title="Aucune mission" description="Aucune mission ne correspond à ces filtres." action={<Button variant="secondary" onClick={() => q.setMany({ q: null, statut: null, dept: null, client: null, certitude: null, vue: null })}>Effacer les filtres</Button>} />}
        />
      )}
      <MissionWizard open={wizard} onClose={() => setWizard(false)} onCreated={(id) => router.push(`/app/missions/${id}?tab=besoins`)} />
    </>
  );
}
