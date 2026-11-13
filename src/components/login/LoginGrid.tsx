"use client";
import { motion, useReducedMotion } from "motion/react";
import { ease } from "@/lib/motion-tokens";

/* Signature moment: « the grid assembles » (docs/motion-plan.md). Decorative, aria-hidden, never blocks input. */
const ROWS = 6;
const COLS = 12;
// [row, startCol, span, department colour token]
const BLOCKS: [number, number, number, string][] = [
  [0, 0, 4, "aud"], [0, 5, 5, "aud"], [1, 1, 3, "ec"], [1, 4, 6, "cjf"], [2, 0, 5, "sc"], [2, 6, 4, "aud"],
  [3, 2, 4, "trx"], [3, 7, 4, "ec"], [4, 0, 3, "cjf"], [4, 4, 5, "aud"], [5, 3, 4, "sc"], [5, 8, 3, "trx"],
];

export function LoginGrid() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.svg initial={{ opacity: reduce ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.3, delay: 0.08 }} viewBox={`0 0 ${COLS * 100} ${ROWS * 100}`} preserveAspectRatio="none" className="absolute inset-0 size-full opacity-60">
        {Array.from({ length: COLS + 1 }, (_, i) => <line key={`v${i}`} x1={i * 100} x2={i * 100} y1={0} y2={ROWS * 100} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {Array.from({ length: ROWS + 1 }, (_, i) => <line key={`h${i}`} x1={0} x2={COLS * 100} y1={i * 100} y2={i * 100} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
      </motion.svg>
      {BLOCKS.map(([r, c, span, dept], i) => (
        <motion.div
          key={i}
          initial={reduce ? { opacity: 1 } : { opacity: 0, x: "-1.5em" }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduce ? 0 : 0.42, ease: ease.outExpo, delay: reduce ? 0 : 0.16 + r * 0.06 + (c > 4 ? 0.025 : 0) }}
          className="absolute rounded-lg border opacity-80"
          style={{
            top: `calc(${(r / ROWS) * 100}% + 0.55em)`, height: `calc(${100 / ROWS}% - 1.1em)`, left: `calc(${(c / COLS) * 100}% + 0.3em)`, width: `calc(${(span / COLS) * 100}% - 0.6em)`,
            background: `color-mix(in srgb, var(--color-dept-${dept}) 14%, white)`, borderColor: `var(--color-dept-${dept})`,
          }}
        />
      ))}
    </div>
  );
}
