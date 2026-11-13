"use client";
import { motion, useReducedMotion } from "motion/react";

/* « Papier réglé »: a fine 4 em drafting grid in ink at 6 % (1.13:1 against the paper — it can never read as content),
   masked so the paper stays clean behind the cards and the ruling only shows at the margins. One 500 ms opacity fade;
   none under reduced motion. Decorative: aria-hidden, no pointer events. See docs/research-raw/E-login-background.md. */
const line = "rgb(15 26 46 / 0.06)";
const fade = "radial-gradient(ellipse 80% 75% at 50% 55%, transparent 35%, #000 100%)";

export function LoginBackdrop() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      style={{
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: "4em 4em",
        WebkitMaskImage: fade,
        maskImage: fade,
      }}
    />
  );
}
