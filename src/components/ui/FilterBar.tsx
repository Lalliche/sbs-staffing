"use client";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Popover } from "./Popover";

export interface FilterDef {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

/** Chips like `Mission : Schéma directeur ×` + "+ Filtre" popover + "Effacer les filtres". */
export function FilterBar({ defs, values, onChange, onClear }: { defs: FilterDef[]; values: Record<string, string>; onChange: (key: string, value: string | null) => void; onClear: () => void }) {
  const active = defs.filter((d) => values[d.key]);
  const [picking, setPicking] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((d) => (
        <span key={d.key} className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-paper py-1 ps-3 pe-1.5 text-sm">
          <span className="text-text-secondary">{d.label} :</span>
          <span className="max-w-[12em] truncate font-medium text-ink">{d.options.find((o) => o.value === values[d.key])?.label ?? values[d.key]}</span>
          <button type="button" aria-label={`Retirer le filtre ${d.label}`} onClick={() => onChange(d.key, null)} className="flex size-5 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:shadow-none ">
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover
        label="Ajouter un filtre"
        align="start"
        width="16em"
        trigger={({ toggle, ref }) => (
          <button ref={ref} type="button" onClick={() => { setPicking(null); toggle(); }} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 py-1 text-sm font-medium text-text-secondary transition-colors hover:border-primary/50 hover:text-ink focus-visible:shadow-none ">
            <Plus className="size-3.5" /> Filtre
          </button>
        )}
      >
        {(close) =>
          picking === null ? (
            <ul className="py-1" role="menu">
              {defs.filter((d) => !values[d.key]).map((d) => (
                <li key={d.key}>
                  <button type="button" role="menuitem" onClick={() => setPicking(d.key)} className="w-full px-3 py-2 text-start text-base hover:bg-paper focus-visible:shadow-none focus-visible:bg-paper">{d.label}</button>
                </li>
              ))}
              {defs.every((d) => values[d.key]) && <li className="px-3 py-2 text-sm text-text-muted">Tous les filtres sont actifs.</li>}
            </ul>
          ) : (
            <ul className="py-1" role="menu">
              <li><button type="button" onClick={() => setPicking(null)} className="w-full px-3 py-1.5 text-start text-xs font-medium text-text-muted hover:text-ink">← {defs.find((d) => d.key === picking)?.label}</button></li>
              {defs.find((d) => d.key === picking)!.options.map((o) => (
                <li key={o.value}>
                  <button type="button" role="menuitem" onClick={() => { onChange(picking, o.value); close(); setPicking(null); }} className={cn("w-full px-3 py-2 text-start text-base hover:bg-paper focus-visible:shadow-none focus-visible:bg-paper")}>{o.label}</button>
                </li>
              ))}
            </ul>
          )
        }
      </Popover>
      {active.length > 0 && (
        <button type="button" onClick={onClear} className="text-sm font-medium text-text-secondary underline-offset-2 hover:text-ink hover:underline focus-visible:shadow-none">
          Effacer les filtres
        </button>
      )}
    </div>
  );
}
