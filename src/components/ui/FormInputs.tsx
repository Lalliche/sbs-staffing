"use client";
import { Check, ChevronDown, Search } from "lucide-react";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion-tokens";

const field =
  "w-full rounded-md border border-border-strong bg-bg px-3 text-base text-text placeholder:text-text-muted " +
  "transition-[border-color,box-shadow] duration-150 ease-(--ease-out-strong) hover:border-primary/60 focus-visible:border-focus focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-focus)] " +
  "disabled:bg-paper disabled:text-text-muted";

export function Field({ label, required, hint, error, children, htmlFor }: { label?: string; required?: boolean; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-text">
          {label}
          {required && <span className="ms-0.5 text-conflict">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p role="alert" className="text-xs text-conflict">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-text-muted">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({ value, onChange, label, required, hint, error, placeholder, type = "text", className, disabled, onBlur, autoFocus }: { value: string; onChange: (v: string) => void; label?: string; required?: boolean; hint?: string; error?: string | null; placeholder?: string; type?: string; className?: string; disabled?: boolean; onBlur?: () => void; autoFocus?: boolean }) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <input id={id} type={type} value={value} disabled={disabled} autoFocus={autoFocus} placeholder={placeholder} onBlur={onBlur} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} className={cn(field, "h-9", error && "border-conflict", className)} />
    </Field>
  );
}

export function TextArea({ value, onChange, label, required, hint, error, placeholder, rows = 4, max, className, onBlur, disabled }: { value: string; onChange: (v: string) => void; label?: string; required?: boolean; hint?: string; error?: string | null; placeholder?: string; rows?: number; max?: number; className?: string; onBlur?: () => void; disabled?: boolean }) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} error={error} htmlFor={id}>
      <div className="relative">
        <textarea id={id} rows={rows} value={value} maxLength={max} disabled={disabled} placeholder={placeholder} onBlur={onBlur} onChange={(e) => onChange(e.target.value)} className={cn(field, "resize-y py-2.5 leading-relaxed", error && "border-conflict", className)} />
        {max && <span className="pointer-events-none absolute bottom-2 end-3 text-xs text-text-muted tabular-nums">{value.length}/{max}</span>}
      </div>
    </Field>
  );
}

export function SelectInput<T extends string>({ value, onChange, options, label, required, hint, className, placeholder }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>; label?: string; required?: boolean; hint?: string; className?: string; placeholder?: string }) {
  const id = useId();
  return (
    <Field label={label} required={required} hint={hint} htmlFor={id}>
      <div className="relative">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)} className={cn(field, "h-9 appearance-none pe-9", className)}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
      </div>
    </Field>
  );
}

export function SearchInput({ value, onChange, placeholder = "Rechercher…", className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
      <input type="search" aria-label={placeholder} autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(field, "h-9 ps-9")} />
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, size = "md", id }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; size?: "sm" | "md"; id?: string }) {
  const w = size === "sm" ? "w-8 h-[1.125em]" : "w-10 h-[1.375em]";
  const knob = size === "sm" ? "size-3.5" : "size-[1.1em]";
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("relative inline-flex shrink-0 items-center rounded-full p-[0.15em] transition-colors duration-200 ease-(--ease-out-strong) focus-visible:outline-none disabled:opacity-50", w, checked ? "bg-primary" : "bg-border-strong")}
    >
      <motion.span layout transition={spring.ui} className={cn("block rounded-full bg-white shadow-xs", knob, checked ? "ms-auto" : "ms-0")} />
    </button>
  );
}

export function Checkbox({ checked, onChange, label, className, disabled, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; className?: string; disabled?: boolean; indeterminate?: boolean }) {
  return (
    <label className={cn("inline-flex cursor-pointer items-start gap-2.5 text-base text-text", disabled && "cursor-not-allowed opacity-50", className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden className={cn("mt-0.5 inline-flex size-[1.1em] shrink-0 items-center justify-center rounded-xs border transition-colors duration-150 peer-focus-visible:shadow-[var(--focus-ring)]", checked || indeterminate ? "border-primary bg-primary text-white" : "border-border-strong bg-bg")}>
        {indeterminate ? <span className="h-[2px] w-2 bg-white" /> : checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label && <span className="leading-snug">{label}</span>}
    </label>
  );
}

export function SegmentedControl<T extends string>({ value, onChange, options, className, label, size = "md" }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; className?: string; label: string; size?: "sm" | "md" }) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-md bg-paper p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(o.value)} className={cn("relative rounded-[calc(var(--radius-md)-0.0625em)] font-medium transition-colors duration-150 focus-visible:outline-none", size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm", active ? "text-text" : "text-text-secondary hover:text-text")}>
            {active && <motion.span layoutId={`seg-${id}`} transition={spring.ui} className="absolute inset-0 rounded-[inherit] bg-bg shadow-xs" />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
