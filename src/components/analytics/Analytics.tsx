"use client";
import { Download, FileText } from "lucide-react";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { availableReports, buildReport } from "@/lib/store/selectors/analytics";
import { downloadFile, toCsv } from "@/lib/download";
import { Bars, ChartCard } from "@/components/charts/Charts";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/Controls";
import { SelectInput } from "@/components/ui/FormInputs";
import { Card, EmptyState, PageHeader } from "@/components/ui/Surface";
import { cn } from "@/lib/utils";
import { fmtInt } from "@/lib/engine/format";
import { BarChart3 } from "lucide-react";

export function AnalyticsPage() {
  const { s, can } = useSession();
  const q = useQueryState();
  const list = availableReports(s);
  const id = q.get("rapport") || list[0]?.id;
  const rep = id ? buildReport(s, id, { dept: q.get("dept") || undefined, grade: q.get("grade") || undefined, from: q.get("from") || undefined, to: q.get("to") || undefined }) : null;
  const xls = () => rep && downloadFile(`${rep.id}.xls`, `<table><tr>${rep.head.map((h) => `<th>${h}</th>`).join("")}</tr>${rep.rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`, "application/vnd.ms-excel");
  return (
    <>
      <PageHeader title="Analytics et rapports" description="Rapports filtrables, exportables (CSV, Excel) et imprimables en PDF. Les rapports de coûts n’apparaissent que pour les profils habilités." actions={rep && can("analytics.export") && <span className="no-print flex gap-2"><Button variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadFile(`${rep.id}.csv`, toCsv(rep.head, rep.rows))}>CSV</Button><Button variant="secondary" icon={<Download className="size-4" />} onClick={xls}>Excel</Button><Button variant="secondary" icon={<FileText className="size-4" />} onClick={() => window.print()}>PDF (impression)</Button></span>} />
      <div className="grid gap-4 xl:grid-cols-[17em_1fr]">
        <nav aria-label="Rapports" className="no-print h-fit rounded-lg border border-border bg-bg p-2"><ul>{list.map((r) => <li key={r.id}><button type="button" onClick={() => q.set("rapport", r.id)} aria-current={r.id === id} className={cn("w-full rounded px-3 py-2 text-start text-sm hover:bg-paper", r.id === id && "bg-select font-medium text-ink")}>{r.title}{r.cost && <span className="ms-1.5 text-2xs text-text-muted">(coûts)</span>}</button></li>)}</ul></nav>
        <div className="print-area flex min-w-0 flex-col gap-4">
          <Card className="no-print !p-3"><div className="grid gap-3 sm:grid-cols-4"><SelectInput label="Département" value={q.get("dept")} onChange={(v) => q.set("dept", v || null)} options={[{ value: "", label: "Tous" }, ...s.departments.map((d) => ({ value: d.id, label: d.name }))]} /><SelectInput label="Grade" value={q.get("grade")} onChange={(v) => q.set("grade", v || null)} options={[{ value: "", label: "Tous" }, ...s.grades.map((d) => ({ value: d.id, label: d.name }))]} /><DateInput label="Du" value={q.get("from")} onChange={(v) => q.set("from", v || null)} /><DateInput label="Au" value={q.get("to")} onChange={(v) => q.set("to", v || null)} /></div></Card>
          {!rep ? <EmptyState icon={BarChart3} title="Rapport indisponible" description="Ce rapport n’est pas accessible avec votre profil." /> : (
            <>
              <h2 className="text-lg font-semibold text-ink">{rep.title}</h2>
              <p className="-mt-2 text-sm text-text-secondary">{rep.description}</p>
              {rep.chart && <ChartCard title="Graphique" source={rep.source} table={{ head: ["", ...rep.chart.series.map((x) => x.name)], rows: rep.chart.labels.map((l, i) => [l, ...rep.chart!.series.map((x) => x.values[i])]) }}><Bars id={`rep-${rep.id}-${q.get("dept")}-${q.get("grade")}`} labels={rep.chart.labels} series={rep.chart.series} unit={rep.chart.unit} /></ChartCard>}
              <Card className="!p-0 overflow-hidden"><div className="scroll-thin max-h-[32em] overflow-auto"><table className="w-full text-sm"><caption className="sr-only">{rep.title}</caption><thead className="sticky top-0 bg-paper"><tr>{rep.head.map((h, i) => <th key={h} className={cn("px-3 py-2 font-medium text-text-secondary", i ? "text-end" : "text-start")}>{h}</th>)}</tr></thead><tbody>{rep.rows.length === 0 && <tr><td colSpan={rep.head.length} className="p-6 text-center text-text-muted">Aucune ligne.</td></tr>}{rep.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className={cn("px-3 py-1.5", j ? "text-end tabular-nums" : "text-start")}>{typeof c === "number" && c > 9999 ? fmtInt(c) : c}</td>)}</tr>)}</tbody></table></div></Card>
              <p className="text-2xs text-text-muted">{rep.source}</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
