# Next.js Architecture — Prototype Kit

> The structural contract for client-pitch prototypes built with this kit. Read this first, every session, before touching any UI code.
> For *how* to write Tailwind (units, layout, shadows, global-CSS discipline), read [tailwind-rules.md](./tailwind-rules.md).
> For *how* to animate (tokens, patterns, per-section plan, 3D), read [motion-playbook.md](./motion-playbook.md).
> For brand values (colors, typography, spacing tokens), read the client project's own `design-system.md` — it always wins on visual decisions.
> For every word on the page, read the client project's own content spec.

---

## Project Stack (baseline — a client project may pin exact versions)

| Item | Value |
|---|---|
| Framework | Next.js (App Router, React 19+) — check the client project's `package.json` for exact versions |
| Styling | Tailwind CSS **v4** — config lives in `src/app/globals.css` via `@theme inline {}`. **No `tailwind.config.js`** |
| Components | `.jsx` for components and routes unless the client project is explicitly TypeScript |
| Animation | `motion` (Framer Motion) — import from `"motion/react"`. **First-class citizen**, not decoration. See `motion-playbook.md` |
| 3D | Per `motion-playbook.md` decision matrix — CSS 3D driven by motion values by default; WebGL only where the playbook says so, always lazy-loaded |
| Icons | `lucide-react` (primary). A secondary icon set only for brand/social marks |
| Class utility | `cn()` from `@/lib/utils` (clsx + tailwind-merge) — always for conditional classNames. Never string-concatenate |
| Content | All copy lives in `src/content/` modules sourced from the project's content spec — never hardcoded in JSX |
| i18n | Match whatever the client brief specifies. If single-language, keep copy centralized in `src/content/` anyway so a later i18n migration is a body-swap, not a rewrite |

> ⚠️ Each major Next.js version has had breaking changes from the one before. When unsure, read `node_modules/next/dist/docs/` before writing layouts, metadata, route handlers, or config — do not rely on memory of older Next.js APIs.

---

## Routing

Keep the tree flat and boring. A single marketing/landing page:

```
src/app/
  layout.jsx            ← html/body, fonts, metadata, <MotionConfig> provider
  page.jsx              ← composes sections in order — nothing else
  globals.css           ← tokens + base styles only (see tailwind-rules.md)
  not-found.jsx
  opengraph-image.*     ← OG image (file convention)
  icon.* / favicon.ico
```

The moment a second page or a distinct app shell exists, move to route groups:

```
src/app/
  (marketing)/
    layout.jsx          ← Navbar + Footer shared by all marketing pages
    page.jsx            ← landing
    …/page.jsx
  (app)/
    app/layout.jsx       ← back-office shell, if the prototype has one
    app/**/page.jsx
```

**Hard rules:**
- `page.jsx` only composes sections/screens. Never put markup or components inline in it.
- Internal navigation uses `next/link`; in-page anchors use `#section-id` with ids defined in the content spec.
- Every landing section is a `<section id="…">` with an `aria-labelledby` pointing at its heading.

---

## Components Tree — Section/Feature-Based

```
src/components/
  ui/                 ← atomic primitives (single source of truth)
    Button.jsx            ← every <button> and button-styled link
    FormInputs.jsx        ← TextInput, TextArea, SelectInput (and any other form control)
    …other shared primitives as the project needs (Card, DataTable, Modal, Badge…)
  motion/             ← reusable motion primitives (used in 2+ places)
    Reveal.jsx            ← in-view fade/rise wrapper
    SplitReveal.jsx       ← word/line reveal
    TiltCard.jsx          ← 3D tilt with springs
    SpotlightCard.jsx     ← cursor-follow glow
    MagneticButton.jsx
    CountUp.jsx
    Marquee.jsx
    BorderBeam.jsx
    PathDraw.jsx
  shared/             ← non-motion pieces used in 2+ places
    SectionHeader.jsx     ← eyebrow + heading + subcopy
    Container.jsx
    Eyebrow.jsx
  providers/          ← client wrappers
    MotionProvider.jsx    ← "use client"; <MotionConfig reducedMotion="user">, mounted once in layout.jsx
  landing/            ← one folder per landing section (name folders after the client's own content spec)
    Navbar/index.jsx
    Hero/index.jsx + HeroClient.jsx + sub-components
    …
src/content/          ← copy + data per section (hero.js, pricing.js, …)
src/assets/           ← imagery, logos (ES-module imports)
src/lib/
  utils.ts|js            ← cn()
  motion-tokens.js      ← easings, durations, springs, stagger, shared variants (motion-playbook.md §2.1)
  use-media.js          ← useMedia / useCanHover (useSyncExternalStore)
```

Section order in `page.jsx` matches the order of the client's content spec. Section folders are named after the content spec's section ids.

**Naming:**
- PascalCase for everything authored (`ProductCard.jsx`, `HeroClient.jsx`). kebab-case only for non-component modules (`motion-tokens.js`) and pasted-in component-library atoms.
- Folder-per-section with `index.jsx` as the entry. Sub-components live alongside, never nested deeper than one level.
- Section pattern: `index.jsx` is a **server component** that reads content and renders layout; the animated part is a `<Section>Client.jsx` with `"use client"`. Keep the client boundary as small as the animation allows.

**Component splitting heuristic:**
- Past **~150 lines** → consider splitting. Under **~80 lines** → don't split without a reuse reason.
- Split when a chunk has its own state/motion values, is reused, or makes the parent hard to read.

**No-duplicate rule:** any markup pattern, class string, variant object, or motion behavior used in more than one place is extracted — markup to `shared/`, motion to `motion/` or `motion-tokens.js`. Zero tolerance.

---

## Root Layout — Required `<body>` className

```jsx
<body className="min-h-full flex flex-col text-[12px] md:text-[14px] lg:text-[15px] xl:text-[16px]">
```

This is the **single point** that rescales the whole UI per breakpoint. Every component sizes in `em` downstream. Treat the design system's pixel sizes as reference values at `xl` (16px base) and convert `px / 16 → em`. See `tailwind-rules.md`.

Fonts load via `next/font` in `layout.jsx` and are exposed as CSS variables consumed by `@theme` — never CDN `<link>` tags for a self-hosted project (an exception applies only when the project itself is an artifact-style page under a different publishing contract).

Metadata (title, description, OG) is exported from `layout.jsx` / `page.jsx` using the SEO block of the content spec.

---

## globals.css — What Lives There

Only:

1. `@import "tailwindcss";`
2. `@theme inline {}` — tokens from the design system (colors, fonts, breakpoints, radii, shadow vars).
3. `:root {}` — non-utility CSS variables.
4. Base element styles: `html`, `body`, `*`, `::selection`, scrollbar, font smoothing.
5. `@keyframes` for pure-CSS loops (marquee fallback, shimmer, grain) — applied inline.
6. Shadow utility mappings (`.shadow-xs … .shadow-xl`) that reference CSS vars.
7. The `prefers-reduced-motion` block.

**Default breakpoint scale (a project may override in its own design system):**

```css
@theme inline {
  --breakpoint-xs:   500px;
  --breakpoint-sm:   640px;
  --breakpoint-md:   850px;
  --breakpoint-lg:   1150px;
  --breakpoint-xl:   1350px;
  --breakpoint-xxl:  1800px;
  --breakpoint-xxxl: 2200px;
}
```

**Never** put component-specific classes (e.g. `.hero-glow`, `.card-sheen`) in `globals.css`. Tailwind inline, `style={{}}` for motion values/gradients.

---

## Server vs Client Components

- **Server components by default.** `"use client"` only for state, effects, event handlers, browser APIs, or `motion` hooks.
- Push `"use client"` down: a server `index.jsx` passes content props to a client `…Client.jsx`.
- `<Image />` from `next/image` for every image — **never** raw `<img>`. Hero imagery gets explicit `sizes`; above-the-fold hero images get `loading="eager"` + `fetchPriority="high"` (newer Next versions deprecate `priority`; use `preload` only when an image must be discovered before render).
- Brand assets (logos, illustrations) → `src/assets/`, imported as ES modules. URL-served files (favicon, robots, OG) → `public/` or app file conventions.

### `setState` in `useEffect` — Hard Rule

React 19 flags synchronous `setState` in an effect body (`react-hooks/set-state-in-effect`).

```jsx
// ❌ WRONG
useEffect(() => { if (window.matchMedia(q).matches) setCanHover(true); }, []);

// ✅ RIGHT — browser values via useSyncExternalStore (src/lib/use-media.js)
const canHover = useCanHover();

// ✅ RIGHT — subscriptions set state inside the callback
useEffect(() => {
  const on = () => setOpen(false);
  window.addEventListener("keydown", on);
  return () => window.removeEventListener("keydown", on);
}, []);

// ✅ RIGHT — derive during render
const activeIndex = Math.round(progress * total);
```

For animation, prefer **motion values** over React state entirely — they update without re-rendering. Reading a ref during render is not allowed; keep render-relevant values in state or motion values.

### Lazy Loading

- Navbar + Hero (or the first screen of an app) load eagerly. Everything below the fold is loaded with `next/dynamic`.
- `next/dynamic(..., { ssr: false })` is only allowed **inside a client component** — wrap WebGL/3D scenes in a small client loader.
- Every WebGL canvas is lazy, mounts only near the viewport, and pauses when off-screen. Provide a static poster/fallback while it loads.

---

## Buttons — Shared `Button` Component (Single Source of Truth)

All buttons and button-styled links go through `src/components/ui/Button.jsx`. **Never ad-hoc `<button>` styling.**

```jsx
import { Button } from "@/components/ui";

<Button variant="primary" href="#contact">Contact sales</Button>
<Button variant="secondary" href="#features">Explore features</Button>
<Button variant="ghost" onClick={onClose}>Close</Button>
```

- Variants and sizes map 1:1 to the Buttons spec in the project's design system.
- `href` renders a `next/link` (or `<a>` for `#anchors`/external), otherwise a `<button>`.
- Magnetic / glow behaviors are opt-in props (`magnetic`, `glow`) implemented once inside `Button.jsx`.
- **Never re-style a variant from outside** — change `Button.jsx`.

## Form Inputs — Shared Components (Single Source of Truth)

Forms use `TextInput`, `TextArea`, `SelectInput` from `src/components/ui/FormInputs.jsx` (or `@/components/ui`). Controlled; `onChange` receives the **value**, not the event. Visible label always; validation `onBlur`; error inline below the field.

> ⚠️ **Do not wire a form to a real backend/email service until explicitly told to.** Submit to a mock function that resolves after a delay.

For a prototype, keep validation forgiving — don't impose strict regex patterns on things like phone numbers or free-text fields unless the client spec explicitly asks for strict validation. A prototype's job is to demo convincingly, not to enforce production-grade input rules.

---

## cn() — Conditional ClassNames

```jsx
import { cn } from "@/lib/utils";

className={cn(
  "flex items-center gap-[0.5em] rounded-[0.5em] p-[0.75em]",
  isActive && "bg-accent/10 text-accent",
)}
```

---

## Content

- Every user-facing string comes from `src/content/<section>.js`, mirroring the client's content spec. JSX never contains copy literals (aria-labels included).
- When copy changes, update the content spec **and** the content module in the same action.
- Items tagged as placeholder/unverified in the content spec stay tagged in a comment next to the value until the client confirms.

---

## State Management

- No global state manager by default. `useState` for local UI, Context only when 3+ components share data.
- Animation state → motion values (`useMotionValue`, `useScroll`, `useSpring`), not React state.
- No API layer unless the prototype specifically needs to simulate one — most pitch prototypes run entirely on seeded/mock data (see the kit's data-layer guidance in the client project's own `CLAUDE.md`).

---

## Screenshot / Visual QA

Check every section at **375, 768, 1024, 1440, 1920** widths before calling it done. Run the build before declaring any phase done.

---

## Anti-Generic Guardrails

- **Never** use default Tailwind palette colors — tokens from the design system only.
- **Never** hardcode copy in JSX — `src/content/`.
- **Never** create ad-hoc buttons or inputs — shared components.
- **Never** inline motion numbers (durations, easings, springs) — import from `src/lib/motion-tokens.js`.
- **Never** ship an animation without a `useReducedMotion()` path.
- **Never** call `setState` synchronously in a `useEffect` body.
- **Never** put component classes in `globals.css`.
- **Never** duplicate code — extract on the second use.
- **Never** use `<img>` — `<Image />`.
- **Every** interactive element has `hover:`, `focus-visible:`, and `active:` states, and works with keyboard and touch.
