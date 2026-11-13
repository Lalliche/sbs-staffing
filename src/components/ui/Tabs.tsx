"use client";
import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion-tokens";

export interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  count?: number | string;
}

export function Tabs<T extends string>({ value, onChange, items, className, label }: { value: T; onChange: (v: T) => void; items: TabItem<T>[]; className?: string; label: string }) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-1 overflow-x-auto border-b border-border scroll-thin", className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button key={it.value} role="tab" aria-selected={active} type="button" onClick={() => onChange(it.value)} className={cn("relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-base font-medium transition-colors duration-150 focus-visible:shadow-none focus-visible:bg-paper", active ? "text-ink" : "text-text-secondary hover:text-text")}>
            {it.label}
            {it.count !== undefined && <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-ink text-white" : "bg-paper-deep text-text-secondary")}>{it.count}</span>}
            {active && <motion.span layoutId={`tab-${id}`} transition={spring.ui} className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}
