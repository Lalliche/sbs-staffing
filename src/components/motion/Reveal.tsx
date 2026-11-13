"use client";
import { motion, useReducedMotion } from "motion/react";
import type { ElementType, ReactNode } from "react";
import { reveal, revealReduced, staggerParent, staggerStep, viewport } from "@/lib/motion-tokens";

/** In-view fade/rise. `once` per the kit — never re-animates on scroll-up. */
export function Reveal({ children, className, delay = 0, as = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "li" | "p" | "span" | "section" }) {
  const reduce = useReducedMotion();
  const M = motion[as] as ElementType;
  const v = reduce ? revealReduced : reveal;
  return (
    <M className={className} variants={v} initial="hidden" whileInView="visible" viewport={viewport} transition={delay ? { delay } : undefined}>
      {children}
    </M>
  );
}

export function RevealGroup({ children, className, step = staggerStep.items, as = "div" }: { children: ReactNode; className?: string; step?: number; as?: "div" | "ul" | "ol" }) {
  const M = motion[as] as ElementType;
  return (
    <M className={className} variants={staggerParent(step)} initial="hidden" whileInView="visible" viewport={viewport}>
      {children}
    </M>
  );
}
export function RevealItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" }) {
  const reduce = useReducedMotion();
  const M = motion[as] as ElementType;
  return (
    <M className={className} variants={reduce ? revealReduced : reveal}>
      {children}
    </M>
  );
}
