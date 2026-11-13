/* Chart data contracts shared by the dashboard / capacity / analytics selectors and the chart components.
   A selector returns a ChartSpec (pure data); the UI draws it AND derives the « Voir en tableau » twin from the same spec. */
import { fmtDec, fmtHours, fmtInt, fmtPct, fmtDZDCompact } from "../../engine/format";

export type Unit = "pct" | "int" | "dec" | "hours" | "dzd" | "fte";

export function formatValue(unit: Unit, v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  switch (unit) {
    case "pct":
      return fmtPct(v);
    case "int":
      return fmtInt(v);
    case "hours":
      return fmtHours(v);
    case "dzd":
      return fmtDZDCompact(v);
    case "fte":
      return `${fmtDec(v)} ETP`;
    default:
      return fmtDec(v);
  }
}

export interface ChartSeries {
  key: string;
  label: string;
  values: (number | null)[];
  /** CSS colour; defaults to the series palette (--color-s1…s8) by index. */
  color?: string;
  dashed?: boolean;
}
export interface ChartThreshold {
  value: number;
  label: string;
  kind: "under" | "over" | "target";
}
export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color?: string;
  /** Hatched fill (colour-blind safe / monochrome print). */
  hatched?: boolean;
}
export interface HeatRow {
  key: string;
  label: string;
  sub?: string;
}

export type ChartSpec =
  | { kind: "line"; categories: string[]; series: ChartSeries[]; unit: Unit; thresholds?: ChartThreshold[]; yMax?: number }
  | { kind: "bars"; orientation: "v" | "h"; categories: string[]; series: ChartSeries[]; unit: Unit; thresholds?: ChartThreshold[]; colors?: string[]; hatched?: boolean[]; yMax?: number }
  | { kind: "stacked"; categories: string[]; series: ChartSeries[]; unit: Unit; capacity?: number[]; capacityLabel?: string; deficitLabel?: string }
  | { kind: "donut"; slices: DonutSlice[]; unit: Unit; centerLabel?: string; centerValue?: string }
  | { kind: "heatmap"; rows: HeatRow[]; cols: string[]; values: (number | null)[][]; unit: Unit };

export interface TableData {
  columns: string[];
  rows: string[][];
}

/** The « Voir en tableau » twin of any chart. Same numbers, formatted fr-FR. */
export function specToTable(spec: ChartSpec, firstColumn = "Catégorie"): TableData {
  switch (spec.kind) {
    case "line":
    case "bars": {
      const cols = [firstColumn, ...spec.series.map((x) => x.label)];
      return { columns: cols, rows: spec.categories.map((c, i) => [c, ...spec.series.map((x) => formatValue(spec.unit, x.values[i]))]) };
    }
    case "stacked": {
      const cols = [firstColumn, ...spec.series.map((x) => x.label), "Total", ...(spec.capacity ? [spec.capacityLabel ?? "Capacité"] : []), ...(spec.capacity ? [spec.deficitLabel ?? "Déficit"] : [])];
      return {
        columns: cols,
        rows: spec.categories.map((c, i) => {
          const total = spec.series.reduce((a, x) => a + (x.values[i] ?? 0), 0);
          const cap = spec.capacity?.[i];
          return [c, ...spec.series.map((x) => formatValue(spec.unit, x.values[i])), formatValue(spec.unit, total), ...(spec.capacity ? [formatValue(spec.unit, cap)] : []), ...(spec.capacity ? [formatValue(spec.unit, Math.max(0, total - (cap ?? 0)))] : [])];
        }),
      };
    }
    case "donut": {
      const total = spec.slices.reduce((a, x) => a + x.value, 0);
      return { columns: [firstColumn, "Valeur", "Part"], rows: spec.slices.map((x) => [x.label, formatValue(spec.unit, x.value), total ? fmtPct((x.value / total) * 100) : "—"]) };
    }
    case "heatmap":
      return { columns: [firstColumn, ...spec.cols], rows: spec.rows.map((r, i) => [r.sub ? `${r.label} (${r.sub})` : r.label, ...spec.cols.map((_, j) => formatValue(spec.unit, spec.values[i]?.[j]))]) };
  }
}

/** One-sentence summary for role="img" aria-labels, derived from the spec. */
export function specSummary(spec: ChartSpec, title: string): string {
  switch (spec.kind) {
    case "line":
    case "bars":
    case "stacked":
      return `${title} : ${spec.series.length} série${spec.series.length > 1 ? "s" : ""} sur ${spec.categories.length} points (${spec.categories[0] ?? "—"} à ${spec.categories[spec.categories.length - 1] ?? "—"}). Voir le tableau pour les valeurs.`;
    case "donut":
      return `${title} : ${spec.slices.map((x) => `${x.label} ${formatValue(spec.unit, x.value)}`).join(", ")}.`;
    case "heatmap":
      return `${title} : ${spec.rows.length} lignes sur ${spec.cols.length} colonnes. Voir le tableau pour les valeurs.`;
  }
}
