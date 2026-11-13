# Do's & Don'ts — Prototype Kit

> Quick-scan cheat sheet. If an agent only reads one file, it should be this one.
> For *why* and *how*: [nextjs-architecture.md](./nextjs-architecture.md), [tailwind-rules.md](./tailwind-rules.md), [motion-playbook.md](./motion-playbook.md), [analyze-reference.md](./analyze-reference.md).
> This kit's rules are generic. The client project's own `CLAUDE.md` / design-system / spec always wins on anything domain-specific (currency, language, data model, business rules).

---

## Always

### Structure
- ✅ `page.jsx` only composes sections/screens, in the order the project's own content spec defines.
- ✅ One folder per section/feature, `index.jsx` entry (server) + `…Client.jsx` (motion/interactive) when a client boundary is needed.
- ✅ Every landing section is `<section id="…" aria-labelledby="…">`.
- ✅ Body carries a responsive `text-[…px]` scale (see `nextjs-architecture.md`) that drives all downstream `em` sizing.
- ✅ Every `<button>` / CTA goes through the shared `Button` component. Every input through the shared form-input components (`onChange` receives the value).
- ✅ Extract on the second use — markup to `shared/`, motion to `motion/` / `motion-tokens.js`.
- ✅ `cn()` for all conditional classNames.
- ✅ Server components by default; `"use client"` pushed as deep as possible.

### Motion
- ✅ `motion` from `"motion/react"` for scroll-linked, in-view, orchestrated, spring, gesture, 3D, enter/exit.
- ✅ Every duration, easing, spring, stagger comes from `motion-tokens.js`.
- ✅ **Every animated tree is gated by `useReducedMotion()`** — reduced = no transforms, instant or opacity-only.
- ✅ One signature moment per section; supporting motion stays quiet.
- ✅ Motion values (`useMotionValue`, `useScroll`, `useSpring`, `useTransform`) instead of React state for anything per-frame.
- ✅ Transform / opacity (and filter / clip-path sparingly) only.
- ✅ Hover-driven effects (tilt, spotlight, magnetic) have a touch fallback — disabled or converted to scroll/tap.
- ✅ WebGL/3D is lazy-loaded, mounts near viewport, pauses off-screen, and has a static fallback.
- ✅ Follow the per-section motion planning method in `motion-playbook.md` §4 for every flagship section.

### Styling
- ✅ `em` for padding, margin, gap, font-size, radius, sizes. `px` only for borders ≤4px.
- ✅ Tokens only (`bg-bg`, `text-accent`…), opacity modifiers for alpha.
- ✅ Flex first; Grid for literal grids (bento, card grids, stat rows).
- ✅ Sibling spacing via `gap-[Xem]`.
- ✅ Effects (glow, grid, noise, beams) as `absolute inset-0 pointer-events-none aria-hidden` layers.
- ✅ Headings `text-balance`, paragraphs `text-pretty`, numbers `tabular-nums`.

### Content & SEO
- ✅ All copy from a `src/content/` module, including aria-labels and alt text.
- ✅ Metadata + OG from the project's own content spec.
- ✅ One `<h1>` per page.
- ✅ Realistic placeholder data matched to the client's actual market/language/locale — never generic lorem ipsum, never names/currencies/addresses from the wrong country.

### Images
- ✅ `<Image />` with `sizes`; `loading="eager"` + `fetchPriority="high"` only on the LCP / front hero image (`priority` is deprecated in Next 16+).
- ✅ Brand assets in `src/assets/`, imported as modules.

### Quality gates
- ✅ Every interactive element has `hover:`, `focus-visible:`, `active:` states and is keyboard reachable.
- ✅ QA at 375 / 768 / 1024 / 1440 / 1920 before a section is called done.
- ✅ 60fps scroll on a mid-range phone; no layout shift from animations (reserve space, animate transforms).
- ✅ `npm run build` + `npm run lint` pass before declaring done.

---

## Never

### Structure
- ❌ Never put markup inline in `page.jsx`.
- ❌ Never create ad-hoc `<button>`s or inputs, or re-style a shared `Button` variant from outside the component.
- ❌ Never call `setState` synchronously in a `useEffect` body (React 19 error). Use callbacks / rAF, or derive in render.
- ❌ Never read `ref.current` during render.
- ❌ Never use `next/dynamic` with `ssr: false` inside a server component.
- ❌ Never duplicate code, class strings, or variant objects.
- ❌ Never wire a form to a real backend/email service until told to — mock it.

### Motion
- ❌ Never inline magic numbers for motion (`duration: 0.73`, custom beziers) — tokens.
- ❌ Never animate width, height, top, left, margin, padding.
- ❌ Never `transition-all`; never Tailwind `animate-*` outside the project's own defined animation tokens.
- ❌ Never blanket `will-change`.
- ❌ Never animate everything at once — no "every div fades up" pages.
- ❌ Never bounce/overshoot content text; springs with overshoot only for playful physical objects, and only when the motion plan calls for it.
- ❌ Never scroll-jack (no hijacking wheel speed, no forced snapping of the whole page).
- ❌ Never block content behind an animation — text must be readable if JS fails or motion is reduced.
- ❌ Never mount WebGL eagerly above the fold without a poster, or keep it rendering off-screen.

### Styling
- ❌ Never default Tailwind palette colors; never hex for a tokenized color.
- ❌ Never `px` for spacing, font-size, radius.
- ❌ Never component classes in `globals.css`; never CSS Modules / styled-components / `tailwind.config.js` (Tailwind v4 config lives in `globals.css` via `@theme`).
- ❌ Never inline styles for things Tailwind expresses.
- ❌ Never mix font roles or more than 2 weights in a block.
- ❌ Never gradients on primary buttons unless the project's design system explicitly specifies the recipe.

### Content
- ❌ Never hardcode copy in JSX.
- ❌ Never invent testimonials, client logos, stats, or partner claims — use explicit placeholder markers from the spec until the client confirms real values.
- ❌ Never use a real trademark/brand name the client hasn't actually licensed or partnered with.

### Images
- ❌ Never `<img>`.
- ❌ Never ship unoptimized multi-MB hero media.
