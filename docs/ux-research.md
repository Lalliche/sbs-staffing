# SBS Staffing — UX & brand research (synthesis)

Four research agents ran in parallel in Phase 0; their raw reports are kept in `docs/research-raw/` (A benchmark, B data-density UX, C brand, D motion & data-viz). This file is **my synthesis and the decisions taken**, not a paste of the reports. Facts marked *(unverified)* in the raw reports stay unverified here.

## 1. What the research established

### Benchmark (A) — what staffing tools do, and what we take
- **One planner, two lenses.** Productive (By Person / By Project / By Absence) and Runn (People / Project planner) toggle the *row dimension* on one grid instead of building two screens. → **Adopt**: Planning has a `Par collaborateur · Par mission · Par département` lens switch.
- **Tentative vs confirmed** are visually different (Float: outlined vs filled) and a **global "include tentative" toggle** drives every number (Runn, Productive). → **Adopt**: SOFT = hatched, HARD = solid; one toggle `Inclure les réservations` feeds heatmap, KPIs, utilization.
- **Red is reserved for over-allocation**; calm products (Smartsheet greys, Runn blues) avoid green/amber/red for ordinary states. Float's orange = "average OK but someone is overbooked". → **Adopt**: blue ramp for load, crimson only above 100 %, orange only for "uneven load / alert" at group level.
- **Zoom presets** Week / Month / Quarter / Half-year / Year with auto-coarsening summaries, a Today button, arrow-key paging (Runn). → **Adopt** (Semaine / Mois / Trimestre; Jour for detail).
- **Placeholders** = unmet demand rows (Runn, Productive). → **Adopt**: "Besoin non couvert" rows at the top of the mission lens linking to the matching panel.
- **Matching**: only Kantata documents a weighted score + ranked candidates + cost impact; nobody shows blocking badges or side-by-side comparison. Big-4 internal tools are **not public** (only vendor stories: Napta, Dayshape — independence/rotation as hard checks, human-in-the-loop). → **Differentiate**: blocking criteria are a *separate* red "Non compatible" state that disables auto-selection; compare view of up to 3 candidates; weights shown ("Pondérations utilisées").
- **Capacity**: Planview's requested-demand vs availability toggle; Runn's placeholder demand = recruitment needs. → **Adopt**: stacked demand vs capacity line with deficit chips.
- **Avoid**: five configurable heat bands on day one, traffic-light everywhere, hover-only overload, black-box auto-assign, modal-heavy booking.

### Data-density UX (B) — numbers we use
Row heights 32/40/48 (2/2.5/3 em at 16 px), planning row 48, block 32, sticky left column 240, columns 40/96/128/192 px (jour/semaine/mois/trimestre); block label tiers at 24/48/96/160/240 px; `Intl fr-FR` formatting (U+202F groups, `1 234 567 DZD`, `85 %`, `37,5 h`); **WCAG 2.5.7 needs a non-drag single-pointer alternative** (a keyboard alternative alone does not satisfy it) → click-click, block popover with steppers, and `M`/`R` keyboard modes.
**Measured, not guessed:** a plain green/orange/red trio collapsed under deuteranopia (orange vs red ΔE00 = 3.9). B searched and delivered a trio that stays distinguishable (min ΔE00 ≈ 14.6) and carries a *shape* each: circle-check / triangle-alert / octagon-x. Secondary grey `#6B7280` fails AA on the warm canvas (4.44) → `#5C6478`-class values only.

### Brand (C) — facts
sbsfirm.org confirmed by computed styles: Arial/Helvetica, 0 px radius, ink `#050703`, body `#555759`, red `#E4042C` on one CTA/active nav/logo mark, beige bands `#F3F0EA`. The identity is carried by the **logo**. Defects found in the 360° baseline by computation: warning text 4.36:1 (fails), `border-strong` 1.5:1 (fails the 3:1 rule for input boundaries), and **brand red and danger red sit at the same hue (ΔE 19.9)**. Our product must not inherit those.

### Motion (D) — the budget
Productive motion for a tool used hours daily: entrance can delight once; anything repeated ≤ 160 ms or static. Page enter 180 ms enter-only; stagger 30 ms capped at 10 items, first mount only; count-up 700 ms first view only; charts draw on first view only and morph ≤ 180 ms afterwards; ≤ 3 concurrent animation tracks, one signature moment per screen. Conflict shake has a reduced-motion twin (outline pulse + aria-live text).

## 2. Brand decision — **Direction C « Trame »** (+ B's rules)

Three directions were proposed: **A Héritage** (360° with other labels — too similar, muddiest heatmap), **B Registre** (neutral ledger, red only in the logo — most sober but anonymous), **C Trame** (Prussian ink on warm paper, Didone product name, one red ribbon). **Chosen: C**, with B's rule "brand red never touches the data zone" and B's density tokens.

Why:
1. **Related to SBS** — warm paper canvas, near-square corners, hairlines over shadows, the untouched Didone logo PNG, a Didone product name (Bodoni Moda) that rhymes with the "SBS" wordmark, and the red kept as a deliberate single anchor (a 3 px ribbon under the logo + the long stroke of the monogram).
2. **Not 360°** — sidebar turns from ink-black to Prussian blue-black, primary action from ink to Prussian, display role moves to Bodoni on the product name, UI face is IBM Plex Sans (360° uses Geist), chart family is blue-led instead of warm. Someone using both products knows instantly which one they are in.
3. **Dense-data legibility** — single-hue blue availability ramp (most separable of the three), white/ink label flip, hairline grid, tabular mono for hours.
4. **Status integrity** — brand red ≈ 0.1 % of the screen, so a red cell is **always** a conflict. Conflict is also pattern (hatch) + icon + word.
5. **Not a generic SaaS template** — warm paper, ledger hairlines, Didone name, ribbon device, near-square corners and a deliberately low-chroma blue.

Guardrail against drifting into "blue SaaS": only low-chroma Prussian values (`#0F1A2E`, `#1B3358`) on warm paper; never a bright brand blue; blue is *structure and load*, never decoration.

### Two-zone rule (identity vs data)
*Identity zone* = logo, ribbon, monogram, active-nav marker (no red: ribbon only), login. *Data zone* = grid, heatmap, tables, KPIs, charts, badges, form errors. Brand red is banned from the data zone; status colours are banned from the identity zone. Brand red is never small text, focus, hover, selection or a chart series. QA test: grayscale screenshot — conflict cells still identifiable by hatch + icon, brand red absent from the grid area.

### Where I deviated from the raw reports (and why)
- **Status trio**: C proposed `#1F7A4D / #9A5707 / #971B12`; B *simulated colour-blindness* and found trios of that family confusable. I use **B's validated trio** (`#097160` ok, `#AA4F0E` alerte, `#9C1C3C` conflit) because the status system is the product's core signal. The cost: conflict crimson is bluer than C's brick; acceptable because brand red is quarantined to the ribbon.
- **UI font**: C suggested Geist (what 360° already ships). I choose **IBM Plex Sans** (+ Plex Mono) to widen the gap with 360° and for its ledger character; Bodoni Moda only for the product name/login. Tabular figures are enabled explicitly (`tnum`, `zero`) and checked in the browser at integration.
- **Heatmap**: B's four named states for the planning (Dispo / Partiel / Plein / Surchargé) with number + icon + label; C's 8-step single-hue ramp for the department × grade matrices and calendars.
- **Department colours** (block identity on the grid) avoid the status hues: Prussian, slate, violet, ochre, rose. Blocks are a 14 % tint + 1 px border + ink text, so contrast never depends on the hue.
- **Weekend** is Friday–Saturday (Algeria, working week Sunday→Thursday) as a *setting per office* — flagged as to-confirm with SBS.

## 3. Information architecture (decided)

Sidebar (Prussian, 248 → 72 px), groups and persona-aware visibility (permission-driven):

| Group | Entries |
|---|---|
| Pilotage | Tableau de bord · Planning |
| Opérations | Missions · Demandes de staffing · Marketplace · Timesheets · Disponibilités & absences |
| Ressources | Collaborateurs · Compétences · Évaluations |
| Analyse | Capacité · Analytics & rapports |
| Système | Notifications · Administration |

Top bar: breadcrumb · global search ⌘K · period/scope chip where relevant · SBS Staffing Intelligence · notifications · help · user menu. Page header: breadcrumb → H1 + one-line description → actions. Filters live in the URL.

## 4. Pattern decisions (adopted / rejected)

| Topic | Adopted | Rejected (why) |
|---|---|---|
| Planning rows | Lens toggle people / missions / departments; collapsible groups with a summary strip | Two separate screens (duplication) |
| Booking states | SOFT hatched + dashed, HARD solid; global "inclure réservations" | Colour-only distinction (fails colour-blind) |
| Heatmap | A *mode* replacing block fills so two colour systems never overlap | Heatmap as an overlay on blocks (muddy) |
| Overload | Inline cell + group roll-up + hover explanation + pre-drop warning | Modal-only conflicts |
| Conflicts on drop | Engine validates; modal `Annuler / Autoriser l'exception` with written justification | Silent clamp |
| Drag a11y | Click-click + popover steppers + keyboard M/R | Drag as the only input (WCAG 2.5.7) |
| Matching | Score + breakdown + strengths + gaps; blocking separate; compare ≤ 3 | Black-box auto-assign |
| Capacity | Stacked demand vs capacity line, deficit hatched, chips "Déficit : 2 Seniors", scenario sliders | Five admin-configurable bands |
| Tables | 3 densities (persisted), hairlines not zebra, right-aligned tabular numbers, saved views, column chooser with up/down | Zebra by default, drag-only column reorder |
| Charts | Direct labels, ≤ 7 series with different markers/dashes, "Voir en tableau" on every chart | Legends everywhere |
| Status | Icon + FR label + (charts) dash/marker | Colour-only |
| Motion | See `motion-plan.md` | Landing-style effects inside the app |

## 5. Known open items carried forward
- Real SBS office list, working week, and holiday calendar to be confirmed (seed uses Alger & Oran, Sunday→Thursday, indicative holidays).
- Public information on Big-4 internal tools does not exist; no claim is made that SBS Staffing replicates any of them.
- Plex Sans / Bodoni Moda tabular-figure behaviour is verified in Chrome at integration (see build notes in `CLAUDE.md`).
