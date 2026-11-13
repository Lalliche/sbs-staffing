# SBS Staffing — Design system « Trame »

Derived from the SBS identity (see `docs/sbs-brand-reference/`) but a **sibling**, not 360°. Rationale in `ux-research.md`. All sizes are `em` (body 15 px, 16 px ≥ xl); `--spacing: 0.25em` so `p-4` = 1em. Default Tailwind palette is wiped; only the tokens below exist.

## 1. Principles
Warm paper, Prussian ink, ledger hairlines. **Data is the hero; chrome is quiet.** Borders before shadows. Near-square corners. Red exists only as a 3 px ribbon and the monogram's long stroke (identity zone). Every status is **icon + French label + colour** (chart marks add dash/marker).

## 2. Colour tokens (`@theme`)
| Token | Hex | Use |
|---|---|---|
| `canvas` | `#F3F1EB` | app background |
| `bg` / `surface` | `#FFFFFF` | cards, tables, inputs |
| `paper` | `#EBE8DF` | subtle fills, hover, table header |
| `ink` | `#0F1424` | headings (16.2:1) |
| `text` | `#0F1424` | body |
| `text-secondary` | `#424A5C` | 7.9:1 |
| `text-muted` | `#5C6478` | 5.2:1 (≥ AA on canvas) |
| `border` | `#DEDAD0` | hairlines |
| `line` | `#E4E0D5` | grid lines (quiet) |
| `border-strong` | `#8A8B90` | input/control boundary (3.0:1) |
| `primary` / `primary-hover` | `#1B3358` / `#14264A` | primary action (white 12.6:1) |
| `select` | `#E6ECF5` | selected row/cell tint |
| `focus` | `#1D5FA8` | 2 px focus ring + 2 px offset |
| `side` / `side-raised` / `side-line` | `#0F1A2E` / `#172640` / `#243554` | sidebar |
| `side-text` / `side-muted` | `#E8EBF1` / `#9AA6BC` | 14.6 / 7.1 |
| `ribbon` (brand red) | `#E4042C` | identity zone ONLY |
| `ok` / `ok-bg` | `#097160` / `#E3F1EC` | normal — circle-check |
| `alert` / `alert-bg` | `#AA4F0E` / `#FBEBD9` | attention — triangle-alert |
| `conflict` / `conflict-bg` | `#9C1C3C` / `#FBE3E8` | conflit/urgent — octagon-x (+ hatch) |
| `info` / `info-bg` | `#1D5FA8` / `#E3EDF8` | information |
| `neutral` / `neutral-bg` | `#586069` / `#ECEEF0` | brouillon, archivé |

Status trio is CVD-validated (min ΔE00 ≈ 14.6 across deuteranopia/protanopia) and ≥ 4.5:1 on white, canvas and its own tint. **Warn solid `#E39A1B` is fill-only**, never text.

### Availability states (planning heatmap mode)
| State | Load | Fill | Text | Icon | Label |
|---|---|---|---|---|---|
| Disponible | 0–49 % | `#E6EFF7` | `#1B2A3A` | circle (empty) | Dispo |
| Partiel | 50–84 % | `#A9C8E3` | `#10253A` | circle-half | Partiel |
| Plein | 85–100 % | `#3A78B0` | `#FFFFFF` | circle (filled) | Plein |
| Surchargé | > 100 % | `#9C1C3C` + 45° hatch | `#FFFFFF` | triangle-alert | Surchargé |
Absent (approved leave) = `paper` + diagonal hairline; férié = same + flag glyph. Thresholds read from `settings.thresholds`; the legend is always visible.

### Utilization ramp (matrices, calendars) — 8 steps, single hue
`#EEF2F8 #D9E2EF #BCCCE3 #97B0D2 #6F90BC #4A6F9F #2D4E7E #14264A` — labels flip ink → white from step 6.

### Series (charts)
`s1 #1B3358` Prussian · `s2 #4E7BB0` bleu · `s3 #2E8B94` teal · `s4 #7C5CA3` violet · `s5 #A8708A` rose · `s6 #A38F55` ocre · `s7 #6E7A89` ardoise · `s8 #2B2F36`. Markers: circle, square, diamond, triangle, cross, star, hollow circle. With > 3 series add dash/marker, never hue alone. Chart text uses ink, not the series colour.

### Department identity (grid blocks, avatars)
Audit `#1B3358` · Expertise comptable `#6E7A89` · Conseil juridique & fiscal `#7C5CA3` · Stratégie & conseil `#A38F55` · Transactions `#A8708A`. Block = 14 % tint + 1 px full-colour border + ink text. Dept hue identifies; it never carries status.

## 3. Typography
- **UI**: IBM Plex Sans 400/500/600, `font-variant-numeric: tabular-nums slashed-zero` on all figures. **Mono**: IBM Plex Mono for hours totals, matricules, OTP, references. **Display**: Bodoni Moda 500/600 italic — product name, login, empty-state hero only (never in tables/forms). Loaded with `next/font/google`.
- Scale at base 16 px: `2xs 12/16` (floor) · `xs 13/18` (compact body) · `sm 14/20` (default body) · `md 16/24` · `lg 18` · `xl 20` · `2xl 24` · `kpi 32`. Weights 400 / 500 (labels, headers) / 600 (totals, titles); no 700 in tables. Headers sentence case, no uppercase tracking in French labels (eyebrows excepted).
- Numbers: always `Intl.NumberFormat('fr-FR')` (`src/lib/engine/format.ts`): `1 234 567 DZD`, `85 %`, `37,5 h`, `3,8 / 5`; em dash for null; true minus for negatives.

## 4. Shape, density, elevation
- Radius: controls `0.25em`, cards `0.375em`, blocks `0.375em`, badges/avatars `full`, inputs `0.25em`. Borders 1 px; shadows only on overlays (`shadow-md/lg/xl`, ink-tinted).
- **Density modes** (persisted per user): compact 2em row / default 2.5em / comfortable 3em; touch 3.5em at `pointer: coarse`. Header row = row height. Compact text 13 px, default 14 px.
- Hit targets ≥ 24 px (2.5.8); primary controls 44 px on coarse pointers. Focus ring `2px #1D5FA8` + 2 px white offset on every interactive element.
- Layout: sidebar 248 → 72 px, top bar 52 px (3.25em), page padding 1.5–2em, max content 1600 on wide screens (grids go full width). Page header: breadcrumb → H1 + one-line description → actions.

## 5. Planning grid, heatmap, Gantt specifics
- Geometry (default density): row 3em, block 2em, lane pitch 2.375em, sticky left column 15em (tablet 10em), 2-tier timeline header 2 × 2em. Zoom columns: jour 2.5em · semaine 6em · mois 8em · trimestre 12em; snap 0.5 j / 1 j / 1 sem / 1 sem.
- Block anatomy: 4 px status edge | icon (only if ≠ normal) | label | `60 %` | `24 h`. Width tiers 24 → icon; 48 → %; 96 → label; 160 → hours; 240 → client. Min width 24 px (WCAG target).
- **SOFT** = 45° hatch (2 px stripe / 6 px pitch) + dashed border; **HARD** = solid. **Conflict** = `conflict` 2 px border + octagon icon + cross-hatch overlay + row chip. **Exception accordée** = conflict border dashed + "Exception" tag.
- Today line 2 px `info` + header pill "Auj. 15 nov."; non-working days `#EFECE4` + hairline hatch; holidays add flag glyph + name in tooltip.
- Heatmap cell ≥ 2.5em × 2em, number shown when ≥ 2.5em wide, 1 px canvas gaps instead of borders.
- Gantt (mission page): bars 1.4em in a 2.4em row, label inside if it fits, milestones as diamonds, today line.

## 6. Components (`src/components/ui`)
Button (primary/secondary/ghost/danger/accent*) · IconButton · Input/Textarea/Select/Combobox/MultiSelect/DatePicker/Range · Switch · Slider · SegmentedControl · Tabs (layoutId underline in `primary`) · Badge / **StatusPill** (icon + label) · Avatar · Tooltip · Popover/Menu · Modal · Drawer · Wizard/Stepper · Toast (+undo) · Callout · ProgressBar/Ring · Skeleton · EmptyState · **DataTable** · KPI card · Timeline · CommandPalette · PeoplePicker · Charts (Line, Bars, Stacked, Donut, Sparkline, Heatmap) with "Voir en tableau". *`accent` (red) button exists only for the login CTA — never inside the app data zone.

Rules: all buttons through `Button`; all inputs through form components (`onChange(value)`); never re-style a variant from outside; copy in `src/content/` or domain files, not scattered literals for landing/login copy.

## 7. Logo / wordmark
- Lockup on Prussian: `sbs-logo-light.png` (height 2.25em, native aspect, never recoloured or cropped) over a **3 px `ribbon` line spanning the logo width**, then "Staffing" in Bodoni Moda 600 italic 1.25em, `side-text`. Paper backgrounds use `sbs-logo.png`.
- Collapsed sidebar and favicon: **monogram « Trame »** — three parallel 45° strokes of decreasing length, the longest in `ribbon`, the others `side-text`/`ink`. Original geometry: `M4 20 20 4 · M4 13 13 4 · M11 20 20 11`, stroke 2.5, square caps.
- Clear space = 0.5 × logo height. The PNG is never scaled below 2em height.
- The monogram sits next to (never replaces) the official logo.

## 8. Accessibility checklist baked into the system
AA contrast on all text tokens; status never colour-only; focus ring everywhere; roving tabindex in grids; `aria-live` for drop/move/undo results; every chart has a table twin; reduced-motion designs in `motion-plan.md`; hover-only affordances also on focus and persistent on coarse pointers.
