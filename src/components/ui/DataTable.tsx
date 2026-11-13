"use client";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Columns3, Download, MoveDown, MoveUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dur, ease, staggerStep } from "@/lib/motion-tokens";
import { downloadFile, toCsv } from "@/lib/download";
import { Checkbox, SegmentedControl } from "./FormInputs";
import { Button, IconButton } from "./Button";
import { Popover } from "./Popover";

export type Density = "compact" | "default" | "comfortable";
const DKEY = "sbs-staffing:density";
const dens = new Set<() => void>();
const readDensity = (): Density => {
  try {
    const v = localStorage.getItem(DKEY);
    return v === "compact" || v === "comfortable" ? v : "default";
  } catch {
    return "default";
  }
};
/** Row density is a per-user setting persisted in the browser (design-system §4). */
export function useDensity(): [Density, (d: Density) => void] {
  const d = useSyncExternalStore((cb) => { dens.add(cb); return () => dens.delete(cb); }, readDensity, () => "default" as Density);
  return [d, (v) => { try { localStorage.setItem(DKEY, v); } catch { /* ignore */ } dens.forEach((l) => l()); }];
}
const ROW_H: Record<Density, string> = { compact: "h-8 text-xs", default: "h-10 text-sm", comfortable: "h-12 text-sm" };

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sort?: (a: T, b: T) => number;
  align?: "start" | "end";
  width?: string;
  hideBelow?: "md" | "lg";
  /** Plain value for CSV export (defaults to nothing → column skipped). */
  csv?: (row: T) => string | number | null | undefined;
  /** Hidden until chosen in the column chooser. */
  defaultHidden?: boolean;
  /** Cannot be hidden. */
  required?: boolean;
}

export function DataTable<T>({
  rows, columns, getId, onRowClick, selectable, bulk, rowActions, empty, pageSize = 25, toolbar, caption, defaultSort, exportName, footerRow,
}: {
  rows: T[];
  columns: Column<T>[];
  getId: (r: T) => string;
  onRowClick?: (r: T) => void;
  selectable?: boolean;
  bulk?: (selected: T[], clear: () => void) => ReactNode;
  rowActions?: (r: T) => ReactNode;
  empty: ReactNode;
  pageSize?: number;
  toolbar?: ReactNode;
  caption: string;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  /** Enables the CSV export button (file name without extension). */
  exportName?: string;
  footerRow?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const [density, setDensity] = useDensity();
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(defaultSort ?? null);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(pageSize);
  const [picked, setPicked] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>(() => columns.map((c) => c.key));
  const [hidden, setHidden] = useState<string[]>(() => columns.filter((c) => c.defaultHidden).map((c) => c.key));

  const ordered = useMemo(() => {
    const known = order.filter((k) => columns.some((c) => c.key === k));
    const extra = columns.filter((c) => !known.includes(c.key)).map((c) => c.key);
    return [...known, ...extra].map((k) => columns.find((c) => c.key === k)!).filter(Boolean);
  }, [order, columns]);
  const visible = ordered.filter((c) => !hidden.includes(c.key));
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const out = [...rows].sort(col.sort);
    return sort.dir === "desc" ? out.reverse() : out;
  }, [rows, sort, columns]);
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const cur = Math.min(page, pages - 1);
  const view = sorted.slice(cur * size, cur * size + size);
  const selectedRows = rows.filter((r) => picked.includes(getId(r)));
  const allOnPage = view.length > 0 && view.every((r) => picked.includes(getId(r)));
  const toggleSort = (key: string) => setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  const hide = (c: Column<T>) => (c.hideBelow === "md" ? "max-md:hidden" : c.hideBelow === "lg" ? "max-lg:hidden" : "");
  const move = (key: string, dir: -1 | 1) => setOrder((o) => {
    const arr = ordered.map((c) => c.key);
    const i = arr.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return o;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return arr;
  });
  const exportCsv = () => {
    const cols = visible.filter((c) => c.csv);
    downloadFile(`${exportName ?? "export"}.csv`, toCsv(cols.map((c) => c.header), sorted.map((r) => cols.map((c) => c.csv!(r)))));
  };
  const hiddenCount = hidden.length;
  const px = density === "compact" ? "px-3" : "px-4";

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        <div className="flex items-center gap-2">
          <SegmentedControl size="sm" label="Densité d’affichage" value={density} onChange={setDensity} options={[{ value: "compact", label: "Compacte" }, { value: "default", label: "Standard" }, { value: "comfortable", label: "Aérée" }]} className="max-md:hidden" />
          <Popover
            label="Colonnes"
            width="17em"
            trigger={({ toggle, ref }) => (
              <Button ref={ref} variant="secondary" size="sm" onClick={toggle} icon={<Columns3 className="size-4" />}>
                Colonnes{hiddenCount ? ` (${visible.length}/${columns.length})` : ""}
              </Button>
            )}
          >
            {() => (
              <ul className="py-1">
                {ordered.map((c, i) => (
                  <li key={c.key} className="flex items-center gap-1 px-3 py-1">
                    <Checkbox checked={!hidden.includes(c.key)} disabled={c.required} onChange={(v) => setHidden((h) => (v ? h.filter((k) => k !== c.key) : [...h, c.key]))} label={c.header} className="flex-1" />
                    <IconButton label={`Monter ${c.header}`} size="sm" disabled={i === 0} onClick={() => move(c.key, -1)}><MoveUp className="size-3.5" /></IconButton>
                    <IconButton label={`Descendre ${c.header}`} size="sm" disabled={i === ordered.length - 1} onClick={() => move(c.key, 1)}><MoveDown className="size-3.5" /></IconButton>
                  </li>
                ))}
              </ul>
            )}
          </Popover>
          {exportName && (
            <Button variant="secondary" size="sm" onClick={exportCsv} icon={<Download className="size-4" />}>
              Exporter CSV
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-bg">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[40em] border-collapse">
            <caption className="sr-only">{caption}</caption>
            <thead className="sticky top-0 z-10 bg-paper/70 backdrop-blur-sm">
              <tr className="border-b border-border">
                {selectable && (
                  <th className="w-10 ps-4">
                    <Checkbox checked={allOnPage} indeterminate={!allOnPage && view.some((r) => picked.includes(getId(r)))} onChange={(v) => setPicked(v ? [...new Set([...picked, ...view.map(getId)])] : picked.filter((id) => !view.some((r) => getId(r) === id)))} label={<span className="sr-only">Tout sélectionner</span>} />
                  </th>
                )}
                {visible.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined} style={{ width: c.width }} className={cn("group/th h-10 text-xs font-medium text-text-secondary", px, c.align === "end" ? "text-end" : "text-start", hide(c))}>
                      {c.sort ? (
                        <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 transition-colors hover:text-ink", active && "text-ink", c.align === "end" && "flex-row-reverse")}>
                          {c.header}
                          {active ? sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-0 transition-opacity group-hover/th:opacity-60" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
                {rowActions && <th className="w-12" />}
              </tr>
            </thead>
            <tbody>
              {view.length === 0 ? (
                <tr>
                  <td colSpan={visible.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)}>{empty}</td>
                </tr>
              ) : (
                view.map((r, i) => {
                  const id = getId(r);
                  const on = picked.includes(id);
                  return (
                    <motion.tr
                      key={id}
                      initial={reduce || page > 0 ? false : { opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out, delay: Math.min(i, 10) * staggerStep.rows } }}
                      onClick={onRowClick ? () => onRowClick(r) : undefined}
                      onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(r); } : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-selected={selectable ? on : undefined}
                      className={cn("group/row border-b border-line last:border-b-0 transition-colors duration-100 focus-visible:bg-select", on ? "bg-select shadow-[inset_2px_0_0_var(--color-primary)]" : "hover:bg-canvas", onRowClick && "cursor-pointer")}
                    >
                      {selectable && (
                        <td className="ps-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={on} onChange={(v) => setPicked(v ? [...picked, id] : picked.filter((x) => x !== id))} label={<span className="sr-only">Sélectionner la ligne</span>} />
                        </td>
                      )}
                      {visible.map((c) => (
                        <td key={c.key} className={cn(px, ROW_H[density], c.align === "end" ? "text-end tabular-nums" : "text-start", hide(c))}>
                          {c.cell(r)}
                        </td>
                      ))}
                      {rowActions && (
                        <td className="pe-3 text-end" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">{rowActions(r)}</div>
                        </td>
                      )}
                    </motion.tr>
                  );
                })
              )}
            </tbody>
            {footerRow && <tfoot className="border-t-2 border-border bg-paper/50 font-semibold">{footerRow}</tfoot>}
          </table>
        </div>
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-paper/40 px-4 py-2 text-xs text-text-secondary">
            <span className="tabular-nums">
              {sorted.length === 0 ? 0 : cur * size + 1}–{Math.min(sorted.length, cur * size + size)} sur {sorted.length}
            </span>
            <span className="flex items-center gap-3">
              <label className="flex items-center gap-1.5">
                Lignes par page
                <select value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }} className="rounded border border-border-strong bg-bg px-1 py-0.5">
                  {[10, 25, 50, 100].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
              <span className="tabular-nums">{cur + 1} / {pages}</span>
              <IconButton label="Page précédente" size="sm" disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft className="size-4" /></IconButton>
              <IconButton label="Page suivante" size="sm" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight className="size-4" /></IconButton>
            </span>
          </div>
        )}
      </div>
      {bulk && selectedRows.length > 0 && (
        <motion.div role="region" aria-live="polite" aria-label="Actions groupées" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="sticky bottom-4 z-20 mx-auto mt-4 flex w-fit items-center gap-4 rounded-lg bg-primary px-4 py-2.5 text-sm text-white shadow-lg">
          <span className="font-medium tabular-nums">{selectedRows.length} sélectionné{selectedRows.length > 1 ? "s" : ""}</span>
          {bulk(selectedRows, () => setPicked([]))}
          <Button variant="inverse" size="sm" onClick={() => setPicked([])}>
            Désélectionner
          </Button>
        </motion.div>
      )}
    </div>
  );
}

/** Saved-view chips above a table. */
export function SavedViews<T extends string>({ value, onChange, views }: { value: T; onChange: (v: T) => void; views: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div role="tablist" aria-label="Vues enregistrées" className="mb-3 flex flex-wrap gap-1.5">
      {views.map((v) => (
        <button key={v.value} role="tab" aria-selected={v.value === value} type="button" onClick={() => onChange(v.value)} className={cn("rounded-full border px-3 py-1 text-sm font-medium transition-colors duration-150", v.value === value ? "border-primary bg-primary text-white" : "border-border-strong bg-bg text-text-secondary hover:border-primary/50 hover:text-text")}>
          {v.label}
          {v.count !== undefined && <span className={cn("ms-1.5 tabular-nums", v.value === value ? "text-white/70" : "text-text-muted")}>{v.count}</span>}
        </button>
      ))}
    </div>
  );
}
