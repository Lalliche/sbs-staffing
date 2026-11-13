"use client";
/* Custom SVG charts (docs/design-system.md §2, motion-plan §charts). Draw ONCE per chart id per session, then static.
   Every chart sits in a ChartCard with a « Voir en tableau » twin; status is never colour alone (markers / dashes / hatch). */
import { motion, useInView, useReducedMotion } from "motion/react";
import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ease } from "@/lib/motion-tokens";
import { SegmentedControl } from "@/components/ui/FormInputs";
import { Card } from "@/components/ui/Surface";

const SERIES = ["var(--color-s1)", "var(--color-s2)", "var(--color-s3)", "var(--color-s4)", "var(--color-s5)", "var(--color-s6)", "var(--color-s7)", "var(--color-s8)"];
export const seriesColor = (i: number) => SERIES[i % SERIES.length];
const DASH = ["", "6 3", "2 3", "8 3 2 3", "", "6 3", "2 3", ""];
const seen = new Set<string>();
function usePlayOnce(id: string) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const first = !seen.has(id) && !reduce;
  if (inView) seen.add(id);
  return { ref, play: first, go: inView || !first };
}

export interface Table {
  head: string[];
  rows: (string | number)[][];
}

/** Card with title, source line, and the « Voir en tableau » toggle. */
export function ChartCard({ title, subtitle, source, table, children, actions, className, summary }: { title: string; subtitle?: string; source?: string; table: Table; children: ReactNode; actions?: ReactNode; className?: string; summary?: string }) {
  const [mode, setMode] = useState<"graph" | "table">("graph");
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-md font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <SegmentedControl size="sm" label={`Affichage — ${title}`} value={mode} onChange={setMode} options={[{ value: "graph", label: "Graphique" }, { value: "table", label: "Tableau" }]} />
        </div>
      </div>
      <div role={mode === "graph" ? "img" : undefined} aria-label={mode === "graph" ? summary ?? title : undefined} className="min-h-0 flex-1">
        {mode === "graph" ? children : (
          <div className="scroll-thin max-h-[18em] overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <caption className="sr-only">{title}</caption>
              <thead className="sticky top-0 bg-paper"><tr>{table.head.map((h, i) => <th key={i} scope="col" className={cn("px-3 py-1.5 font-medium text-text-secondary", i ? "text-end" : "text-start")}>{h}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className={cn("px-3 py-1.5 tabular-nums", j ? "text-end" : "text-start")}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      {source && <p className="mt-3 text-2xs text-text-muted">{source}</p>}
    </Card>
  );
}

export interface Serie {
  name: string;
  values: number[];
  dashed?: boolean;
}
const W = 560;
function scaleOf(max: number) {
  const m = max <= 0 ? 1 : max;
  const step = m <= 10 ? 2 : m <= 50 ? 10 : m <= 120 ? 20 : Math.pow(10, Math.floor(Math.log10(m)));
  const top = Math.ceil(m / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

/** Multi-series line chart with markers, optional threshold lines. */
export function LineChart({ id, labels, series, h = 190, unit = "", thresholds = [] }: { id: string; labels: string[]; series: Serie[]; h?: number; unit?: string; thresholds?: { value: number; label: string; solid?: boolean }[] }) {
  const { ref, play, go } = usePlayOnce(id);
  const max = Math.max(...series.flatMap((x) => x.values), ...thresholds.map((t) => t.value), 1);
  const { top, ticks } = scaleOf(max);
  const L = 36, R = 90, T = 10, B = 24;
  const x = (i: number) => L + (labels.length < 2 ? 0 : (i / (labels.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / top) * (h - T - B);
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${h}`} className="w-full" aria-hidden>
      {ticks.map((t) => (<g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--color-line)" /><text x={L - 6} y={y(t) + 3} textAnchor="end" className="fill-text-muted text-[9px] tabular-nums">{t}{unit}</text></g>))}
      {labels.map((l, i) => <text key={i} x={x(i)} y={h - 6} textAnchor="middle" className="fill-text-muted text-[9px]">{l}</text>)}
      {thresholds.map((t) => (<g key={t.label}><motion.line x1={L} x2={W - R} y1={y(t.value)} y2={y(t.value)} stroke={t.solid ? "var(--color-conflict)" : "var(--color-neutral)"} strokeWidth={1.2} strokeDasharray={t.solid ? undefined : "4 3"} initial={play ? { opacity: 0 } : false} animate={{ opacity: go ? 1 : 0 }} transition={{ delay: play ? 0.9 : 0, duration: 0.3 }} /><text x={W - R + 4} y={y(t.value) + 3} className="fill-text-secondary text-[9px]">{t.label}</text></g>))}
      {series.map((s, si) => {
        const pts = s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
        const last = s.values.length - 1;
        return (
          <g key={s.name}>
            <motion.path d={pts} fill="none" stroke={seriesColor(si)} strokeWidth={2} strokeDasharray={DASH[si] || undefined} strokeLinejoin="round" initial={play ? { pathLength: 0 } : false} animate={{ pathLength: go ? 1 : 0 }} transition={{ duration: play ? 0.9 : 0, ease: ease.inOut ?? ease.out }} />
            {s.values.map((v, i) => <Marker key={i} kind={si} cx={x(i)} cy={y(v)} color={seriesColor(si)} />)}
            <text x={x(last) + 8} y={y(s.values[last]) + 3} className="fill-ink text-[9px] font-medium">{s.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
function Marker({ kind, cx, cy, color }: { kind: number; cx: number; cy: number; color: string }) {
  const k = kind % 4;
  const common = { fill: color, stroke: "#fff", strokeWidth: 1.2 };
  if (k === 1) return <rect x={cx - 3.2} y={cy - 3.2} width={6.4} height={6.4} {...common} />;
  if (k === 2) return <path d={`M${cx},${cy - 4} L${cx + 4},${cy} L${cx},${cy + 4} L${cx - 4},${cy}Z`} {...common} />;
  if (k === 3) return <path d={`M${cx},${cy - 4} L${cx + 4},${cy + 3} L${cx - 4},${cy + 3}Z`} {...common} />;
  return <circle cx={cx} cy={cy} r={3.4} {...common} />;
}

/** Vertical or horizontal bars (single series or grouped), baseline-anchored, first-view scale. */
export function Bars({ id, labels, series, h = 190, unit = "", horizontal = false, max: forcedMax, formatValue }: { id: string; labels: string[]; series: Serie[]; h?: number; unit?: string; horizontal?: boolean; max?: number; formatValue?: (v: number) => string }) {
  const { ref, play, go } = usePlayOnce(id);
  const max = forcedMax ?? Math.max(...series.flatMap((s) => s.values), 1);
  const { top, ticks } = scaleOf(max);
  const fmt = formatValue ?? ((v: number) => `${v}${unit}`);
  if (horizontal) {
    const rowH = 26;
    const H = labels.length * rowH + 8;
    const L = 130;
    return (
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
        {labels.map((lab, i) => (
          <g key={lab} transform={`translate(0,${i * rowH + 4})`}>
            <text x={L - 8} y={rowH / 2 + 1} textAnchor="end" className="fill-ink text-[10px]">{lab.length > 22 ? lab.slice(0, 21) + "…" : lab}</text>
            {series.map((s, si) => {
              const w = ((s.values[i] ?? 0) / top) * (W - L - 60);
              const bh = (rowH - 8) / series.length;
              return (<g key={si}><motion.rect x={L} y={4 + si * bh} height={bh - 1} rx={2} fill={seriesColor(si)} width={Math.max(w, 1)} style={{ transformOrigin: `${L}px 0`, transformBox: "view-box" }} initial={play ? { scaleX: 0 } : false} animate={{ scaleX: go ? 1 : 0 }} transition={{ duration: play ? 0.5 : 0, delay: play ? i * 0.025 : 0, ease: ease.outExpo }} /><text x={L + Math.max(w, 1) + 5} y={4 + si * bh + bh / 2 + 3} className="fill-text-secondary text-[9px] tabular-nums">{fmt(s.values[i] ?? 0)}</text></g>);
            })}
          </g>
        ))}
      </svg>
    );
  }
  const L = 34, T = 10, B = 28;
  const bw = (W - L - 10) / labels.length;
  const y = (v: number) => T + (1 - v / top) * (h - T - B);
  const gw = Math.min(bw * 0.7, 46) / series.length;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${h}`} className="w-full" aria-hidden>
      {ticks.map((t) => (<g key={t}><line x1={L} x2={W - 6} y1={y(t)} y2={y(t)} stroke="var(--color-line)" /><text x={L - 5} y={y(t) + 3} textAnchor="end" className="fill-text-muted text-[9px] tabular-nums">{t}{unit}</text></g>))}
      {labels.map((lab, i) => {
        const cx = L + bw * i + bw / 2;
        return (
          <g key={lab}>
            <text x={cx} y={h - 10} textAnchor="middle" className="fill-text-muted text-[9px]">{lab.length > 14 ? lab.slice(0, 13) + "…" : lab}</text>
            {series.map((s, si) => {
              const v = s.values[i] ?? 0;
              const bx = cx - (gw * series.length) / 2 + si * gw;
              return (<g key={si}><motion.rect x={bx} width={gw - 1} y={y(v)} height={Math.max(h - B - y(v), 0)} rx={2} fill={seriesColor(si)} style={{ transformOrigin: `${bx}px ${h - B}px`, transformBox: "view-box" }} initial={play ? { scaleY: 0 } : false} animate={{ scaleY: go ? 1 : 0 }} transition={{ duration: play ? 0.5 : 0, delay: play ? Math.min(i * 0.025, 0.4) : 0, ease: ease.outExpo }} /><text x={bx + (gw - 1) / 2} y={y(v) - 3} textAnchor="middle" className="fill-ink text-[8px] tabular-nums">{v ? fmt(v) : ""}</text></g>);
            })}
          </g>
        );
      })}
      <line x1={L} x2={W - 6} y1={h - B} y2={h - B} stroke="var(--color-border-strong)" />
    </svg>
  );
}

/** Stacked bars + capacity line; the part of demand above capacity is the HATCHED deficit segment. */
export function StackedBars({ id, labels, stacks, capacity, h = 220, unit = "" }: { id: string; labels: string[]; stacks: Serie[]; capacity?: number[]; h?: number; unit?: string }) {
  const { ref, play, go } = usePlayOnce(id);
  const pat = useId().replace(/:/g, "");
  const totals = labels.map((_, i) => stacks.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const max = Math.max(...totals, ...(capacity ?? []), 1);
  const { top, ticks } = scaleOf(max);
  const L = 36, T = 12, B = 28;
  const bw = (W - L - 100) / labels.length;
  const y = (v: number) => T + (1 - v / top) * (h - T - B);
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${h}`} className="w-full" aria-hidden>
      <defs><pattern id={`h${pat}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--color-conflict-bg)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-conflict)" strokeWidth="2.2" /></pattern></defs>
      {ticks.map((t) => (<g key={t}><line x1={L} x2={W - 100} y1={y(t)} y2={y(t)} stroke="var(--color-line)" /><text x={L - 5} y={y(t) + 3} textAnchor="end" className="fill-text-muted text-[9px] tabular-nums">{t}{unit}</text></g>))}
      {labels.map((lab, i) => {
        const cx = L + bw * i + bw / 2;
        const bwid = Math.min(bw * 0.6, 54);
        let acc = 0;
        const cap = capacity?.[i];
        const deficit = cap !== undefined ? Math.max(0, totals[i] - cap) : 0;
        return (
          <g key={lab}>
            <text x={cx} y={h - 10} textAnchor="middle" className="fill-text-muted text-[9px]">{lab}</text>
            {stacks.map((s, si) => {
              const v = s.values[i] ?? 0;
              const y0 = y(acc + v);
              const hh = y(acc) - y0;
              acc += v;
              return <motion.rect key={si} x={cx - bwid / 2} width={bwid} y={y0} height={Math.max(hh - 1, 0)} fill={seriesColor(si)} style={{ transformOrigin: `${cx}px ${h - B}px`, transformBox: "view-box" }} initial={play ? { scaleY: 0 } : false} animate={{ scaleY: go ? 1 : 0 }} transition={{ duration: play ? 0.5 : 0, delay: play ? i * 0.04 : 0, ease: ease.outExpo }} />;
            })}
            {deficit > 0.05 && cap !== undefined && <rect x={cx - bwid / 2 - 2} width={bwid + 4} y={y(totals[i])} height={Math.max(y(cap) - y(totals[i]), 0)} fill={`url(#h${pat})`} stroke="var(--color-conflict)" strokeWidth={1} />}
          </g>
        );
      })}
      {capacity && (
        <g>
          <polyline fill="none" stroke="var(--color-ink)" strokeWidth={1.8} strokeDasharray="5 3" points={capacity.map((c, i) => `${L + bw * i + bw / 2},${y(c)}`).join(" ")} />
          {capacity.map((c, i) => <circle key={i} cx={L + bw * i + bw / 2} cy={y(c)} r={2.6} fill="#fff" stroke="var(--color-ink)" strokeWidth={1.5} />)}
          <text x={W - 96} y={y(capacity[capacity.length - 1]) + 3} className="fill-ink text-[9px] font-medium">Capacité</text>
        </g>
      )}
      <g transform={`translate(${W - 96},${T + 16})`}>{stacks.map((s, i) => <g key={s.name} transform={`translate(0,${i * 13})`}><rect width="8" height="8" fill={seriesColor(i)} /><text x="12" y="8" className="fill-ink text-[8.5px]">{s.name}</text></g>)}<g transform={`translate(0,${stacks.length * 13})`}><rect width="8" height="8" fill={`url(#h${pat})`} stroke="var(--color-conflict)" /><text x="12" y="8" className="fill-ink text-[8.5px]">Déficit</text></g></g>
    </svg>
  );
}

/** Donut: one masked circle reveals every segment (single pathLength animation). */
export function Donut({ id, slices, size = 150, center }: { id: string; slices: { label: string; value: number }[]; size?: number; center?: { value: string; label: string } }) {
  const { ref, play, go } = usePlayOnce(id);
  const mask = useId().replace(/:/g, "");
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 38, C = 2 * Math.PI * r;
  const offsets = slices.map((_, i) => slices.slice(0, i).reduce((a, x) => a + (x.value / total) * C, 0));
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg ref={ref} viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <defs><mask id={mask}><motion.circle cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeWidth={22} strokeDasharray={C} transform="rotate(-90 50 50)" initial={play ? { pathLength: 0 } : false} animate={{ pathLength: go ? 1 : 0 }} transition={{ duration: play ? 0.8 : 0, ease: ease.outExpo }} /></mask></defs>
        <g mask={`url(#${mask})`}>
          {slices.map((s, i) => {
            const len = (s.value / total) * C;
            return <circle key={s.label} cx="50" cy="50" r={r} fill="none" stroke={seriesColor(i)} strokeWidth={22} strokeDasharray={`${Math.max(len - 1, 0)} ${C}`} strokeDashoffset={-offsets[i]} transform="rotate(-90 50 50)" />;
          })}
        </g>
        {center && (<><text x="50" y="49" textAnchor="middle" className="fill-ink text-[13px] font-semibold tabular-nums">{center.value}</text><text x="50" y="60" textAnchor="middle" className="fill-text-muted text-[6px]">{center.label}</text></>)}
      </svg>
      <ul className="min-w-0 space-y-1 text-xs">
        {slices.map((s, i) => (<li key={s.label} className="flex items-center gap-2"><span aria-hidden className="size-2.5 rounded-sm" style={{ background: seriesColor(i) }} /><span className="text-text-secondary">{s.label}</span><span className="ms-auto ps-3 font-medium tabular-nums text-ink">{s.value}</span></li>))}
      </ul>
    </div>
  );
}

/** Tiny trend line for KPI cards (decorative, aria-hidden; the trend is also stated in text by the KPI). */
export function Sparkline({ values, w = 96, h = 28, color = "var(--color-primary)" }: { values: number[]; w?: number; h?: number; color?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (w - 4) + 2, h - 3 - ((v - min) / span) * (h - 6)]);
  return (
    <svg width={w} height={h} aria-hidden viewBox={`0 0 ${w} ${h}`}>
      <path d={`M${pts.map((p) => p.join(",")).join(" L")}`} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.2} fill={color} />
    </svg>
  );
}

/** Utilization heatmap (rows × columns), single-hue ramp, number in the cell, hatched >100 %. */
export function Heatmap({ id, rows, cols, values, max = 120, unit = "%" }: { id: string; rows: string[]; cols: string[]; values: number[][]; max?: number; unit?: string }) {
  const { ref, play, go } = usePlayOnce(id);
  const step = (v: number) => (v > 100 ? 9 : Math.min(8, Math.max(1, Math.ceil((v / 100) * 8))));
  const cw = Math.min(56, (W - 130) / cols.length);
  const H = rows.length * 24 + 26;
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
      {cols.map((c, j) => <text key={c} x={130 + j * cw + cw / 2} y={12} textAnchor="middle" className="fill-text-muted text-[9px]">{c}</text>)}
      {rows.map((r, i) => (
        <g key={r} transform={`translate(0,${20 + i * 24})`}>
          <text x={124} y={15} textAnchor="end" className="fill-ink text-[10px]">{r.length > 20 ? r.slice(0, 19) + "…" : r}</text>
          {cols.map((c, j) => {
            const v = values[i]?.[j] ?? 0;
            const st = step(Math.min(v, max));
            return (
              <motion.g key={c} initial={play ? { opacity: 0 } : false} animate={{ opacity: go ? 1 : 0 }} transition={{ duration: play ? 0.22 : 0, delay: play ? (i + j) * 0.01 : 0 }}>
                <rect x={130 + j * cw + 1} y={0} width={cw - 2} height={21} rx={2} fill={st === 9 ? "var(--color-conflict)" : `var(--color-ramp-${st})`} />
                <text x={130 + j * cw + cw / 2} y={14} textAnchor="middle" className={cn("text-[9px] font-medium tabular-nums", st >= 6 ? "fill-white" : "fill-ink")}>{Math.round(v)}{unit}{v > 100 ? " ▲" : ""}</text>
              </motion.g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}
