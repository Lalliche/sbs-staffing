# Analyzing a Reference Link — Prototype Kit

> Use this whenever the client brief includes a link — their current solution, a competitor, or a site whose aesthetic they want the prototype to evoke.
> Output feeds `design-system.md` for the new project; this file never replaces it, it's the method for producing a first draft the user can approve or redirect.

---

## When to use this

The user will typically say something like "here's their current site" or "we want something like this but better" and give a URL. Before writing a single line of UI code:

1. Fetch the link (via `WebFetch`, or the `web-fetch` agent if no direct tool is available).
2. Extract what's below.
3. Propose a design system **derived from, but not copied from** the reference.
4. Get the user's sign-off before building anything on top of it — a wrong color/font guess is cheap to redirect at this stage and expensive to unwind after 20 components exist.

If the link is the client's *own current product* (the thing the prototype is meant to beat), treat the extraction as "here's their baseline" rather than "here's our aesthetic direction" — the brief usually wants something recognizably better, not a clone. If the link is a *competitor* or *inspiration* site, the extraction is closer to "here's the visual language to riff on."

---

## What to extract

**Color**
- Background(s), surface/card colors, primary text color, secondary/muted text color.
- Primary brand/accent color(s) — note exact or close hex values where visible in page source, computed styles, or screenshots.
- Any semantic colors in use (success/warning/danger) and how they're applied (pure color vs. color + icon).
- Overall palette character: light/dark/both, saturated/muted, warm/cool.

**Typography**
- Font families in use (check `<link>`/`@font-face` tags, or computed `font-family` if you can inspect the page) — display/heading face vs. body face vs. any monospace/data face.
- Approximate type scale (how big is the hero headline relative to body text — is it a bold editorial scale or a conservative corporate one).
- Weight usage (how many distinct weights, how heavy does it go).
- Letter-spacing/tracking character (tight and modern vs. loose and airy).

**Layout & spacing**
- Grid/column conventions, how generous the whitespace is, how content is contained (full-bleed vs. a centered max-width).
- Section rhythm (tight and dense vs. long and breathing).
- Border-radius language (sharp corners, slightly rounded, very rounded/pill-heavy).

**Components**
- Button style(s): filled/outline/ghost, radius, any shadow or gradient, hover behavior if observable.
- Card/surface treatment: borders vs. shadows vs. both, flat vs. layered.
- Navigation pattern: top bar, sidebar, what it does on scroll.

**Aesthetic character (a short verdict, not a long essay)**
- Pick the closest read: minimal/editorial, bold/maximalist, corporate/enterprise, playful/consumer, technical/data-dense, luxury/premium.
- Note anything distinctive worth deliberately NOT copying (an identifiable signature move that would make the prototype look like a clone if reused directly).

**Motion (only what's visible without deep interaction)**
- Any obvious hover states, scroll reveals, transitions, hero animation, carousel/marquee — just enough to know if the client's bar for motion is "static corporate site" or "already fairly animated," which calibrates how ambitious `motion-playbook.md` work should be.

---

## Output format

Produce a short draft, written for the user to approve or redirect — not a finished `design-system.md`, but close enough to become one quickly:

```md
## Reference analysis — <site name/URL>

**Read:** <one-line aesthetic verdict>

**Extracted palette**
- Background: #______
- Surface: #______
- Text: #______ / muted #______
- Accent: #______
- (semantic colors if relevant)

**Extracted type**
- Display/heading: <font name or closest guess>, weight(s) used
- Body: <font name or closest guess>
- Scale character: <e.g. "large, confident hero type, generous line-height">

**Layout character**
- <e.g. "centered, max-width ~1200px, generous section padding, sharp-ish corners (~8px)">

**Proposed design system for this prototype** (derived FROM the reference, not copied)
- Primary: #______  — <why: e.g. "close to their brand blue, slightly deepened for better contrast">
- Accent: #______  — <why>
- Background / surface: #______ / #______
- Display font: <choice + why>
- Body font: <choice + why>
- Radius scale: <e.g. "0.5em cards, full pills for badges">
- Motion ambition: <calibrated to what the reference implied, or to the brief's own stated ambition if it's explicit>

**What we're deliberately NOT copying:** <call out anything that would read as a clone>
```

Stop here and let the user confirm or adjust before writing any component code. If they just say "looks good," proceed to build the real `design-system.md` for the project from this draft, following whatever structure the client project's own spec convention uses.

---

## Practical notes

- A `WebFetch` of a marketing page usually gets you the rendered text and some structure, not computed CSS — for exact colors/fonts, look at the page's linked stylesheets, `<meta theme-color>`, OG image colors, or ask the user to share a screenshot if precision matters and the fetch alone doesn't reveal it. Don't invent specific hex values with false confidence — say "approximate, based on visual impression" when that's what it is.
- If the reference is the client's **current outdated product**, it's fair (and often the whole point) to extract the palette/type as a starting point while explicitly upgrading execution quality — sharper type pairing, better spacing rhythm, real motion — per `motion-playbook.md` and `tailwind-rules.md`. The brief is almost always "ours, but credible and premium," not "theirs, unchanged."
- Never reproduce a competitor's actual copy, imagery, or trademarked assets. Extract *system* (colors, type, spacing, structure), not *content*.
