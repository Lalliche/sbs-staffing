# Motion & 3D Playbook — Prototype Kit

Stack: Next.js (App Router) · React 19+ · Tailwind CSS v4 · `motion` (import from `motion/react`) · `.jsx` components · em sizing.

Motion is how a prototype says "premium, built with care, trustworthy." It is not decoration — every client-facing prototype built with this kit should feel like it was made by people who sweat details, because that feeling is a large part of what wins the pitch.

---

## 0. Baseline decisions for a new prototype

| Decision | Default |
|---|---|
| Card/object 3D | **Pure CSS 3D driven by motion values** (perspective + rotateX/Y + preserve-3d + sheen layer) wherever the hero object is flat (a card, a panel, a screen). No WebGL unless the brief specifically calls for a globe/true-3D object. |
| Globe | **cobe** (~5 KB, zero deps) if the brief needs a world/network visual. Lazy-loaded, mounted only near the viewport. |
| R3F / drei / Spline | **Not a default.** Only bring in true 3D (react-three-fiber) if the pitch genuinely needs it (physical object with lighting/shaders) — it's a real cost in bundle size and build time for a prototype. |
| Rolling-digit stats | `@number-flow/react`, or a motion-value count-up (§3.8) if you want zero extra dependency. |
| Smooth scroll (Lenis, etc.) | **No.** Native scroll, the way Linear, Vercel and Stripe do it. Scroll-jacking is the #1 "cheap template" tell. |

Pin exact versions in the client project's own `package.json` — check npm/the library's docs for the current stable release rather than assuming a version from memory.

---

## 1. Principles: premium motion vs AI-slop motion

**Premium motion is choreographed. Slop motion is sprinkled.**

1. **One hero moment per section.** Each section gets exactly one signature motion that carries meaning, plus 2–3 quiet micro-interactions. If everything moves, nothing matters.
2. **Motion explains something.** Every animation answers "where did this come from / where is it going / what changed." A good signature moment ties sections together — something introduced in the hero should recur with a reason, not as decoration.
3. **Physics over duration for anything the user touches.** Pointer-driven values (tilt, magnet, drag, spotlight lag) use springs because springs keep velocity when interrupted. Duration and easing are for things the user *watches* (reveals, draws).
4. **Enter fast, decelerate hard.** Strong ease-out (`[0.23, 1, 0.32, 1]`), short distances (0.5–1.5em, not 100px), small scale deltas (0.96→1, never 0→1). Nothing appears from nothing.
5. **Restraint in amplitude.** Tilt ≤ 12°, magnet pull ≤ 0.35× offset, bounce 0.1–0.25. Big amplitudes read as toy-like.
6. **Hierarchy through time.** Stagger shows reading order: eyebrow → headline (by line/word) → body → CTA → visual. 40–80 ms steps. The total section entrance stays under ~900 ms.
7. **Frequency decides animation.** Things seen once (hero, section reveals) can delight. Things used repeatedly (nav, FAQ toggles, buttons) must be near-instant (100–200 ms) or not animate at all. Never animate keyboard-initiated actions beyond focus feedback.
8. **Reveal once.** In-view reveals use `once: true`. Re-animating on scroll-up feels needy.
9. **Scroll-linked ≠ scroll-jacked.** Scroll *drives* progress (sticky storytelling, parallax) but never overrides the scroll itself.
10. **Light is the premium material.** The high-end feel on Linear, Vercel and Raycast comes from light (cursor spotlights, glow borders, sheen, soft noise), not from moving things around.
11. **Reduced motion is a design, not a kill switch.** Keep opacity and color changes. Remove translation, rotation, parallax and auto-play.
12. **Craft details compound.** Use `tabular-nums` on counters, hover gated behind `(hover:hover) and (pointer:fine)`, `scale(0.97)` on press, correct `transform-origin`, and masked edges on marquees.

**Slop tells to avoid:** everything fades up the same 40 px at the same 0.5 s; bouncy springs on text; `whileHover={{ scale: 1.05 }}` on every card; gradient blobs drifting without purpose; typewriter headlines; particles; a random 3D object unrelated to the product; cursor trails; scroll-jacking; count-ups that re-run every time.

---

## 2. Motion tokens

Put the tokens in one place. Components import tokens and variants and never inline magic numbers.

### 2.1 `src/lib/motion-tokens.js`

```js
// src/lib/motion-tokens.js
import { stagger } from "motion/react";

/* ---------- Easing (cubic-bezier arrays) ---------- */
export const ease = {
  out:        [0.23, 1, 0.32, 1],    // default UI enter (strong ease-out)
  outExpo:    [0.16, 1, 0.3, 1],     // hero/section reveals, count-ups
  inOut:      [0.77, 0, 0.175, 1],   // on-screen movement A→B, path draws
  drawer:     [0.32, 0.72, 0, 1],    // iOS-like sheets, deal/slide-in moments
  in:         [0.55, 0, 1, 0.45],    // exits only (short!)
  linear:     "linear",              // marquees, continuous rotation only
};

/* ---------- Durations (seconds) ---------- */
export const dur = {
  instant: 0.1,   // press feedback
  fast:    0.16,  // hover color/opacity, tooltips
  base:    0.24,  // dropdowns, FAQ, nav pill
  slow:    0.4,   // modal, tab swap, flip (tween fallback)
  reveal:  0.7,   // in-view section reveals
  hero:    1.1,   // hero headline / signature entrance
  count:   1.6,   // stat count-ups
  draw:    1.4,   // pathLength draws
};

/* ---------- Springs ---------- */
// For `transition` (animate/variants):
export const spring = {
  press:  { type: "spring", visualDuration: 0.15, bounce: 0 },     // tap feedback
  ui:     { type: "spring", visualDuration: 0.3,  bounce: 0.1 },   // layoutId pills, tabs
  card:   { type: "spring", visualDuration: 0.5,  bounce: 0.15 },  // flip / swap / deal-style moments
  gentle: { type: "spring", visualDuration: 0.8,  bounce: 0 },     // large surfaces, sheets
};
// For useSpring(motionValue, config): physical params (no `type`):
export const follow = {
  tilt:      { stiffness: 180, damping: 22, mass: 0.6 },  // 3D tilt: responsive, no wobble
  magnet:    { stiffness: 220, damping: 18, mass: 0.4 },  // magnetic buttons (slight overshoot)
  spotlight: { stiffness: 300, damping: 40, mass: 0.5 },  // cursor light lag
  parallax:  { stiffness: 90,  damping: 30, mass: 1 },    // scroll smoothing
  count:     { stiffness: 60,  damping: 20, mass: 1 },    // spring-driven numbers
};

/* ---------- Distances (em, relative to font-size) ---------- */
export const dist = { xs: "0.25em", sm: "0.5em", md: "1em", lg: "2em" };

/* ---------- Stagger ---------- */
export const staggerStep = { tight: 0.03, words: 0.045, items: 0.07, cards: 0.1 };

/* ---------- Viewport defaults for whileInView ---------- */
export const viewport = { once: true, amount: 0.35, margin: "0px 0px -10% 0px" };

/* ---------- Reusable variants ---------- */
export const reveal = {
  hidden:  { opacity: 0, y: dist.md, filter: "blur(0.25em)" },
  visible: { opacity: 1, y: 0, filter: "blur(0em)",
             transition: { duration: dur.reveal, ease: ease.outExpo } },
};
export const revealReduced = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: dur.base } },
};

export const staggerParent = (step = staggerStep.items, startDelay = 0) => ({
  hidden: {},
  visible: { transition: { delayChildren: stagger(step, { startDelay }) } },
});
export const staggerChild = reveal;

// Line-mask text reveal (child sits inside an overflow-hidden wrapper)
export const lineUp = {
  hidden:  { y: "110%" },
  visible: { y: "0%", transition: { duration: dur.hero, ease: ease.outExpo } },
};

// Content swap (AnimatePresence, mode="popLayout" or "wait")
export const swap = {
  initial: { opacity: 0, y: dist.sm, filter: "blur(0.2em)" },
  animate: { opacity: 1, y: 0, filter: "blur(0em)", transition: { duration: dur.slow, ease: ease.out } },
  exit:    { opacity: 0, y: `-${dist.sm}`, filter: "blur(0.2em)", transition: { duration: dur.fast, ease: ease.in } },
};

// Press feedback for any pressable
export const press = { whileTap: { scale: 0.97 }, transition: spring.press };
```

### 2.2 Mirror the curves in Tailwind v4 `@theme` (globals.css)
CSS transitions (hover color, focus rings, marquee) must use the same curves. These live in the `@theme inline` block of the project's design system (keep both in sync when a curve changes):
```css
@theme inline {
  --ease-out-strong: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-out-expo:   cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-strong: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer:     cubic-bezier(0.32, 0.72, 0, 1);
}
/* usage: transition-[opacity,transform] duration-200 ease-(--ease-out-strong) */
```

### 2.3 Conventions
- Components import `{ reveal, staggerParent, ease, spring, follow, viewport }` and never write `duration: 0.5` inline.
- Wrap the app once in `<MotionConfig reducedMotion="user">` (in a client `Providers.jsx`). This makes Motion drop transform/layout animations for reduced-motion users automatically. Components still branch with `useReducedMotion()` to swap in the *reduced design* (static poster instead of a globe, final numbers instead of count-ups).
- Hover-only effects are gated by a `useCanHover()` hook built on `useSyncExternalStore` (no setState-in-effect):

```js
// src/lib/use-media.js
"use client";
import { useSyncExternalStore } from "react";
export function useMedia(query, serverFallback = false) {
  return useSyncExternalStore(
    (cb) => { const m = matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => matchMedia(query).matches,
    () => serverFallback,
  );
}
export const useCanHover = () => useMedia("(hover: hover) and (pointer: fine)");
```

---

## 3. `motion/react` API cheatsheet

**Imports and what's current**
- `npm i motion` → `import { motion, AnimatePresence, ... } from "motion/react"`. (`framer-motion` is the legacy package name. Don't mix the two.)
- In Server Components, for a trivial animated element without `"use client"`, use `import * as motion from "motion/react-client"`. Everything interactive in a typical prototype lives in `"use client"` leaf components anyway.
- Bundle-trim option: `LazyMotion` + `m` from `motion/react-m` with `domAnimation` or `domMax` (adds layout/drag). Only worth it if the page ends up using few Motion features.
- Check the installed `motion` package's own changelog/docs for the current API surface before relying on memory of a specific version's features — this library ships fast and hooks get added/changed across versions.
- Springs: prefer `{ type: "spring", visualDuration, bounce }` for authored transitions (easy to sync with tweens). Use `stiffness/damping/mass` for `useSpring` followers.

### 3.1 In-view reveal + stagger
```jsx
"use client";
import { motion, useReducedMotion } from "motion/react";
import { reveal, revealReduced, staggerParent, viewport } from "@/lib/motion-tokens";

export default function FeatureList({ items }) {
  const reduce = useReducedMotion();
  const child = reduce ? revealReduced : reveal;
  return (
    <motion.ul variants={staggerParent()} initial="hidden" whileInView="visible" viewport={viewport}>
      {items.map((it) => (
        <motion.li key={it.id} variants={child}>{it.title}</motion.li>
      ))}
    </motion.ul>
  );
}
```
Imperative alternative: `const inView = useInView(ref, { once: true, amount: 0.4 })`, then act on it in an effect *without setState* (e.g. `animate(...)`).

### 3.2 Scroll-linked (offsets)
```jsx
const ref = useRef(null);
const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
// "target-edge container-edge": starts when section top hits viewport bottom, ends when section bottom hits viewport top
const y = useTransform(scrollYProgress, [0, 1], ["2em", "-2em"]);
const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [18, 0, -8]);
const smoothY = useSpring(y, follow.parallax); // optional smoothing
return <motion.div ref={ref} style={{ y: smoothY, rotateX }} />;
```
Offsets accept names (`start|center|end`), numbers 0–1, `px`, `%`, `vh/vw`. If you keep to opacity/transform/clipPath/filter *without* a `useSpring` in between, Motion can hand the animation to the native ScrollTimeline, which keeps it off the main thread.

### 3.3 AnimatePresence (swap)
```jsx
<AnimatePresence mode="popLayout" initial={false}>
  <motion.p key={active.id} variants={swap} initial="initial" animate="animate" exit="exit">
    {active.copy}
  </motion.p>
</AnimatePresence>
```
Use `mode="wait"` when old and new content must not overlap (headlines). `popLayout` pairs with `layout` siblings.

### 3.4 Shared element: `layoutId` + `LayoutGroup`
```jsx
<LayoutGroup id="nav">
  {links.map((l) => (
    <a key={l.href} onPointerEnter={() => setHover(l.href)} className="relative px-[0.75em] py-[0.4em]">
      {hover === l.href && (
        <motion.span layoutId="nav-pill" transition={spring.ui}
          className="absolute inset-0 -z-10 rounded-full bg-white/8" />
      )}
      {l.label}
    </a>
  ))}
</LayoutGroup>
```
Layout animations are FLIP, meaning transform-based, so they stay inside our rules. Use `layout="position"` on siblings that should only move (not scale), and `layout="y"` for vertical-only moves.

### 3.5 Cursor-follow spotlight / glow border
```jsx
"use client";
import { motion, useMotionValue, useMotionTemplate, useReducedMotion } from "motion/react";

export default function SpotlightCard({ children }) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(-1000), my = useMotionValue(-1000);
  const rect = useRef(null);
  const light  = useMotionTemplate`radial-gradient(22em circle at ${mx}px ${my}px, rgb(255 255 255 / 0.07), transparent 60%)`;
  const border = useMotionTemplate`radial-gradient(14em circle at ${mx}px ${my}px, rgb(160 200 255 / 0.55), transparent 60%)`;
  return (
    <div
      className="group relative rounded-[1.25em] p-px"
      onPointerEnter={(e) => { rect.current = e.currentTarget.getBoundingClientRect(); }}
      onPointerMove={(e) => { if (reduce || !rect.current) return;
        mx.set(e.clientX - rect.current.left); my.set(e.clientY - rect.current.top); }}
    >
      {/* 1px glow border: gradient on the wrapper, solid card on top */}
      <motion.div aria-hidden className="absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: border }} />
      <div className="relative rounded-[inherit] bg-neutral-950 p-[1.5em]">
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: light }} />
        {children}
      </div>
    </div>
  );
}
```
Cache the rect on `pointerenter` (and on scroll/resize if the element can move under a still pointer). Never call `getBoundingClientRect` in a render loop. The gradient repaint is limited to the card, which is cheap. Grid-wide variant (Linear/Vercel bento): put **one** listener on the grid and write `--mx/--my` per card from a single rect read.

### 3.6 3D tilt card (springs + sheen)
```jsx
"use client";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate, useReducedMotion } from "motion/react";
import { follow } from "@/lib/motion-tokens";

export default function TiltCard({ front, maxTilt = 10 }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5), py = useMotionValue(0.5); // 0..1 pointer position
  const rotateX = useSpring(useTransform(py, [0, 1], [maxTilt, -maxTilt]), follow.tilt);
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxTilt, maxTilt]), follow.tilt);
  // sheen: translate an oversized gradient layer (compositor-only) instead of animating background-position
  const sheenX = useTransform(px, [0, 1], ["-30%", "30%"]);
  const sheenY = useTransform(py, [0, 1], ["-30%", "30%"]);
  const glare  = useTransform(px, [0, 0.5, 1], [0.35, 0.12, 0.35]);

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width); py.set((e.clientY - r.top) / r.height);
  }
  function reset() { px.set(0.5); py.set(0.5); }

  return (
    <div style={{ perspective: "70em" }} onPointerMove={reduce ? undefined : onMove} onPointerLeave={reset}>
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative overflow-hidden rounded-[1em] shadow-2xl"
      >
        {front}
        <motion.div aria-hidden
          style={{ x: sheenX, y: sheenY, opacity: glare }}
          className="pointer-events-none absolute -inset-1/2 mix-blend-color-dodge
                     bg-[linear-gradient(115deg,transparent_35%,rgb(255_255_255/.6)_48%,rgb(180_220_255/.4)_52%,transparent_65%)]" />
      </motion.div>
    </div>
  );
}
```
If the tilted object is a real-world object with a known aspect ratio (a card, a phone, a book), use that exact ratio — it reads as intentional rather than arbitrary. Parallax depth inside the object: children with `style={{ transform: "translateZ(2em)" }}` under `preserve-3d`.

### 3.7 Magnetic button
```jsx
const ref = useRef(null);
const x = useSpring(0, follow.magnet), y = useSpring(0, follow.magnet);
function onMove(e) {
  const r = ref.current.getBoundingClientRect();
  x.set((e.clientX - (r.left + r.width / 2)) * 0.3);
  y.set((e.clientY - (r.top + r.height / 2)) * 0.3);
}
return (
  <motion.a ref={ref} href="#contact" style={{ x, y }}
    onPointerMove={canHover && !reduce ? onMove : undefined}
    onPointerLeave={() => { x.set(0); y.set(0); }}
    whileTap={{ scale: 0.97 }}>
    <motion.span style={{ x: useTransform(x, (v) => v * 0.4), y: useTransform(y, (v) => v * 0.4) }}>Contact sales</motion.span>
  </motion.a>
);
```
The label moves *more* than the pill (0.4 extra), which creates the parallax that sells it. Keep the hit area static by putting the listener on a padded wrapper (`p-[1em] -m-[1em]`) so the button doesn't run away from the pointer.

### 3.8 Count-up (motion value, no re-render per frame)
```jsx
"use client";
import { animate, motion, useInView, useMotionValue, useTransform, useReducedMotion } from "motion/react";

export default function CountUp({ to, prefix = "", suffix = "", format = (v) => Math.round(v).toString() }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${prefix}${format(v)}${suffix}`);
  useEffect(() => {
    if (!inView) return;
    if (reduce) { mv.set(to); return; }
    const c = animate(mv, to, { duration: dur.count, ease: ease.outExpo });
    return () => c.stop();
  }, [inView, reduce, to, mv]);
  return (
    <span ref={ref} className="tabular-nums">
      <span className="sr-only">{`${prefix}${format(to)}${suffix}`}</span>
      <motion.span aria-hidden>{text}</motion.span>
    </span>
  );
}
```
This sets a motion value inside an effect, which is fine: it is not React state. For odometer-style rolling digits, `@number-flow/react`'s `<NumberFlow value={…} />` handles formatting and respects reduced motion out of the box.

### 3.9 Text split reveal (words, masked lines)
```jsx
function SplitReveal({ text, as: Tag = "h2", className }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const MotionTag = motion[Tag];
  return (
    <MotionTag aria-label={text} className={className}
      variants={staggerParent(staggerStep.words)} initial="hidden" whileInView="visible" viewport={viewport}>
      {words.map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.1em] align-bottom">
          <motion.span className="inline-block" variants={reduce ? revealReduced : lineUp}>
            {w}{i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </MotionTag>
  );
}
```
Split by **word** (or line), not letter, for headlines longer than ~3 words. Letters are only for tiny display words.

### 3.10 SVG path draw (`pathLength`)
```jsx
<motion.path d={d} fill="none" stroke="currentColor" strokeWidth={1.5}
  initial={{ pathLength: 0, opacity: 0 }}
  whileInView={{ pathLength: 1, opacity: 1 }} viewport={viewport}
  transition={{ pathLength: { duration: dur.draw, ease: ease.inOut }, opacity: { duration: 0.2 } }} />
// scroll-linked: style={{ pathLength: scrollYProgress }}
```
To get a traveling "beam", animate `pathOffset` or a gradient `<linearGradient>` whose `x1/x2` are motion values, with the path stroked by the gradient.

### 3.11 Sticky scroll storytelling
```jsx
const ref = useRef(null);
const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
const [step, setStep] = useState(0);
const stepRef = useRef(0);
useMotionValueEvent(scrollYProgress, "change", (v) => {        // event callback, not an effect: setState is fine
  const i = Math.min(STEPS - 1, Math.floor(v * STEPS));
  if (i !== stepRef.current) { stepRef.current = i; setStep(i); } // only re-render on step change
});
return (
  <section ref={ref} className="relative" style={{ height: `${STEPS * 100}svh` }}>
    <div className="sticky top-0 flex h-svh items-center">
      {/* continuous visuals read scrollYProgress directly via useTransform; discrete copy swaps on `step` */}
    </div>
  </section>
);
```
Use continuous values (`useTransform`) for the visual and discrete `step` for the copy (with AnimatePresence). Add a progress rail: `<motion.div style={{ scaleY: scrollYProgress, transformOrigin: "top" }} />`.

### 3.12 Infinite marquee
Cheapest (default), pure CSS on the compositor:
```css
@keyframes marquee { to { transform: translate3d(-50%,0,0); } }
.marquee-track { display:flex; width:max-content; animation: marquee 40s linear infinite; }
.marquee:hover .marquee-track { animation-play-state: paused; }
.marquee { mask-image: linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); }
@media (prefers-reduced-motion: reduce) { .marquee-track { animation: none; } }
```
Render the list twice (second copy `aria-hidden`). A scroll-velocity-reactive version is possible with `useVelocity` + `useAnimationFrame`, but reach for it only when the brief wants that level of polish — the plain CSS marquee is the right default for most logo/partner strips.

### 3.13 Drag (mobile swipe deck/carousel)
```jsx
<motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7}
  onDragEnd={(_, info) => {
    if (info.offset.x < -80 || info.velocity.x < -500) next();
    else if (info.offset.x > 80 || info.velocity.x > 500) prev();
  }}
  whileDrag={{ scale: 0.98, rotate: 0 }} style={{ rotate: useTransform(x, [-200, 200], [-8, 8]) }} />
```

### 3.14 `useAnimate` sequences (orchestrated intro)
```jsx
const [scope, animate] = useAnimate();
useEffect(() => {
  if (reduce) return;
  const controls = animate([
    [".intro-item", { y: ["30%", "0%"], rotateX: [40, 0], opacity: [0, 1] }, { duration: 0.9, ease: ease.outExpo, delay: stagger(0.08) }],
    [".intro-cta",  { opacity: [0, 1], y: ["0.5em", 0] }, { at: "-0.4", duration: 0.5, ease: ease.out }],
  ]);
  return () => controls.stop();
}, [reduce]);
```

---

## 4. Planning a section's motion — method, not a template

Don't reuse a fixed library of "hero concepts" across clients — that's exactly how a prototype ends up looking like every other AI-built landing page. Instead, for **each** project, work out:

1. **What is the hero object?** Every credible product has one real thing the whole page should orbit — a physical object, a screen/dashboard view, a document, a map, a specific data visualization. Identify it from the client brief before writing any motion code. If nothing obvious qualifies, the hero moment can be typographic/compositional instead (a bold headline reveal, a architectural layout shift) rather than forcing an invented object.
2. **What is the one signature moment per section?** For each section, ask: what does this section need the visitor to *feel* or *understand* in the first two seconds? Design one moment that delivers that, and keep everything else in the section quiet. Use the categories below as a toolbox, not a checklist to complete:
   - **Entrance**: how content first appears (masked line reveals, staggered items, an orchestrated `useAnimate` sequence for a hero).
   - **Continuity**: whether an element from one section visually becomes or informs an element in the next (the single strongest way to make a page feel designed rather than assembled).
   - **Response**: what happens when the visitor's cursor/scroll/touch moves (tilt, spotlight, parallax, scroll-driven storytelling).
   - **State change**: how switching between tabs/steps/items is animated (flip, swap, shared-element `layoutId` transitions).
3. **What is intentionally still?** Decide which sections get *no* flagship motion at all (proof/stats rows, FAQ, footer) — restraint in most places is what makes the signature moments read as intentional rather than default.
4. **3D or not** — check §5's decision matrix before reaching for anything beyond CSS 3D.
5. **Write the plan down** (even briefly, in the project's own motion-plan doc if one exists) before building: hero object, each section's signature moment, which sections stay quiet, and the reduced-motion design for each flagship moment. This is cheap to do up front and expensive to retrofit.

For every flagship section, work out the following (borrowed structure — fill in per-project, don't copy a previous project's answers):

- **Sig** — the one signature moment.
- **Micro** — 2–3 supporting micro-interactions, no more.
- **Tech** — which hooks/APIs from §3 this needs.
- **3D** — none, CSS 3D, or WebGL (and why).
- **Touch** — what changes for touch-only devices (pointer-driven effects need a real fallback, not just "disabled").
- **RM** — the reduced-motion *design* (not just "animations off" — what does this section look like calm?).
- **Perf** — what's lazy-loaded, what's eager, what's capped on mobile.

### Default section→intensity map for a typical marketing/landing prototype

| Section | Typical motion intensity |
|---|---|
| Navbar | Micro only (hide-on-scroll, active-link indicator, progress line) |
| Hero | Flagship — this is where the signature moment usually lives |
| Stats/proof | Count-ups, otherwise quiet |
| Core feature/product showcase | Often a second flagship moment, built around the hero object continuing its story |
| Secondary features (bento/grid) | Small per-tile reveals and micro-interactions, no flagship moment |
| How it works / process | Often a third flagship moment if the process itself is visually interesting (a scroll-driven journey) |
| Map/network/global-reach visual | Candidate for the one WebGL use, if the brief has a genuine geographic/network story |
| Testimonials / use cases / tabs | Shared-element tab transitions, otherwise calm |
| Partners/logos | Marquee, otherwise static |
| FAQ | Deliberately calm and fast — this gets clicked repeatedly |
| Final CTA | Often reprises the hero's signature moment as a closing beat |
| Footer | Minimal — at most one subtle reveal |

A back-office / app-style prototype (not a marketing landing page) should be far quieter throughout: functional transitions (page/tab swaps, list reveals, toasts), no flagship 3D moments, motion durations at the fast end of the token scale. Save ambition for the public-facing pages.

---

## 5. 3D decision matrix

| Criterion | CSS 3D + motion values | cobe (globe) | react-three-fiber + drei | No-code 3D tools (e.g. Spline) |
|---|---|---|---|---|
| Added JS (gz, approx.) | **0 KB** (motion already loaded) | **~5 KB** | three + r3f + drei parts (tree-shaken), can be 150–250 KB | runtime overhead plus a scene file, often 0.5 MB+ |
| Best for | Flat/card-like objects: tilt, flip, fan, stack, sheen, parallax depth | A globe with markers and arcs | True 3D: a physical object with thickness, lighting, physics, custom shaders | Designer-authored scenes |
| Look quality for flat objects | Excellent (text stays DOM-crisp) | n/a | Excellent but needs texture work, text is rasterized | Good |
| Mobile perf | Excellent | Very good (tune DPR / samples) | OK on mid-range phones with care (DPR cap, demand-driven frameloop) | Often poor (heavy, GPU-bound) |
| Accessibility | Native: real DOM, focusable, readable | Canvas (provide HTML fallback) | Canvas (needs HTML mirror) | Canvas (opaque) |
| SSR compatibility | Works in client components, SSR renders static pose | `ssr:false` dynamic import | `ssr:false` dynamic import | `ssr:false` dynamic import |
| Control / brand fit | Full | Good | Full | Limited, often a black box |
| Cost to build | Low–medium | Low | High | Medium (design) + high perf cost |

**Default per-section leaning**
| Section type | 3D |
|---|---|
| Hero (flat object) | CSS 3D |
| Stats/proof | none |
| Feature showcase with a flippable/switchable object | CSS 3D double-sided flip |
| Secondary feature grid | none (SVG illustration) |
| Process/journey | small CSS 3D flip, if any |
| Geographic/network visual | cobe |
| Tabs/use-cases | CSS 3D shuffle, if the object supports it |
| Partners, FAQ, footer | none |
| Final CTA | reuse whatever CSS 3D object the hero used |

Before adding `react-three-fiber`/`drei`/any heavier 3D library, confirm current peer-dependency compatibility with the project's installed React/Next versions — these libraries' React version support windows move with each release. A no-code 3D tool is rarely the right call for a lightweight landing page whose hero object is simple — it adds weight without adding brand fit or accessibility.

---

## 6. Performance & accessibility rules

**Rendering**
1. Animate only `transform` (x, y, scale, rotate*, z) and `opacity`. Use `filter`/`clip-path` sparingly (short reveals, small areas). Never animate width/height/top/left/margin/padding/`background-position`/`box-shadow`. Fake shadows with a pre-blurred element whose opacity/scale animate.
2. **Motion values over state.** Pointer, scroll and per-frame values live in `useMotionValue`/`useTransform`/`useSpring` and never in `useState`. React re-renders only on discrete changes (step index, tab).
3. **`will-change` discipline:** don't set it in CSS globally. Motion applies it while animating. Add `will-change: transform` manually only to long-lived pointer-driven layers and only on desktop. Too many promoted layers eat GPU memory on phones.
4. **No layout thrash:** read rects on `pointerenter` / `ResizeObserver`, write only motion values. Never interleave `getBoundingClientRect` with style writes in a loop.
5. **Scroll-linked animation:** prefer `useScroll` + `useTransform` into opacity/transform/clipPath/filter with no spring in between (eligible for native ScrollTimeline acceleration). Add `useSpring` smoothing only where it's visibly needed.
6. **Pause what's off-screen:** every loop (ambient motion, marquee rAF, word swaps, globe, beams) is gated by `useInView(ref)` (not `once`) and a page-visibility check. CSS loops toggle `animation-play-state` via a `data-inview` attribute set from an IntersectionObserver callback.
7. **Lazy-load heavy stuff:** a globe, a scroll-driven journey section, and anything below the fold that pulls in extra libs go through `next/dynamic` from a client component (`ssr: false` is not allowed in Server Components). Mount only when near the viewport (`margin: "400px"`). Reserve dimensions to avoid CLS.
8. **LCP:** the hero headline is usually the LCP element. It should be SSR-visible and revealed with a CSS keyframe that runs at first paint (not after hydration). Hero images use `next/image` with only the top/first image eager.
9. **Budget:** keep motion-related JS lean on the initial route — Motion itself is a modest cost, but a globe or 3D library should be lazy. Target 60 fps on a mid-range Android phone: test with 4× CPU throttling.
10. **Mobile:** disable pointer-driven effects (`useCanHover()`), cap DPR for canvas, reduce blur radii, use fewer simultaneous 3D layers than desktop, and use `svh` units for sticky stages (iOS URL bar).

**Accessibility**
1. Wrap the app in `<MotionConfig reducedMotion="user">` **and** branch with `useReducedMotion()` per component to render a designed reduced variant. `useReducedMotion()` returns `null` on the server, so treat null as "motion allowed" for SSR markup that is static anyway.
2. Reduced motion keeps opacity/color transitions, removes translation, rotation, parallax, autoplay, marquee and globe spin, and shows final values.
3. Interactive 3D (tilt/flip objects) must be real `<button>`/`<a>` elements or have `tabIndex=0` and a role. On `:focus-visible`, lift the object (`z`/scale) and show a visible ring outside the 3D transform. Flip interactions use `aria-pressed` or a clearly labeled "Show details." Enter/Space triggers the flip.
4. Split text: `aria-label` holds the full string on the container, and pieces are `aria-hidden`.
5. Canvas/WebGL is `aria-hidden` with an equivalent HTML list. Drag-to-rotate has keyboard arrow alternatives or is purely decorative.
6. Auto-advancing content (tabs, word swaps, marquees) must pause on hover/focus and have a pause control if it runs more than 5 s (WCAG 2.2.2).
7. Never trap scroll. Sticky sections are plain tall sections with native scrolling, and anchor links/keyboard `PageDown` must work normally.
8. Focus order follows the visual order even when elements are visually re-stacked in 3D.

**React 19 / modern Next rules**
- No synchronous `setState` in `useEffect`. Use motion values, event callbacks (`useMotionValueEvent`, IntersectionObserver callbacks), `useSyncExternalStore` for media queries, or derive during render.
- Effects that start animations must return cleanup (`controls.stop()`, `globe.destroy()`).
- Keep `"use client"` at leaf components. Sections stay Server Components that render client islands.

---

## 7. Anti-patterns

1. Same fade-up-40px-0.5s on every element.
2. `whileHover={{ scale: 1.05 }}` on every card, or scaling text containers (blurry text, layout jitter feel).
3. Bouncy springs (`bounce > 0.3`) on UI or text. Wobbly tilt (`damping` too low).
4. Letter-by-letter reveals on long headlines. Typewriter effects.
5. Scroll-jacking / smooth-scroll libraries that fight native scroll. Snapping full-page sections.
6. Re-triggering reveals on every scroll pass (`once: false` for entrance animations).
7. Animating layout properties (`height`, `width`, `top`, `background-position`, `box-shadow`) or animating `backdrop-filter`/`filter: blur()` radius on large areas.
8. `useState` for pointer/scroll values, or re-rendering on every frame.
9. `getBoundingClientRect` inside rAF or `pointermove` on many elements.
10. Loops that keep running off-screen or in background tabs.
11. WebGL in the LCP path, or a 3D object unrelated to the product.
12. Hover-only information (touch users never see it). Hover effects on touch devices (sticky hover on tap).
13. Hiding the LCP headline with `opacity: 0` until hydration.
14. Parallax on body text. Large rotation (>15°) on anything readable.
15. Particles, cursor trails, confetti, custom cursors that replace the system cursor.
16. Ignoring reduced motion, or implementing it as "nothing renders."
17. Inlining magic numbers instead of using `motion-tokens.js`.
18. Mixing `framer-motion` and `motion` imports. Importing from `motion` (vanilla) inside React components when `motion/react` exports the hook.
19. Autoplay carousels without pause.
20. Glow and gradient everywhere. Light is premium only when it's scarce and responds to the user.
21. Reusing the exact same "hero concept" (the same object, the same deal-in animation) across different clients — every project needs its own answer to §4's questions, not a copy-pasted concept from a previous pitch.

---

## 8. Resources

**Motion (official)**
- Docs home: https://motion.dev/docs/react (API reference; check the "React" section for each hook)
- `useScroll`: https://motion.dev/docs/react-use-scroll · Transitions/springs/stagger: https://motion.dev/docs/react-transitions · Layout: https://motion.dev/docs/react-layout-animations
- **llms.txt** (index of every docs page, feed it to agents): https://motion.dev/llms.txt
- **Motion AI Kit** (`/motion` skill + MCP for agentic coding tools): https://motion.dev/docs/ai-kit · install: https://motion.dev/docs/ai-kit-install · repo: https://github.com/motiondivision/ai-kit
- Examples gallery: https://motion.dev/examples — tilt, velocity marquee, text split, scroll-linked and layout examples are all good references.
- Changelog: https://github.com/motiondivision/motion/blob/main/CHANGELOG.md

**Craft & principles**
- Emil Kowalski's skills repo (`emil-design-eng` plus `animate`, `review-animations`, `improve-animations`, `find-animation-opportunities`): https://github.com/emilkowalski/skills · overview: https://emilkowal.ski/skill. Take the easing curves, the duration table, "never animate keyboard actions," and the frequency rule.
- animations.dev (Emil's course): https://animations.dev. Covers springs vs easing, `clip-path` tricks, and gesture feel.
- Rauno Freiberg, "Invisible Details of Interaction Design": https://rauno.me/craft/interaction-design. Also https://rauno.me/craft
- Josh W. Comeau, springs and CSS transitions: https://www.joshwcomeau.com/animation/a-friendly-introduction-to-spring-physics/ · https://www.joshwcomeau.com/animation/css-transitions/
- Maxime Heckel, spring physics and scroll/3D articles: https://blog.maximeheckel.com
- web.dev, high-performance animations: https://web.dev/articles/animations-guide
- Linear's redesign write-up (light, restraint, detail): https://linear.app/now/how-we-redesigned-the-linear-ui
- GitHub globe build notes: https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/

**Component pattern libraries (copy the idea, re-tune to the project's own tokens — never ship their defaults unchanged)**
- Aceternity UI: https://ui.aceternity.com. Spotlight card, 3D card effect, background beams, sticky scroll reveal, glowing border. Their defaults are often over-animated — cut the amplitudes.
- Magic UI: https://magicui.design. Marquee, number ticker, border beam, shine border, globe (cobe), animated grid pattern.
- NumberFlow (odometer digits): https://number-flow.barvian.me

**3D**
- cobe: https://github.com/shuding/cobe (`createGlobe(canvas, opts)`, `onRender(state)`, `markers`/`arcs` with `id` for CSS anchor labels, `destroy()`)
- React Three Fiber: https://r3f.docs.pmnd.rs · drei: https://drei.docs.pmnd.rs
- Easing tools: https://cubic-bezier.com · https://easings.net

---

## Appendix: file layout

`nextjs-architecture.md` is the authority on file locations. Motion-relevant paths:

```
src/lib/motion-tokens.js                 // §2.1 — the only place motion numbers live
src/lib/use-media.js                     // useMedia / useCanHover (useSyncExternalStore)
src/components/motion/                   // SplitReveal, Reveal, SpotlightCard, TiltCard, MagneticButton,
                                         //   CountUp, Marquee, BorderBeam, PathDraw
src/components/landing/<Section>/        // index.jsx (server) + <Section>Client.jsx (motion)
src/components/providers/MotionProvider.jsx  // "use client"; <MotionConfig reducedMotion="user">
```
