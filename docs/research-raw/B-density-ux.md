# B. Enterprise data-density UX: tokens and component rules

Scope: SBS Staffing & Resource Management (FR, DZD, desktop-first, `em`-sized, base 16 px). Every em value below is px / 16. Labels: **[S]** = taken from a source I read, **[R]** = my recommendation, **[C]** = computed by script (`scratchpad/c.js`, `f.js`, `h.js`; WCAG 2.x relative-luminance formula, Machado 2009 CVD matrices at severity 1.0, CIEDE2000).

Sources actually read: Carbon data-table style (row sizes, zebra, batch bar), WCAG 2.2 Understanding pages (2.5.7 Dragging, 2.5.8 Target Size, 2.4.13), WAI-ARIA APG Grid pattern, NN/g "Data Tables", Primer data-table guidelines, Okabe-Ito hex list (NYU Siegal lab / Wong 2011). Where a source was silent (NN/g on row height and alignment; Primer on density/sticky), I say so and mark the rule [R].

---

## 1. Dense tables

### 1.1 Row height tokens

Carbon sizes [S]: xs 24, sm 32, md 40, lg 48, xl 64 px; header row = table row size; column gutter >= 16 px; batch bar 24/32/48 px; zebra via an accent layer. NN/g and Primer give no numbers [S, silent].

| Token | Mode | px | em | Cell pad-x | Use |
|---|---|---|---|---|---|
| `--row-compact` | Compact | 32 | 2 | 12 px / 0.75em | Power users, 1440+ screens, resource lists (Carbon sm) |
| `--row-default` | Default | 40 | 2.5 | 16 px / 1em | Default for all tables (Carbon md) |
| `--row-comfortable` | Comfortable | 48 | 3 | 16 px / 1em | Tablet, touch, 2-line cells (Carbon lg) |
| `--row-touch` | Touch (auto at `pointer:coarse`) | 56 | 3.5 | 16 px | Mobile card rows / tablet when comfortable still mis-taps |
| header row | = row height, min 36 | 36 / 40 / 48 | 2.25 / 2.5 / 3 | same | Sticky, 500 weight |

Density is a **user setting persisted per user** (and per saved view), exposed as a 3-way segmented control in the table toolbar [R]. Text stays 14 px (0.875em) in Default/Comfortable, 13 px (0.8125em) in Compact. In Compact, icon buttons stay 24 px visible with a 32 px row (meets WCAG 2.5.8 min 24 x 24 [S]); interactive row controls must never be < 24 px.

### 1.2 Structure rules

| Aspect | Rule | px / em |
|---|---|---|
| Sticky header | Always on when the table scrolls. Subtle shadow when scrolled (NN/g: shadow makes frozen areas float [S]). | shadow `0 1px 0 var(--line)` + `0 2px 4px rgb(0 0 0 / .06)` |
| Sticky columns | Checkbox + first identity column (person/project, human-readable, not an ID [S NN/g]) stick left; actions column sticks right on > 8 columns. Max 2 sticky left columns. | identity col 224 / 14em (min 176 / 11em); checkbox col 40 / 2.5em |
| Row separation | **Hairlines, not zebra**, as default (zebra fights with status tints and hover states). Zebra available as an option for tables > 8 columns (Carbon uses it [S]). | hairline 1 px `--line` #D9D5CC; zebra `#F1EEE7` |
| Hover / selected | Hover `rgb(27 79 156 / .05)`; selected `rgb(27 79 156 / .09)` + 2 px left inset bar (not colour alone). | bar 2 px / .125em |
| Numeric alignment | Right-align numbers and their headers; `font-variant-numeric: tabular-nums` (Primer says the same [S]). Decimals aligned by fixed fraction digits per column. Text left. Status/icons centre. | Right pad 16 px; header sort icon goes **left** of the label on numeric columns |
| Truncation | Wrap by default where row height allows (Primer: truncation is last resort, tooltip carries full text [S]). Names: single-line ellipsis + `title`/popover; never truncate numbers (widen column or switch unit: 1 234 k). | max 2 lines in Comfortable only |
| Column minimums | Number 80 / 5em; date 96 / 6em; status chip 112 / 7em; text 160 / 10em | |
| Totals | Footer row sticky bottom, 600 weight, top border 2 px | |

### 1.3 fr-FR / DZD number formatting (verified with `Intl` in Node)

Use `Intl.NumberFormat('fr-FR', ...)` everywhere; never hand-build strings. Output observed [C]:

| Case | Call | Rendered | Notes |
|---|---|---|---|
| Integer | `fr-FR` | `1 234 567` | Separator is **U+202F** (narrow no-break), not a normal space; keeps numbers from wrapping. 4-digit numbers group too (`9 999`). |
| Decimal | `minimumFractionDigits:1` | `3,8` | Comma decimal. Ratings: `3,8 / 5` -> write `3,8` + ` / 5` |
| DZD | `style:'currency', currency:'DZD', maximumFractionDigits:0` | `1 234 567 DZD` | U+00A0 before `DZD`. (`fr-DZ` locale gives `DA`; client brief asks `DZD`, so stay on `fr-FR`.) |
| Percent | `style:'percent'` | `85 %` | U+00A0 before `%` |
| Hours | `style:'unit', unit:'hour', unitDisplay:'short'` | `37,5 h` | U+202F before `h`; the `narrow` style drops the space (`37,5h`), avoid it |

Rules [R]: DZD in tables without decimals; in KPI cards use compact notation (`12,4 M DZD`) with exact value in tooltip. Always right-align and keep unit in header, not each cell, when a column is homogeneous ("Budget (DZD)") - cells then show bare numbers. Negative: true minus U+2212 plus colour **and** the sign. Empty = em dash "-" (U+2014) in `--ink-3`, never "0" or blank.

### 1.4 Selection, bulk bar, column chooser, saved views, paging

| Item | Rule |
|---|---|
| Selection | Checkbox column 40 px. Click row = open detail; checkbox = select. Shift-click range, Cmd/Ctrl-A all on page, then "Select all N results" link. `aria-selected` on rows. |
| Bulk bar | Replaces the toolbar in place (no layout shift): height = toolbar height 48 px / 3em (Carbon: bar height matches row size, summary text left with 16 px padding [S]). Shows "3 sélectionnés", 2-4 primary actions, overflow menu, Esc/x to clear. Announce count via `aria-live="polite"`. |
| Column chooser | Popover with checkbox list **plus Move up / Move down buttons** (NN/g: don't rely on drag only; hiding/reordering must be cheap and discoverable [S]). Badge on button "Colonnes (7/12)" when columns hidden [S NN/g]. |
| Saved views | Tabs/chips above the table: view name + dirty dot when filters/sort/columns/density changed; "Enregistrer", "Enregistrer sous", "Réinitialiser". Active filters shown as removable chips (NN/g: make filtered state obvious [S]). 1-key switch `1`..`5` [R]. |
| Pagination vs virtual | <= 100 rows: render all. 100-1 000: virtual scroll (window ~ 2x viewport rows, overscan 8) with row count in footer. > 1 000 or server-side: paginate 50/100/200 (Primer's starting point is 20 rows [S] - too low for staffing lists; 50 default [R]). Keep position when returning from detail. Always show "1-50 sur 312". |

---

## 2. Planning grid with drag-and-drop

### 2.1 Geometry tokens

| Token | Compact | Default | Comfortable | em (default) |
|---|---|---|---|---|
| Resource row min height (1 lane) | 40 px | 48 px | 56 px | 3em |
| Block height | 28 px | 32 px | 40 px | 2em |
| Lane pitch (stacked overlapping blocks) | 34 | 38 | 46 | 2.375em |
| Block vertical inset | 6 | 8 | 8 | .5em |
| Block corner radius | 4 | 6 | 6 | .375em |
| Sticky left column | 200 / 12.5em | 240 / 15em | 280 / 17.5em | 15em; tablet collapses to avatar + name 160 / 10em |
| Timeline header (2 tiers) | 2 x 28 px | 2 x 32 | 2 x 36 | |

| Zoom | Column unit | Width px (em) | Snap granularity | Header tiers |
|---|---|---|---|---|
| Jour | 1 day | 40 (2.5em) | 0.5 day (4 h) | Month / day-of-month + weekday letter |
| Semaine | 1 week | 96 (6em) = ~13.7 px/day | 1 day | Month / ISO week "S12" |
| Mois | 1 month | 128 (8em) | 1 week | Year / month |
| Trimestre | 1 quarter | 192 (12em) | 1 week (visual 2 weeks) | Year / "T2" |

Zoom with `+`/`-` keys, Ctrl+wheel and a segmented control; keep the "today" date centered when zooming [R].

### 2.2 Block anatomy and minimum widths

Anatomy (left to right): 4 px **status edge** (colour + pattern) | icon (16 px, only if status != normal) | label (project short name, 500 weight 13 px) | allocation chip (`60 %`) | hours (`24 h`, tabular) | resize handles at both ends.

| Block width | Shows |
|---|---|
| < 24 px (1.5em) | Never rendered smaller: clamp to 24 px (WCAG 2.5.8 target size [S]); colour + status icon only; label in tooltip/popover and `aria-label` |
| 24-47 px | Status edge + icon dot only |
| 48-95 px (3-6em) | Allocation `60 %` |
| 96-159 px (6-10em) | Ellipsised project label + `60 %` |
| >= 160 px (10em) | Label + `60 %` + `24 h` |
| >= 240 px (15em) | Label + client + `60 %` + `24 h` + avatar |

Fill: project colour from the 7-colour series palette at 14 % tint with 1 px solid border in the full colour and ink text (contrast >= 7:1) - this stays legible on weekend shading, avoids white-on-mid-colour failures. "Soft booking" (option / non confirmé) = **diagonal hatch** `repeating-linear-gradient(45deg, c 0 2px, transparent 2px 6px)` + dashed border; "confirmé" = solid. Conflict = crimson 2 px border + triangle icon + hatch overlay (see 4).

### 2.3 Interaction feedback

| State | Visual spec |
|---|---|
| Hover | Raise 1 px shadow, show resize handles, cursor `grab` |
| Grab | Source block becomes ghost (35 % opacity, dashed outline); dragged copy 100 % opacity with `0 6px 16px rgb(0 0 0 / .18)`; 120 ms ease-out lift |
| Snap | Drop target shown as a **snap guide**: 2 px vertical lines at the new start/end + a floating label "12 mars -> 20 mars - 6 j - 48 h". Snaps with 80 ms transition; no free motion between steps. |
| Resize | 8 px visible grip, 12 px hit (24 px on coarse pointers); live width label; Alt = disable snap [R] |
| Valid / invalid row | Hovered target row tints `--ok-tint`; overload tints `--alert-tint` with live "Charge: 125 %" badge; hard conflict (leave, double booking) tints `--conflict-tint` + not-allowed cursor + shake-free, text explanation ("Congé du 14 au 16") |
| Drop | 160 ms settle; toast with **Annuler** (Ctrl/Cmd-Z) for 8 s - undo is mandatory for drag actions |
| Conflict marker | Triangle/octagon icon pinned top-right of block + red-hatched overlap region; also an entry in a "Conflits (3)" panel with jump-to links |
| Today line | 2 px solid `--info` (#1D5FA8, 5.92:1 on warm canvas [C]) with a pill "Auj. 13 nov." at the header; does not rely on hue because it is the only full-height solid vertical line |
| Weekend | `#EFECE4` fill (subtle 1.08:1; decoration only) + diagonal 1 px hairline pattern for non-working days; **Fri/Sat** are the weekend in Algeria - make the working-week a firm setting [R] |
| Holidays | Same as weekend + a 12 px flag glyph and name in the day tooltip; holiday column header gets a dot |

### 2.4 Non-drag alternatives (WCAG 2.5.7, AA)

WCAG 2.5.7 requires a **single-pointer, non-dragging** way to do anything dragging does; a keyboard alternative alone does not satisfy it [S: "Keyboard access is evaluated separately"]. Listed pass patterns: select item then press arrow buttons; context menu to move; click start then click end [S]. Spec [R]:

1. **Click-click**: click empty cell = start, click second cell = end -> creates/moves a block (popover with project, % and hours, numeric entry).
2. **Block popover** (click or Enter): fields Début / Fin / % / Ressource, steppers `-1 j` `+1 j` `-1 sem` `+1 sem`, "Déplacer vers..." resource combobox. Satisfies 2.5.7 and touch.
3. **Keyboard**: focus block -> `Enter` opens popover; `M` enters move mode: arrows move by snap unit, `Shift+arrows` by 5 units, `Enter` commits, `Esc` cancels, live-region announcement "Marie K., 12 au 20 mars, charge 85 %". `R` = resize mode (arrows change end, Shift+arrows change start).
4. **Touch**: long-press 350 ms to lift (with haptic where available) plus the popover as default tap action; two-finger pan/pinch for scroll/zoom; edge auto-scroll zone 48 px.

---

## 3. Heatmaps and Gantt legibility

Four ordered availability states must differ in **lightness first** (so they survive greyscale and CVD), then carry an icon/pattern and a text value. Cleveland-McGill ranking (position > length > colour area) is the reason numbers stay in the cell [R].

| State | Range of load | Fill | Text | Text contrast [C] | Pattern/icon | Label |
|---|---|---|---|---|---|---|
| Disponible | 0-49 % | `#E6EFF7` | `#1B2A3A` | 12.55:1 | empty circle | "Dispo" |
| Partiel | 50-84 % | `#A9C8E3` | `#10253A` | 8.95:1 | half circle | "Partiel" |
| Plein | 85-100 % | `#3A78B0` | `#FFFFFF` | 4.67:1 | filled circle | "Plein" |
| Surchargé | > 100 % | `#9C1C3C` | `#FFFFFF` | 7.94:1 | triangle-alert + 45deg hatch | "Surchargé" |

CVD check [C] (deuteranopia / protanopia, CIEDE2000 between adjacent states): 13.4 / 11.8, 27.7 / 25.1, 38.7 / 30.8 - all clearly separable (>= ~10). The first step is the weakest (light on lighter); the empty-circle vs half-circle icon covers it. The hue jump to crimson on the last step is deliberate (diverging "break" at 100 %), plus hatch and icon.

Cell rules [R]: heat cell min 40 x 32 px (2.5em x 2em) at week zoom, **never below 24 x 24**; show the number (`85`) in every cell >= 40 px wide, otherwise only the icon; thresholds are configurable but the legend is always visible (4 swatches with name + range) and clickable to filter. Tooltip: person, week, `34 h / 40 h (85 %)`, and projects. Gridlines between cells 1 px of the canvas colour (white gaps) rather than borders. Never use a rainbow scale; the single-hue blue ramp encodes quantity and the red encodes a violation.
Gantt (NN/g source was not retrievable for Gantt specifics; rules are [R]): bars 20-24 px high in a 36-40 px row, label inside if it fits else outside right, dependencies as 1.5 px orthogonal lines with arrowheads, critical items marked by icon + label, not red alone; progress as a darker inset bar plus "60 %" text.

---

## 4. Status system (green / orange / red + icon + label)

Computed on white `#FFFFFF`, warm canvas `#F7F5F0`, and the status's own tint (chip background). All text/icon uses >= 4.5:1 [C].

| Status | Hex (fg) | on white | on #F7F5F0 | Tint bg | fg on tint | Icon shape | Label (FR) | Chart marker / dash |
|---|---|---|---|---|---|---|---|---|
| Normal (ok) | `#097160` | 5.93 | 5.44 | `#E3F1EC` | 5.10 | circle-check | "Normal" / "OK" | solid line, circle marker |
| Alerte | `#AA4F0E` | 5.48 | 5.03 | `#FBEBD9` | 4.69 | triangle-alert | "Attention" | dashed (6 3), triangle marker |
| Conflit / urgent | `#9C1C3C` | 7.94 | 7.29 | `#FBE3E8` | 6.52 | octagon-x (stop sign) | "Conflit" | dotted (1.5 3) thick, square/diamond marker |
| Info | `#1D5FA8` | 6.45 | 5.92 | `#E3EDF8` | 5.45 | circle-info | "Info" | solid, circle |
| Neutre | `#586069` | 6.38 | 5.85 | `#ECEEF0` | 5.48 | circle-dash | "Brouillon" | solid thin |

**Why not the "obvious" green/orange/red.** My first trio (`#17694A`, `#A8510A`, `#B3261E`) collapsed under CVD: alert vs conflict CIEDE2000 = 3.9 in deuteranopia [C], i.e. indistinguishable. A search over hue-constrained candidates maximising minimum CVD distance moved green toward teal and red toward crimson (blue-shifted), and the final trio scores:

| Pair | Normal vision | Deuteranopia | Protanopia |
|---|---|---|---|
| ok vs alert | 45.7 | 25.6 | 19.2 |
| ok vs conflict | 57.9 | 15.0 | 14.7 |
| alert vs conflict | 25.6 | 14.6 | 23.0 |

(dE00 >= ~10 = clearly separable; < ~5 = confusable.) Simulated appearance (deut): ok `#606061` grey, alert `#7F7109` olive, conflict `#625A39` brown - ok is distinguished by being cooler/greyer; alert/conflict mainly by lightness and hue. Therefore **colour is never the only carrier**: the three shapes differ in silhouette (circle / triangle / octagon), each has a text label, chips have different border styles (solid / solid / 2 px double), and charts add dash + marker.

Hatch for soft booking: use the project colour at 45 degrees, 2 px stripe / 6 px period; the hatch means "provisoire", not a status colour. Overbooked overlap uses a **cross-hatch** (two directions) in crimson at 35 % opacity.

---

## 5. Typography for tabular figures

| Role | Family | Why |
|---|---|---|
| UI primary | **Inter** (Google Fonts, variable, `next/font/google`, subsets `latin`, `latin-ext`) | Proportional by default, so enable `tnum`; `zero` gives slashed zero; large weight range; full French diacritics [S: Inter feature list - rsms.me]. |
| Alternative | **IBM Plex Sans** (Google Fonts) | More characterful, tabular figures and slashed-zero style options; use if the pitch needs a less generic look. Verify `tnum`/`zero` in the served subset. |
| Mono / IDs | **JetBrains Mono** or Plex Mono | Matricules, codes |
| Arabic (if added) | Noto Sans Arabic / IBM Plex Sans Arabic | Algerian users may mix scripts; plan `dir` support |

Caveat: sources disagree on what `ss01`/`ss02` do in Inter; do not rely on them, test glyphs [S]. Whether the Google-hosted subset keeps every OpenType feature must be checked in the built CSS (I could not confirm this for `next/font`) - fallback is self-hosting the Inter woff2 via `next/font/local`.

```css
.num, td.num, .kpi { font-variant-numeric: tabular-nums slashed-zero;
  font-feature-settings: "tnum" 1, "zero" 1, "cv05" 0; }  /* tnum everywhere numbers align */
body { font-feature-settings: "calt" 1, "kern" 1; }       /* proportional in prose */
```

Type scale (base 16 px) [R]:

| Token | px | em | Line-height | Weight | Use |
|---|---|---|---|---|---|
| `--t-2xs` | 12 | .75 | 1.33 (16) | 500 | Floor: axis ticks, chip text, badge (never below 12) |
| `--t-xs` | 13 | .8125 | 1.38 (18) | 400/500 | Compact table body, block labels |
| `--t-sm` | 14 | .875 | 1.43 (20) | 400 | Default table body, form inputs |
| `--t-md` | 16 | 1 | 1.5 (24) | 400 | Prose, drawer content |
| `--t-lg` | 18 | 1.125 | 1.33 | 600 | Section titles |
| `--t-xl` | 20 | 1.25 | 1.3 | 600 | Page titles |
| `--t-2xl` | 24 | 1.5 | 1.25 | 600 | Dashboard hero |
| `--t-kpi` | 32 | 2 | 1.1 | 600 | KPI numbers, tabular |

Weights: 400 body, 500 headers/labels/block labels, 600 totals and titles; avoid 700 in tables. Table headers: sentence case 13 px/500 `--ink-2`; letter-spacing 0 (no uppercase tracking in French long labels). Secondary text `--ink-3` must be >= 4.5:1: `#636A74` is 5.46 on white / 5.01 on warm / 4.71 on zebra [C] (the first draft `#6B7280` was only 4.44 on warm - fails; do not use it).

Core text tokens [C]: `--ink #1B1F24` 16.56 white / 15.20 warm; `--ink-2 #4A5058` 8.14 / 7.47; `--ink-3 #636A74` 5.46 / 5.01; focus `#1D5FA8` 6.45 / 5.92.

---

## 6. Keyboard-first workflows

| Area | Spec |
|---|---|
| Command palette | `Cmd/Ctrl+K`; fuzzy search over navigation, people, projects, and actions ("Affecter Karim a Projet X"); recent items first; shows shortcut hints; supports verbs and `>` for commands, `@` for people, `#` for projects [R, Linear/Notion/Airtable-style]. Opens as a modal dialog with focus trap, `role="combobox"` + `listbox`, `aria-activedescendant` for the results. |
| Shortcuts | Single-key shortcuts only when no input focused and **customisable/disable-able** (WCAG 2.1.4). Global: `?` cheat-sheet, `/` focus search, `g` then `p/r/c` go to Planning/Ressources/Clients, `n` new, `Cmd+Z` undo, `[` / `]` previous/next period, `t` today, `+`/`-` zoom, `d` cycle density. Show chips with `kbd` styling (12 px, 1 px border, 4 px radius). |
| Grid focus model | APG data grid: one tab stop, arrows move cell-by-cell, Home/End row ends, Ctrl+Home/End grid corners, PageUp/Down by a page of rows, Enter/F2 enters a cell widget and Esc returns, focus stops at edges (no wrap) [S]. Implement with **roving tabindex** (`tabindex=-1` on all cells, `0` on the active) - simpler for virtualised grids and screen readers than `aria-activedescendant` [R]. |
| ARIA | Table: `role="grid"` on `<table>` (row/cell roles implied), `aria-labelledby` caption, `aria-sort` on sorted header, `aria-selected` on rows, `aria-rowcount`/`aria-rowindex` and `aria-colcount`/`aria-colindex` when virtualised, `aria-readonly` for read-only cells [S]. Planning timeline: `role="grid"`, rows = resources, cells = day/week slots; blocks are `button`s inside cells with `aria-label="Projet X, 60 pour cent, du 12 au 20 mars, conflit"`; `aria-describedby` for rules; `aria-live="polite"` region for drop/move/undo results. |
| Focus ring | `outline: 2px solid #1D5FA8; outline-offset: 2px;` plus inner `box-shadow: 0 0 0 1px #fff`; 3:1 vs adjacent (5.92 on warm, 5.57 on zebra [C]); use `:focus-visible`. 2.4.13 Focus Appearance is AAA (>= 2 px thick perimeter, 3:1 change [S]) - we meet it anyway. Sticky header/first column must not cover the focused cell: `scroll-padding-top: 2.5em; scroll-padding-left: 15em` (WCAG 2.4.11 Focus Not Obscured, AA in 2.2 [R, level from my knowledge of the spec]). On dark or hatched blocks add the white inner ring. |
| Drag alternatives | See 2.4. |
| Escape/undo | Every destructive or moving action is undoable; Esc always closes the topmost layer and returns focus to its trigger. |

---

## 7. Chart marks

| Mark | Spec |
|---|---|
| Line width | Series 2 px (hover 3 px), reference/target 1 px dashed (4 3), forecast 2 px dashed (6 4), axis 1 px, **gridline 1 px** |
| Markers | 6-8 px, white 1.5 px halo; shape per series (circle, square, diamond, triangle, cross, star) |
| Bars | Corner radius 2 px (top only), bar gap 25-35 % of band, min height 2 px for non-zero, zero-baseline mandatory, 1 px white separator between stacked segments |
| Gridlines | `#E4E0D7` at full opacity on warm = ~1.2:1 (deliberately quiet); horizontal only; none on categorical axes; baseline axis `#8F8A7E` 3.16:1 on warm [C] |
| Axis text | 12 px `--ink-2`, tabular; max 5-6 y ticks; fr-FR formatted; units in axis title not tick labels |
| Direct labels | Label last point/bar end with series name (ink text, not coloured, with a 6 px colour swatch) - removes legend lookup; leader line if collision |
| Legend | Only when direct labelling impossible (> 5 series or stacked); top-left above plot; entries are toggle buttons (aria-pressed), 24 px min height; order = visual order of series at the right edge |
| Tooltip | Opens on hover **and** keyboard focus of a mark; content: header (period), per-series row with swatch + shape + value (tabular); max 6 rows, then "+ N autres"; dismissible with Esc; non-obscuring; pinned on click; also accessible as persistent text for touch |
| View as table | Every chart has "Voir en tableau" toggle (segmented control "Graphique / Tableau") rendering the same data in a real table; chart gets `role="img"` + `aria-label` summary, with the table as accessible equivalent; CSV export |
| Colour use | Single hue for magnitude; categorical series palette below; never > 7 series (group "Autres" in grey) |

### Series palette (7) - validated on warm canvas `#F7F5F0` and white [C]

Marks need >= 3:1 (WCAG 1.4.11); series text labels use ink not the series colour.

| # | Hex | on warm | on white | deut sim | prot sim | Marker |
|---|---|---|---|---|---|---|
| 1 Bleu | `#1B4F9C` | 7.29 | 7.94 | `#004c9a` | `#22579f` | circle |
| 2 Orange | `#CC6A08` | 3.42 | 3.73 | `#9f8d05` | `#877600` | square |
| 3 Vert-teal | `#188069` | 4.45 | 4.85 | `#6e6e6b` | `#7b7768` | diamond |
| 4 Magenta | `#B8458F` | 4.50 | 4.90 | `#71788c` | `#506591` | triangle |
| 5 Ocre | `#8A6A00` | 4.65 | 5.07 | `#80720a` | `#796900` | cross |
| 6 Ardoise | `#3C424B` | 9.30 | 10.13 | `#3e414b` | `#3f424b` | star |
| 7 Autres | `#6F7783` | 4.15 | 4.52 | - | - | hollow circle |

Lowest pairwise CIEDE2000 across normal/deut/prot: 2-5 orange vs ocre = 5.2 (weakest, so they get different marker, dash, and are never adjacent), 1-4 = 7.8, 4-7 = 9.5, everything else >= 12 [C]. This is an Okabe-Ito-derived set (orange, bluish green, blue, reddish purple, yellow-ochre [S]) darkened so every mark passes 3:1 on the warm canvas; Okabe-Ito yellow `#F0E442` and sky blue were dropped because they fail 3:1. Alternate encoding to hold: when > 3 series are drawn, add dash/marker variation, not only hue.

---

## 8. Touch, tablet, mobile

| Breakpoint | Table behaviour |
|---|---|
| >= 1280 | Full grid, Default density, all columns, sticky first col |
| 1024-1279 (tablet landscape) | Comfortable rows (48), hide 2-3 lowest-priority columns (column priority metadata), sticky identity column narrowed to 176 px, row actions into kebab, hit targets >= 44 |
| 768-1023 (tablet portrait) | Comfortable; max 5 columns + "Détails" disclosure; planning grid week/month zoom only, left column 160 px, block popover primary interaction |
| < 768 (mobile) | **Card collapse**: each row -> card (title row: identity + status icon+label; 2-column key/value grid for 3-4 priority fields tabular right-aligned; "Voir plus" expander; actions in bottom sheet). Card min height 72 px (4.5em), padding 16 px, gap 8 px. Sort/filter become bottom-sheet; selection via long-press then checkboxes. Never horizontal-scroll an entire dense table on mobile unless it is a deliberate read-only matrix with sticky first column. |
| Touch targets | WCAG 2.5.8 minimum 24 x 24 [S]; **ours: 44 x 44 hit area** for primary controls, 48 for row tap targets (use pseudo-element padding to enlarge hit areas without enlarging visuals) |
| Planning on mobile | Read-first: agenda list per person for the day/week; edit via popover only (no drag); heatmap shown as 7-cell week strips with icon+number; pinch zoom disabled in favour of the zoom segmented control |
| Mobile 5 screens (suggested) | Tableau de bord, Mes affectations, Disponibilité (strips), Détail projet, Approbations - all card-based |
| Hover-only affordances | Anything revealed on hover must also be available on focus and persistently on `pointer:coarse` |

---

## Component rules cheat-sheet

1. **Row heights**: Compact 32 / 2em, Default 40 / 2.5em, Comfortable 48 / 3em, touch 56 / 3.5em; header = row. Density is per-user and per-view.
2. **Text**: 14 px (.875em) body, 13 px (.8125em) compact, nothing under 12 px (.75em); weights 400/500/600.
3. **Numbers**: right-aligned, `tabular-nums slashed-zero`, `Intl.NumberFormat('fr-FR')`; U+202F groups, `1 234 567 DZD`, `85 %`, `37,5 h`, `3,8 / 5`; unit in header for homogeneous columns; em dash for null.
4. **Separation**: hairlines `#D9D5CC`; zebra optional only for wide tables; selected = tint + 2 px bar.
5. **Sticky**: header, checkbox + identity (224 px) left, totals bottom; shadow on scroll; `scroll-padding` so focus is never hidden.
6. **Bulk bar**: replaces the toolbar in place, 48 px, count + <= 4 actions + overflow, `aria-live`.
7. **Column chooser**: checkboxes + move up/down buttons; badge shows hidden count. Saved views as chips with dirty indicator.
8. **Paging**: <= 100 render all; 100-1 000 virtualised; > 1 000 server-paged 50/100/200.
9. **Planning grid**: row 48 (3em), block 32 (2em), left col 240 (15em); columns 40/96/128/192 px for jour/semaine/mois/trimestre; snap 0.5 d / 1 d / 1 w / 1 w.
10. **Block**: edge + icon + label + `%` + `h`; widths 24 / 48 / 96 / 160 / 240 px reveal icon / % / label / hours / client. Hatch = provisoire; crimson border + octagon = conflit.
11. **Drag**: ghost + snap guide + live date label; undo toast 8 s; every drag has click-click, popover steppers, and keyboard `M`/`R` modes (WCAG 2.5.7).
12. **Today / weekend**: 2 px `#1D5FA8` today line with pill; Fri-Sat shaded `#EFECE4` + hairline hatch; holidays flagged with icon and name.
13. **Heatmap**: 4 ordered states (`#E6EFF7`, `#A9C8E3`, `#3A78B0`, `#9C1C3C`), each with number + icon + name; thresholds 50 / 85 / 100 %; cell >= 40 x 32, never < 24.
14. **Status**: ok `#097160` circle-check, alert `#AA4F0E` triangle-alert, conflit `#9C1C3C` octagon-x; always icon + FR label; charts add dash + marker. All >= 4.5:1 on white, warm, and tint.
15. **Focus**: 2 px `#1D5FA8` ring, 2 px offset, `:focus-visible`; roving tabindex in grids; `?` opens shortcut sheet; `Cmd+K` palette.
16. **Charts**: line 2 px, bar radius 2 px (top), gridlines 1 px `#E4E0D7` horizontal only, direct labels, <= 7 series from the validated palette with different markers, tooltip on focus, "Voir en tableau" toggle.
17. **Responsive**: >= 1280 full; tablet comfortable + fewer columns; < 768 cards, bottom sheets, 44 px targets, planning edited via popover only.
18. **Never**: colour as only signal; drag as only input; truncated numbers; hover-only controls; text under 4.5:1; row heights below 32 px on touch.

### Gaps / assumptions
- NN/g, Primer, Carbon pages did not state numeric-alignment or Gantt/heatmap specifics; those rules are [R]/industry convention.
- Contrast and CVD figures are computed approximations (Machado simulation, not clinical); validate final art in a CVD simulator in Figma/browser DevTools.
- Weekend = Friday/Saturday for Algeria should be confirmed with the client.
