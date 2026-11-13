import { stagger, type Transition, type Variants } from "motion/react";

/* The only place motion numbers live (kit §2.1). */
export const ease = {
  out: [0.23, 1, 0.32, 1],
  outExpo: [0.16, 1, 0.3, 1],
  inOut: [0.77, 0, 0.175, 1],
  drawer: [0.32, 0.72, 0, 1],
  in: [0.55, 0, 1, 0.45],
} as const;

export const dur = {
  instant: 0.1,
  fast: 0.16,
  base: 0.24,
  slow: 0.4,
  reveal: 0.7,
  hero: 1.1,
  count: 1.6,
  draw: 1.4,
} as const;

export const spring = {
  press: { type: "spring", visualDuration: 0.15, bounce: 0 },
  ui: { type: "spring", visualDuration: 0.3, bounce: 0.1 },
  card: { type: "spring", visualDuration: 0.5, bounce: 0.15 },
  gentle: { type: "spring", visualDuration: 0.8, bounce: 0 },
  toast: { type: "spring", visualDuration: 0.4, bounce: 0.12 },
} as const satisfies Record<string, Transition>;

export const follow = {
  tilt: { stiffness: 180, damping: 22, mass: 0.6 },
  magnet: { stiffness: 220, damping: 18, mass: 0.4 },
  spotlight: { stiffness: 300, damping: 40, mass: 0.5 },
  parallax: { stiffness: 90, damping: 30, mass: 1 },
  count: { stiffness: 60, damping: 20, mass: 1 },
} as const;

export const dist = { xs: "0.25em", sm: "0.5em", md: "1em", lg: "2em" } as const;
export const staggerStep = { tight: 0.03, words: 0.045, items: 0.07, cards: 0.1, rows: 0.035 } as const;
export const viewport = { once: true, amount: 0.35, margin: "0px 0px -10% 0px" } as const;

export const reveal: Variants = {
  hidden: { opacity: 0, y: dist.md },
  visible: { opacity: 1, y: 0, transition: { duration: dur.reveal, ease: ease.outExpo } },
};
export const revealReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: dur.base } },
};

export const staggerParent = (step: number = staggerStep.items, startDelay = 0): Variants => ({
  hidden: {},
  visible: { transition: { delayChildren: stagger(step, { startDelay }) } },
});

export const lineUp: Variants = {
  hidden: { y: "110%" },
  visible: { y: "0%", transition: { duration: dur.hero, ease: ease.outExpo } },
};

/* App chrome: fast, functional */
export const pageSwap: Variants = {
  hidden: { opacity: 0, y: dist.sm },
  visible: { opacity: 1, y: 0, transition: { duration: dur.slow, ease: ease.out } },
};
export const rowIn: Variants = {
  hidden: { opacity: 0, y: dist.xs },
  visible: { opacity: 1, y: 0, transition: { duration: dur.base, ease: ease.out } },
};
export const overlayFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: dur.base } },
  exit: { opacity: 0, transition: { duration: dur.fast } },
} as const;
export const popIn = {
  initial: { opacity: 0, y: dist.sm, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: dur.base, ease: ease.out } },
  exit: { opacity: 0, y: dist.xs, scale: 0.99, transition: { duration: dur.fast, ease: ease.in } },
} as const;
export const press = { whileTap: { scale: 0.97 }, transition: spring.press } as const;

/* Content swap (AnimatePresence, mode="wait") */
export const swap: Variants = {
  initial: { opacity: 0, y: dist.sm },
  animate: { opacity: 1, y: 0, transition: { duration: dur.slow, ease: ease.out } },
  exit: { opacity: 0, y: `-${dist.sm}`, transition: { duration: dur.fast, ease: ease.in } },
};
