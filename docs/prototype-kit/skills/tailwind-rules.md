# Tailwind & Styling Rules — Prototype Kit

> The styling contract for prototypes built with this kit. Follow exactly.
> Brand values (colors, typography, spacing, effects) live in the client project's own `design-system.md` — the source of truth for *what* the values are.
> Motion lives in [motion-playbook.md](./motion-playbook.md) — the source of truth for *how things move*.
> This file is the source of truth for *how* to write Tailwind.

---

## Units

- **`em` for everything sizing-related:** padding, margin, gap, font-size, radius, width/height, offsets.
- **`px` only for:** borders and hairlines (`border`, `border-[1.5px]`, `h-px`). Never above `4px`.
- **Percentages / viewport units** for fluid widths and full-bleed sections (`w-full`, `w-[60%]`, `min-h-[100svh]`).
- **Prefer arbitrary values** (`p-[1em]`, `text-[1.5em]`) over Tailwind's default scale (`p-4`, `text-lg`) — the default scale is `rem` and ignores the responsive body base.

```jsx
// ❌ Wrong
<div className="p-4 text-sm gap-2 rounded-lg">

// ✅ Correct
<div className="p-[1em] text-[0.875em] gap-[0.5em] rounded-[0.5em]">
```

### Why `em`

```jsx
<body className="text-[12px] md:text-[14px] lg:text-[15px] xl:text-[16px]">
```

Everything downstream in `em` → one line rescales the whole UI. **The tax:** `em` compounds — keep `font-size` on leaf text nodes, don't nest size changes. For huge display type, set the size on the heading itself.

### Design-system px → `em`

Design-system pixel values are reference values at `xl` (16px base). Convert as `px / 16`:

| Reference | Tailwind |
|---|---|
| 16px | `text-[1em]` / `p-[1em]` |
| 14px | `text-[0.875em]` |
| 24px | `text-[1.5em]` / `gap-[1.5em]` |
| 32px | `text-[2em]` |
| 48px | `text-[3em]` |
| 72px | `text-[4.5em]` |
| 96px | `text-[6em]` |

Hero display type may also use `clamp()` with `vw` when the design system specifies it — set via arbitrary value: `text-[clamp(3em,7vw,6.5em)]`.

---

## Breakpoints (mobile-first)

```
xs 500 · sm 640 · md 850 · lg 1150 · xl 1350 · xxl 1800 · xxxl 2200
```

Default = mobile. Layer up with `sm:` … `xxxl:`. Required QA widths: 375, 768, 1024, 1440, 1920.

---

## Layout

- **Flex first.** Grid for literal grids: bento layouts, card grids, stat rows, footer link columns.
- Section pattern: full-width `<section>` (backgrounds, glows, bleed effects) → constrained inner `Container` (`max-w-*` + horizontal padding).
- Sibling spacing via `gap-[Xem]` on the parent — not margins on children.
- Vertical section rhythm comes from the design system's section-padding tokens — don't invent per-section values.
- Layered effects (glows, grids, noise, beams) are `absolute inset-0 pointer-events-none` children with `aria-hidden="true"`, and the section has `relative isolate overflow-hidden` (or `overflow-clip` when sticky children are involved — `overflow-hidden` breaks `position: sticky`).
- Logical CSS properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `text-start`) instead of physical ones (`pl-`, `pr-`, `text-left`) wherever Tailwind supports them — this keeps the prototype RTL-ready for free, which matters whenever a client's market might need it later.

---

## Colors

- Token utilities only: `bg-bg`, `bg-surface`, `text-text`, `text-text-secondary`, `border-border`, `text-accent`, … — exact names from the design system's `@theme` block.
- Opacity modifiers on tokens (`bg-accent/10`, `border-text/10`) — don't create tokens for alpha variants.
- Brand colors are swappable: components reference tokens, never hex, so a client's final brand palette drops in via `globals.css` alone.
- **Never default Tailwind palette colors** (`indigo-*`, `slate-*`, `zinc-*`, `gray-*`…).
- Genuinely one-off colors inside illustrations/effects: inline hex is fine, with a comment.
- An accent color should have a visible budget per viewport (e.g. ≤2 uses) and should generally not be the color of buttons/badges/links by default — reserve it for genuine emphasis. Status should never be color alone — pair a dot/icon with a label.

---

## Typography

- Font roles are fixed by the design system (display/heading, body, mono) and exposed as `font-*` utilities. Never swap roles.
- Numbers (stats, counts, currencies) use the role the design system assigns to data + `tabular-nums` so count-ups don't jitter.
- Body max-width `max-w-[65ch]`; hero/section subcopy per design system.
- Eyebrows: small uppercase, weight 500–600, tracking 0.06–0.12em.
- Headings get negative tracking per the type scale; use `text-balance` on headings and `text-pretty` on paragraphs.
- Never more than 2 weights in one text block.

---

## Borders, Radius, Surfaces

- 1px borders with the canonical shorthand (`border`, `border-t`), always paired with a color token.
- Radius from design-system tokens, in `em` (`rounded-[0.75em]`), `rounded-full` for pills.
- Gradient borders, glows, noise, and glass follow the recipes in the design system exactly — implement each recipe once as a shared component, not re-typed per section.
- Hairline dividers inside dark surfaces: `border-text/10`-style token opacity, not grey hex.

---

## Shadows

Use the design system's levels via the mapped classes:

```css
.shadow-xs { box-shadow: var(--shadow-xs); }
.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow-md { box-shadow: var(--shadow-md); }
.shadow-lg { box-shadow: var(--shadow-lg); }
.shadow-xl { box-shadow: var(--shadow-xl); }
```

Never Tailwind's default shadow values. One-off layered shadows (e.g. a card's ambient glow) → inline `style={{ boxShadow }}` or a motion template.

---

## Global CSS Is a Last Resort

`globals.css` contains only: `@import "tailwindcss"`, `@theme inline`, `:root` vars, base element styles, `@keyframes`, shadow mappings, the `prefers-reduced-motion` block. **No component classes.** Before adding anything ask: *can this be Tailwind on the element?* — 90% yes.

---

## Inline Styles

`style={{}}` only for:

- **Motion values** (`style={{ x, rotateX, opacity }}` on `motion.*` elements) — the main legitimate use.
- **Gradients, masks, conic/radial glows** (`backgroundImage`, `maskImage`, `WebkitMaskImage`).
- **Backdrop blur** (`backdropFilter` + `WebkitBackdropFilter`).
- **3D context** (`perspective`, `transformStyle: "preserve-3d"`, `backfaceVisibility`).
- **Applying a CSS `@keyframes` loop.**

Everything else: Tailwind classes.

---

## Animations — Division of Labour

| Need | Tool |
|---|---|
| Hover/focus/active micro-interactions on static elements | Tailwind `transition-[transform,opacity,color,background-color,border-color]` + duration/ease tokens |
| Anything scroll-linked, in-view, orchestrated, spring-based, gesture-based, 3D, or enter/exit | `motion/react` per `motion-playbook.md` |
| Infinite decorative loops (grain shift, shimmer) where JS is overkill | CSS `@keyframes` in `globals.css`, applied inline |

**Hard rules:**
- **Never `transition-all`** — name the properties.
- **Never Tailwind `animate-*`** utilities beyond the project's own defined animation tokens (plus `animate-spin` if a loader is ever needed).
- **Transform, opacity, filter, clip-path only.** Never animate width/height/top/left/margin/padding. Use `layout` animations from `motion` when size genuinely must change.
- `will-change` only on elements actively animating, never blanket.
- Every animation has a reduced-motion path (see playbook).

---

## Images

- Always `<Image />` from `next/image`; `fill` + `object-cover` inside a sized parent, explicit `sizes`.
- Brand/product art → `src/assets/` as high-res PNG/WebP/SVG as appropriate.
- Hero/background photography → `loading="eager"` + `fetchPriority="high"` only for the above-the-fold/LCP image.
- Placeholders while waiting for client assets: `https://placehold.co/WIDTHxHEIGHT` using design-system bg/accent hex.

---

## What NOT to Do

- No CSS Modules, no styled-components, no `tailwind.config.js`.
- No default Tailwind palette colors, no hex for tokenized colors.
- No `px` for spacing, font-size, radius.
- No component classes in `globals.css`.
- No `transition-all`, no `animate-*` outside defined tokens.
- No inline styles for things Tailwind expresses.
- No `<img>`.
- No mixing font roles.
