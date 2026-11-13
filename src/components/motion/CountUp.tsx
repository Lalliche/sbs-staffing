"use client";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { dur, ease } from "@/lib/motion-tokens";

export function CountUp({ to, decimals = 0, prefix = "", suffix = "", className, duration = dur.count, delay = 0 }: { to: number; decimals?: number; prefix?: string; suffix?: string; className?: string; duration?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const fmt = (v: number) => `${prefix}${v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  const text = useTransform(mv, fmt);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.set(to);
      return;
    }
    const c = animate(mv, to, { duration, delay, ease: ease.outExpo });
    return () => c.stop();
  }, [inView, reduce, to, mv, duration, delay]);
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{fmt(to)}</span>
      <motion.span aria-hidden>{text}</motion.span>
    </span>
  );
}
