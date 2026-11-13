"use client";
import { motion, useInView, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/Charts";
import { STATUS_ICON, type Tone } from "@/components/ui/Badge";
import type { Kpi as KpiData } from "@/lib/store/selectors/dashboard";

const played = new Set<string>();
/** KPI card: value, hint, optional sparkline, drill-down link. Fades in on first view only. */
export function Kpi({ k, className }: { k: KpiData; className?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const first = !reduce && !played.has(k.key);
  if (inView) played.add(k.key);
  const tone: Tone | undefined = k.tone && k.tone !== "neutral" ? k.tone : undefined;
  const Icon = tone ? STATUS_ICON[tone] : null;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-secondary">{k.label}</p>
        {Icon && <Icon aria-hidden className={cn("size-4 shrink-0", tone === "ok" && "text-ok", tone === "alert" && "text-alert", tone === "conflict" && "text-conflict")} />}
      </div>
      <motion.p initial={first ? { opacity: 0, y: 4 } : false} animate={{ opacity: inView || !first ? 1 : 0, y: 0 }} transition={{ duration: first ? 0.7 : 0, ease: [0.16, 1, 0.3, 1] }} className="mt-1.5 text-kpi font-semibold tabular-nums text-ink">
        {k.display}
      </motion.p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-2xs text-text-muted">{k.hint ?? " "}</p>
        {k.spark && <Sparkline values={k.spark} />}
      </div>
    </>
  );
  const cls = cn("block rounded-lg border border-border bg-bg p-4 transition-[border-color,box-shadow] duration-150 hover:border-primary/50 hover:shadow-sm", className);
  return k.href ? <Link ref={ref} href={k.href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}
