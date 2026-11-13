"use client";
import { Check, ChevronDown, X } from "lucide-react";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Field } from "./FormInputs";
import { Popover } from "./Popover";

const field =
  "w-full rounded-md border border-border-strong bg-bg px-3 text-base text-text placeholder:text-text-muted transition-[border-color,box-shadow] duration-150 hover:border-primary/60 focus-visible:border-focus disabled:bg-paper disabled:text-text-muted";

/** Native date input (keyboard + screen-reader friendly), styled like the other fields. Value = ISO date. */
export function DateInput({ value, onChange, label, required, hint, error, min, max, className, disabled }: { value: string; onChange: (v: string) => void; label?: string; required?: boolean; hint?: string; error?: string | null; min?: string; max?: string; className?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <input id={id} type="date" value={value} min={min} max={max} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} className={cn(field, "h-9", error && "border-conflict", className)} />
    </Field>
  );
}
export function DateRangeInput({ start, end, onChange, label, error }: { start: string; end: string; onChange: (s: string, e: string) => void; label?: string; error?: string | null }) {
  return (
    <fieldset>
      {label && <legend className="mb-1.5 text-sm font-medium text-text">{label}</legend>}
      <div className="grid grid-cols-2 gap-3">
        <DateInput value={start} onChange={(v) => onChange(v, end && v > end ? v : end)} max={end || undefined} label="Du" />
        <DateInput value={end} onChange={(v) => onChange(start, v)} min={start || undefined} label="Au" />
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-conflict">{error}</p>}
    </fieldset>
  );
}

export function NumberInput({ value, onChange, label, min, max, step = 1, suffix, hint, error, className }: { value: number; onChange: (v: number) => void; label?: string; min?: number; max?: number; step?: number; suffix?: string; hint?: string; error?: string | null; className?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="relative">
        <input id={id} type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ""} min={min} max={max} step={step} onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} aria-invalid={!!error} className={cn(field, "h-9 text-end", suffix && "pe-10", error && "border-conflict", className)} />
        {suffix && <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">{suffix}</span>}
      </div>
    </Field>
  );
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1, label, format = (v: number) => String(v), className }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; label: string; format?: (v: number) => string; className?: string }) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={id} className="font-medium text-text">{label}</label>
        <output htmlFor={id} className="tabular-nums text-text-secondary">{format(value)}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ background: `linear-gradient(to right, var(--color-primary) ${pct}%, var(--color-paper-deep) ${pct}%)` }} className="h-1.5 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-sm" />
    </div>
  );
}

export interface Opt<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}
/** Searchable single select. */
export function Combobox<T extends string>({ value, onChange, options, label, placeholder = "Choisir…", required, error, className }: { value: T | ""; onChange: (v: T) => void; options: Opt<T>[]; label?: string; placeholder?: string; required?: boolean; error?: string | null; className?: string }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => options.filter((o) => (o.label + " " + (o.hint ?? "")).toLowerCase().includes(q.toLowerCase())), [options, q]);
  const cur = options.find((o) => o.value === value);
  return (
    <Field label={label} required={required} error={error}>
      <Popover
        label={label ?? placeholder}
        align="start"
        width="min(22em, 90vw)"
        trigger={({ toggle, ref }) => (
          <button ref={ref} type="button" onClick={() => { setQ(""); toggle(); }} aria-haspopup="listbox" className={cn(field, "flex h-9 items-center justify-between gap-2 text-start", !cur && "text-text-muted", error && "border-conflict", className)}>
            <span className="truncate">{cur?.label ?? placeholder}</span>
            <ChevronDown className="size-4 shrink-0 text-text-muted" />
          </button>
        )}
      >
        {(close) => (
          <div>
            <div className="border-b border-border p-2">
              <input autoFocus data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher dans la liste" className={cn(field, "h-8")} />
            </div>
            <ul role="listbox" className="max-h-64 overflow-auto py-1">
              {shown.map((o) => (
                <li key={o.value}>
                  <button type="button" role="option" aria-selected={o.value === value} onClick={() => { onChange(o.value); close(); }} className="flex w-full items-center gap-2 px-3 py-2 text-start text-base hover:bg-paper focus-visible:bg-paper focus-visible:shadow-none">
                    <span className="flex size-4 items-center justify-center">{o.value === value && <Check className="size-4" />}</span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="text-xs text-text-muted">{o.hint}</span>}
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="px-3 py-3 text-sm text-text-muted">Aucun résultat.</li>}
            </ul>
          </div>
        )}
      </Popover>
    </Field>
  );
}

/** Multi-select with chips. */
export function MultiSelect({ values, onChange, options, label, placeholder = "Ajouter…", hint, className }: { values: string[]; onChange: (v: string[]) => void; options: Opt[]; label?: string; placeholder?: string; hint?: string; className?: string }) {
  const [q, setQ] = useState("");
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const anchor = useRef<HTMLDivElement>(null);
  return (
    <Field label={label} hint={hint}>
      <div ref={anchor} className={cn("flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-bg p-1.5", className)}>
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-select py-0.5 ps-2.5 pe-1 text-xs font-medium text-primary">
            {options.find((o) => o.value === v)?.label ?? v}
            <button type="button" aria-label={`Retirer ${options.find((o) => o.value === v)?.label ?? v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="flex size-4 items-center justify-center rounded-full hover:bg-primary/15"><X className="size-3" /></button>
          </span>
        ))}
        <Popover
          label={label ?? placeholder}
          align="start"
          width="min(22em, 90vw)"
          trigger={({ toggle, ref }) => (
            <button ref={ref} type="button" onClick={() => { setQ(""); toggle(); }} className="rounded-full px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-paper hover:text-text">+ {placeholder}</button>
          )}
        >
          {() => (
            <div>
              <div className="border-b border-border p-2"><input autoFocus data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" aria-label="Rechercher dans la liste" className={cn(field, "h-8")} /></div>
              <ul className="max-h-64 overflow-auto py-1">
                {shown.map((o) => {
                  const on = values.includes(o.value);
                  return (
                    <li key={o.value}>
                      <button type="button" aria-pressed={on} onClick={() => onChange(on ? values.filter((x) => x !== o.value) : [...values, o.value])} className="flex w-full items-center gap-2 px-3 py-2 text-start text-base hover:bg-paper focus-visible:shadow-none focus-visible:bg-paper">
                        <span className="flex size-4 items-center justify-center">{on && <Check className="size-4" />}</span>
                        {o.label}
                      </button>
                    </li>
                  );
                })}
                {shown.length === 0 && <li className="px-3 py-3 text-sm text-text-muted">Aucun résultat.</li>}
              </ul>
            </div>
          )}
        </Popover>
      </div>
    </Field>
  );
}

/** Lightweight tooltip: shows on hover and keyboard focus, never covers the trigger. */
export function Tooltip({ text, children, side = "top" }: { text: ReactNode; children: ReactNode; side?: "top" | "bottom" }) {
  const id = useId();
  return (
    <span className="group/tt relative inline-flex" aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className={cn("pointer-events-none absolute start-1/2 z-50 w-max max-w-[18em] -translate-x-1/2 rounded-md bg-ink px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity delay-150 duration-100 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100", side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5")}>
        {text}
      </span>
    </span>
  );
}

/** Horizontal stepper (wizards). */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Étapes">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === current ? "step" : undefined} className="flex items-center gap-2">
          <span className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums", i < current ? "bg-ok text-white" : i === current ? "bg-primary text-white" : "bg-paper-deep text-text-secondary")}>{i < current ? <Check className="size-3.5" /> : i + 1}</span>
          <span className={cn("max-sm:hidden", i === current ? "font-semibold text-ink" : "text-text-secondary")}>{s}</span>
          {i < steps.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-border-strong" />}
        </li>
      ))}
    </ol>
  );
}
