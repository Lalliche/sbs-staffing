"use client";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dur, ease } from "@/lib/motion-tokens";

/** Progress ring (quota). Stroke is drawn via pathLength on first view only. */
export function ProgressRing({ value, size = "5em", stroke = 7, tone = "primary", children, label, className, delay = 0 }: { value: number; size?: string; stroke?: number; tone?: "primary" | "ok" | "alert" | "conflict"; children?: ReactNode; label: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const r = 50 - stroke / 2;
  const color = `var(--color-${tone})`;
  return (
    <div role="img" aria-label={label} className={cn("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-paper-deep)" strokeWidth={stroke} />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: reduce ? value : 0 }}
          animate={{ pathLength: Math.min(1, Math.max(0.001, value)) }}
          transition={{ duration: reduce ? 0 : dur.count * 0.8, ease: ease.outExpo, delay }}
        />
      </svg>
      <div className="relative text-center leading-none">{children}</div>
    </div>
  );
}
