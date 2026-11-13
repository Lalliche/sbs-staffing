# E — Login / persona-entry background (research + spec)

Sources actually read: WCAG 2.2 *Understanding 1.4.11 Non-text Contrast* and *2.2.2 Pause, Stop, Hide* (w3.org). Web searches on enterprise login backgrounds returned mostly design-prompt libraries (Superdesign, SaaSFrame, Aceternity: "faint masked engineering grid, hairline slate borders", "form is the hero, background is quiet texture", `pointer-events-none` on decorative layers) and general cognitive-load papers (visual noise = extraneous load; too-intense visuals overload, too-faint ones lose communication). No study of background patterns per se was found; the "calm vs busy" rules below are **my judgement (guess)**, backed by the measurements. The three options were rendered in headless Chrome at 1440x800 and checked visually.

## 1. Diagnosis of the current background
- **Scale and edge sharpness.** 12 blocks up to ~half the viewport wide and ~200 px tall, each with a 1 px full-chroma department border (`#1b3358`, `#7c5ca3`, `#a38f55`, `#a8708a`). They are bigger than the cards (~85 px) and have the sharpest edges on the page, so they win the figure/ground fight.
- **Five hues.** Fills are pastel (14 % tint, contrast vs canvas only 1.07–1.15) but the borders add blue, violet, ochre, rose and slate. That is the data palette, and it clashes with the Prussian/paper identity zone.
- **No relation to the content.** Cards and the form straddle block edges (white card vs block = 1.30:1, and the demo note is printed inside a block). Random placement also reads as meaningful data (conflicts? allocations?) in a staffing tool.
- **Motion across the whole viewport.** 12 large blocks slide in on a stagger, then the cards stagger too. That is two competing entrances, and the second one is the only one that matters.
- **Residual layering.** A grid (`line` at 60 % opacity) under blocks at 80 % opacity under a `bg-bg/90 backdrop-blur` panel. Three semi-transparent layers make the tone muddy instead of crisp.

## Measured contrast (node script, WCAG relative luminance)
| Pair | Ratio |
|---|---|
| ink `#0f1424` on white card / on canvas | 18.33 / 16.23 |
| text-secondary on white / canvas | 8.88 / 7.86 |
| text-muted on white / canvas (demo note) | 5.92 / 5.24 |
| text-muted on vignette edge `#efede5` | 5.05 |
| white card vs canvas, no border | **1.13** |
| card border `#dedad0` vs canvas / vs white | 1.24 / 1.40 |
| card shadow zone `#dcdbd7` vs white card | 1.39 |
| hairline ink 4 / 6 / 8 % over canvas | 1.08 / 1.13 / 1.17 |
| grain 4 % peak vs canvas | 1.08 |
| dark panel `side` vs canvas | 15.40 |
| side-text / side-muted on `side` | 14.56 / 7.08 |
| light hairline (slate 10 %) on `side` | 1.18 |

Reading: all text passes AA (≥ 5.0:1) on every surface. Cards are identified by their text, so SC 1.4.11 does not require a 3:1 boundary (W3C: a boundary is needed only when there is no other visual identification); the border + `shadow-sm` is for aesthetics (1.24–1.40). Background texture must stay ≤ 1.17 against the canvas so it never reads as content.

Shared rules: cards are **solid** `bg-bg border border-border shadow-sm hover:shadow-md` (no `/90`, no blur). Title and lead sit directly on the paper (no white panel). The lockup stays a `bg-side rounded-lg` chip (15.4:1 on canvas) with `shadow-sm`. Backdrop is `aria-hidden pointer-events-none`. The entrance is opacity only, 500 ms, skipped under reduced motion (the animation also ends well under WCAG 2.2.2's 5 s).

## 2. Options

### A. « Papier réglé » — fine drafting grid fading toward the content
Hairline 4 em grid in ink at 6 % opacity, masked by a radial so the paper is clean behind the cards and ruling appears only at the margins. It echoes the planning grid and « Trame » without any colour. Mood: architect's sheet, quiet, precise.
```tsx
"use client";
import { motion, useReducedMotion } from "motion/react";

const line = "rgb(15 26 46 / 0.06)";
const fade = "radial-gradient(ellipse 80% 75% at 50% 55%, transparent 35%, #000 100%)";

export function LoginBackdrop() {
  const reduce = useReducedMotion();
  return (
    <motion.div aria-hidden className="pointer-events-none absolute inset-0 bg-canvas"
      initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      style={{
        backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
        backgroundSize: "4em 4em", WebkitMaskImage: fade, maskImage: fade,
      }} />
  );
}
```
Note the mask also fades `bg-canvas` on this layer, which is invisible because `<main>` is already `bg-canvas`. Replace `<LoginGrid />` with `<LoginBackdrop />`; delete the card `backdrop-blur-sm`/`bg-bg/90`.

### B. « Panneau Prusse » — split layout, dark brand panel
Left 5/12: `bg-side` panel holding the lockup, the Bodoni title and lead (`text-side-text`/`text-side-muted`), a very faint grid anchored bottom-left. Right 7/12: canvas with the 8 cards. Mood: Big-4 gravitas, the most "identity". Cost: eats width (cards go 2 x 4) and changes the layout.
```tsx
<main className="grid min-h-svh bg-canvas lg:grid-cols-[5fr_7fr]">
  <aside aria-hidden={false} className="relative flex flex-col justify-between overflow-hidden bg-side p-10 text-side-text">
    <div aria-hidden className="pointer-events-none absolute inset-0" style={{
      backgroundImage: "linear-gradient(to right, rgb(154 166 188 / .10) 1px, transparent 1px), linear-gradient(to bottom, rgb(154 166 188 / .10) 1px, transparent 1px)",
      backgroundSize: "4em 4em", WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 0% 100%, #000, transparent 75%)",
      maskImage: "radial-gradient(ellipse 90% 80% at 0% 100%, #000, transparent 75%)" }} />
    <BrandLockup />   {/* no chip: already white-on-dark */}
    <div className="relative"><h1 className="font-display text-[1.9em] font-semibold italic text-balance">…</h1>
      <p className="mt-3 max-w-[30em] text-side-muted">…</p></div>
    <span className="relative text-xs text-side-muted">{site.demoNote}</span>
  </aside>
  <section className="flex items-center p-6 sm:p-10 lg:p-14">{/* 8 cards, grid sm:grid-cols-2, white + border-border + shadow-sm */}</section>
</main>
```
Fade in the whole `<aside>` with `motion.aside` opacity 0→1 over 500 ms (`initial={reduce ? false : …}`). Below `lg` the aside becomes a top band.

### C. « Lumière de papier » — soft light, grain, ghost initial
No lines: a pale warm light over the cards (`#faf9f6`, 1.07 vs canvas), a slightly deeper paper at the bottom, 6 % ink grain from an inline SVG filter, and one oversized Bodoni « S » cropped bottom-right at 2.5 % ink. Mood: stationery, warm, luxurious. Risk: the ghost letter is decorative text and can look kitsch if sized wrong; the grain disappears on low-DPI screens.
```tsx
const grain = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .06 0 0 0 0 .1 0 0 0 0 .18 0 0 0 1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
export function LoginBackdrop() {
  const reduce = useReducedMotion();
  return (
    <motion.div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"
      initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(60% 55% at 50% 38%, #faf9f6, rgb(250 249 246 / 0) 100%), radial-gradient(120% 90% at 50% 100%, rgb(222 218 208 / .45), rgb(222 218 208 / 0) 70%)" }} />
      <div className="absolute inset-0 opacity-[.06]" style={{ backgroundImage: grain, backgroundSize: "160px 160px" }} />
      <span className="absolute -bottom-[.2em] -right-[.05em] font-display text-[28em] font-semibold italic leading-none text-ink/[.025]">S</span>
    </motion.div>
  );
}
```
(`160px` is a documented texture-tile exception to the em rule.)

## 3. Recommendation: **Option A « Papier réglé »**
- **Relation to SBS:** the grid is the product's hero object and the « Trame » name itself; it keeps the idea of the old « grid assembles » moment but as a quiet static ruling instead of coloured blocks. No new colour enters the identity zone (no red, no data hues).
- **Calm:** one colour, one scale (4 em cells ≈ 60 px, similar to the cards' rhythm), 1.13 contrast against paper, fading out behind the content. One 500 ms opacity fade replaces 12 sliding blocks.
- **Premium:** crisp solid white cards with a hairline border and soft shadow on clean paper read as stationery; no blur or gradients.
- **Legibility:** text on cards 5.92–18.33:1, on paper 5.24–16.23:1, all AA/AAA; the texture never exceeds 1.17:1 so it cannot be mistaken for content.
- **Fallbacks:** B is the right choice if the client wants a stronger brand statement later (it costs layout width). C suits a softer, more editorial mood but has the highest "taste risk" and the least tie to the staffing product.
- **Implementation size:** replace `LoginGrid.tsx` content with Option A, change the title panel to plain text on the canvas, cards to `bg-bg shadow-sm`, remove `backdrop-blur-sm`, `bg-bg/90`. Update the login paragraph in `docs/motion-plan.md` (no more block assembly).
