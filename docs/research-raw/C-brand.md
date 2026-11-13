# C — Brand directions for SBS Staffing & Resource Management

Research Agent C. Sources: local brand kit, baseline `globals.css`, live read of sbsfirm.org (new Chrome tab, since closed; screenshot `docs/research-raw/img/C-sbsfirm-home.jpg`). All contrast and colour-distance figures below were **computed with a node script** (WCAG 2.x relative luminance; ΔE = CIE76 in Lab, an approximation).

## 0. What the references say

- sbsfirm.org (confirmed by computed styles): Arial/Helvetica only, H1 48/700 `#050703`, body 16px `#555759`, 0px radius, centred narrow column, red `#E4042C` limited to the "Nous contacter" button, active-nav underline and the logo mark. Identity is carried by the **logo**, not the UI.
- Logo PNG: red horse/ribbon mark built from parallel diagonal stripes, Didone "SBS", condensed tagline. The light variant is monochrome beige (for ink backgrounds). At heights below ~40px the tagline is illegible; the PNG must never be recoloured, stretched or cropped.
- SBS 360°: ink sidebar + beige canvas + red budget (≤2/viewport) + Inter + Playfair + 0.25–0.375em radius.
- **Two baseline defects found by computation**, fixed in this report: (1) 360° warning text `#A8620A` on `#FFF4E0` = **4.36:1** (fails AA 4.5); (2) `border-strong #CFC9BB` is **1.5:1** on canvas (fails the 3:1 non-text rule for input boundaries). Also: red `#E4042C` as text on canvas is 4.43:1, so brand red is never small text.

## 1. Cross-cutting decisions (valid for all three directions)

### 1.1 Status colours are fixed, product-wide, and not brand-dependent
The measured problem: brand red `#E4042C` (Lab L 48, chroma 86) and the baseline danger `#B42318` (L 40, chroma 71) sit at the **same hue** (Lab hue 31° vs 38°) and only ΔE 19.9 apart. They are one glance apart on a projector. Hue cannot separate them; **lightness, saturation and structure must**.

| Semantic | Text/icon | Tint bg | Solid fill (bars, cells) | Contrast text/tint | Text on white / canvas |
|---|---|---|---|---|---|
| Normal (vert) | `#1F7A4D` | `#E9F5EE` | `#2E8B5C` | 4.75 | 5.32 / 4.88 |
| Alerte (orange) | `#9A5707` | `#FFF3DC` | `#E39A1B` | 5.11 | 5.61 / 5.15 |
| Conflit (rouge brique) | `#971B12` | `#FBECEA` | `#B3261E` | 7.37 | 8.46 / 7.77 |

Notes: conflict text `#971B12` is L 33 against brand L 48, ΔE 29.5 from brand red (the old `#B42318` was 19.9). The conflict solid fill is only ΔE 21 from brand red, which is why the rule in 1.2 is structural, not chromatic. Warn solid `#E39A1B` is 2.36:1 on white, so it is **fill-only with a dark label or icon, never a text colour**. Ink text on every tint ≥15:1. Status is never colour alone: icon (check / triangle / octagon-bang) + word + (for cells) pattern.

### 1.2 THE rule: brand red vs. conflict red
1. **Two zones.** *Identity zone* = logo, ribbon rule, active-nav marker, at most one primary CTA. *Data zone* = planning grid, heatmap, tables, KPI tiles, charts, badges, form validation. Brand red is **banned from the data zone**; status colours are banned from the identity zone.
2. **Conflict is a pattern, not just a colour:** `#B3261E` fill with 45° white hatch (2px stripe / 6px pitch) + triangle icon + the word "Conflit". Warning = solid `#E39A1B`, no hatch. Brand red never hatches.
3. Brand red is never a chart series, hover, selection, focus, or error colour. Form errors use the conflict triplet.
4. Brand red is never small text (4.27–4.43:1 on canvas). It appears as filled geometry or ≥18px/700 only.
5. Test for QA: grayscale screenshot; conflict cells must still be identifiable by hatch + icon, and the brand mark must be absent from the grid area.

### 1.3 Heatmap semantics
Ramp = **utilisation 0 → 100 %** (light = free capacity, dark = loaded), single hue, ≥6.6 ΔE per step, so it carries no status meaning. **>100 % is not on the ramp**: it is the conflict hatch over the darkest step. Label text flips from ink to white at step 6 (computed: ink ≥4.5 on steps 1–5, white ≥5.0 on steps 6–8, in B and C; in A, step 5 ink = 4.5 borderline, so flip at step 5).

### 1.4 Wordmark construction (no PNG modification)
Lockup = `[SBS logo PNG, native aspect, height 32–36px]` + 1px vertical rule (24px, `border-strong`) + product name as live text. Clear space = 0.5 × logo height. Ink backgrounds use `sbs-logo-light.png`; paper backgrounds use `sbs-logo.png`. Collapsed sidebar (72px): product monogram only, the PNG is not scaled below 32px. Product name is live text (CSS), so it can be French-accented and selectable. All SVG marks below are 24×24, `currentColor`, original geometry, square joins.

---

## 2. Direction A — « Héritage »
**Mood.** SBS 360° with a different job title: ink, paper, one hot red. Maximum family resemblance, minimal risk. "Same house, another floor."

**Palette**
| Role | Hex |
|---|---|
| canvas / surface / surface-2 | `#F7F5F0` / `#FFFFFF` / `#F3F0EA` |
| text 1 / 2 / 3 | `#16181A` / `#555759` / `#6B6E70` (16.3 / 6.7 / 4.7 on canvas) |
| border / border-strong (inputs) | `#E6E1D6` / `#8A857A` (3.37 on canvas) |
| primary action | ink `#050703` (white 20.2:1) |
| accent | SBS red `#E4042C` (white on it 4.82) |
| sidebar | ink `#050703`, text `#E9E6DE` (16.2), muted `#9A9C94` (7.3), raised `#14170F`, line `#262A20` |
| series 1–8 | `#2B5C8F` `#3D7F86` `#7A4A78` `#8C7B4A` `#5E6C7B` `#A08C99` `#C2B28A`* `#3A3D38` |
| heatmap ramp 0→100 % | `#F3F0EA` `#E2DED3` `#C9C4B6` `#A9A494` `#858073` `#5F5B50` `#3A382F` `#1A1B16` (warm taupe-to-ink) |

*series 7 is 2.09:1; use as fill only, or darken to `#9C8650` (3.54). Series avoid green/orange/red hues to stay clear of status.

**Type.** Inter (tabular numerals, `font-variant-numeric: tabular-nums`) + Playfair Display for wordmark/empty states. Both via `next/font/google`. **Shape.** 0.25/0.375em radius, borders before shadows, overlays only get shadow. Density: 36px rows, 13px text.

**Shell.** Ink sidebar 248px, white top bar 56px, red active-nav bar 3px.
```
+----------+--------------------------------------------------+
|[SBS]|Staf| Breadcrumb            ⌕ Rechercher     Sem.46 ▾  AK|  white topbar, 56
| ▌Planning|--------------------------------------------------|
|  Équipes | Planning · Semaine 46     [Filtres] [■ Affecter]   |  ■ = ink button
|  Projets | Collaborateur | L  M  M  J  V                    |
|  Charge  | Amel B.       |▓▓▓|▓▓▓|░░░|▓▓▓|///|  /// = conflit  |
|  Rapports| Karim S.      |░░░|▓▓▓|▓▓▓|▓▓▓|▓▓▓|               |
+----------+--------------------------------------------------+
 ink       warm-grey ramp cells, red only in ▌ marker
```
**Wordmark/monogram.** Light PNG + rule + "Staffing" in Inter 600. Monogram « Créneaux »: three staggered horizontal bars (a mini Gantt), `<rect x=2 y=4 w=12 h=4/><rect x=8 y=10 w=14 h=4/><rect x=5 y=16 w=10 h=4/>`; sits right of the rule, 18px, ink on paper, beige on ink.
**Red/conflict.** Rule 1.2 only; the sidebar's red marker sits right next to a red-ish data area, hardest to police.
**Weakness.** Reads as "360° with different labels": same ink sidebar, same red, same fonts. Warm-taupe ramp is the least legible (steps 2–4 look alike beside beige canvas).

---

## 3. Direction B — « Registre »
**Mood.** Ledger, not dashboard. Chrome is entirely neutral (bone, ink, graphite) so that colour exists only in data and status. Red is confined to the logo. Calm, auditor-like.

**Palette**
| Role | Hex |
|---|---|
| canvas / surface / surface-2 | `#F4F2ED` / `#FFFFFF` / `#ECE9E1` |
| text 1 / 2 / 3 | `#111310` / `#44474A` / `#62666A` (16.7 / 8.4 / 5.2) |
| border / border-strong | `#DCD8CD` / `#8A877D` (3.21) |
| primary action = accent | ink `#111310` (18.7); no hue accent; selection tint `#E4E0D4` |
| sidebar | **light**: `#EBE8DF`, text `#111310` (15.2), muted `#5A5E60` (5.35); **top bar ink** `#050703` |
| series 1–8 | `#24415F` `#5B88B2` `#6C5B9E` `#2F7C86` `#A06A7F` `#9C8650` `#6F7B88` `#34363A` |
| ramp | `#F1F3F5` `#DCE3EA` `#C0CEDB` `#9DB3C8` `#7794B1` `#52729A` `#34527A` `#1B3150` |

**Type.** IBM Plex Sans (UI, tabular figures) + IBM Plex Mono for matricules/IDs/hours columns; no display serif except in the logo (the PNG already carries the Didone). Via `next/font/google`. **Shape.** 0.125/0.25em radius (squarer than 360°), hairline rules between rows rather than cards, zero shadows except menus. Density: 32px rows, 12.5px text: the densest.

**Shell.** Structure is flipped vs 360° (ink bar on top, paper rail on the left).
```
+-----------------------------------------------------------+
| [SBS]|Staffing   Planning  Équipes  Projets  Charge   ⌕ AK| ink topbar 48
+----------+------------------------------------------------+
| Vue      | Planning · S46         [Filtres] [Affecter]     |
|  Équipe  |------------------------------------------------|
|  Projet  | Amel B.   |▓▓|▓▓|░░|▓▓|//|                       |
| Filtres  | Karim S.  |░░|▓▓|▓▓|▓▓|▓▓|                       |
| (paper)  | blue single-hue ramp, hairline rules           |
+----------+------------------------------------------------+
```
**Wordmark/monogram.** Light PNG on the ink top bar + rule + "Staffing" in Plex Sans 500, letter-spaced +0.04em, uppercase 12px. Monogram « Cellule »: 3×3 grid outline with one filled cell (`<rect x=3 y=3 w=18 h=18 fill=none stroke=currentColor stroke-width=1.5/>` + grid lines + `<rect x=9 y=9 w=6 h=6/>`): the assigned slot.
**Red/conflict.** Easiest: brand red appears nowhere but the logo PNG, so conflict is the only red in the app.
**Weakness.** Risk of "pretty but anonymous": no accent means little brand memorability; the only SBS signal is the PNG. An ink top bar with a light rail is less conventional to build (vertical space cost on already dense screens).

---

## 4. Direction C — « Trame »
**Mood.** A sibling with its own colour: Prussian ledger-ink on warm paper, a Didone product name that echoes the SBS wordmark, and a red ribbon as the single shared anchor. Looks like the same firm's other department, premium, quiet, unmistakably *not* 360°.

**Palette**
| Role | Hex |
|---|---|
| canvas / surface / surface-2 | `#F3F1EB` / `#FFFFFF` / `#EBE8DF` |
| text 1 / 2 / 3 | `#0F1424` / `#424A5C` / `#5C6478` (16.2 / 7.9 / 5.2) |
| border / border-strong | `#DEDAD0` / `#8A8B90` (3.01) |
| primary action | Prussian `#1B3358` (white 12.6; vs canvas 11.2) |
| accent | SBS red `#E4042C`, **ribbon only** (3.60 on sidebar, 4.82 on white: fine for 3:1 graphics) |
| selection tint | `#E6ECF5` (ink text 15.4) |
| sidebar | Prussian ink `#0F1A2E`, text `#E8EBF1` (14.6), muted `#9AA6BC` (7.1), raised `#172640`, line `#243554` |
| series 1–8 | `#1B3358` `#4E7BB0` `#2E8B94` `#7C5CA3` `#B0698A` `#A38F55` `#6E7A89` `#2B2F36` |
| ramp | `#EEF2F8` `#D9E2EF` `#BCCCE3` `#97B0D2` `#6F90BC` `#4A6F9F` `#2D4E7E` `#14264A` (single-hue blue; white label from step 6, 5.2–14.9) |

Series 2 and 5 are 4.4/4.0 on white; series 3/5 at ≥4.0, all ≥3:1 for marks. Series 2 teal `#2E8B94` is 40° from status green in hue and desaturated; it is also never used with a check icon.

**Type.** Geist (UI; verify `tnum` in the variable build at integration, fallback IBM Plex Sans) + Geist Mono for hour totals; **Bodoni Moda** for the product name and page-level display only (a true Didone, so "Staffing" visually rhymes with "SBS"). All in `next/font/google`. **Shape.** 0.25em controls, 0.375em cards, 1px borders, tinted hairline grid (`#E4E0D5`) as signature; faint 8px "trame" ruling on empty states. Density: 34px rows.

**Shell.**
```
+----------+--------------------------------------------------+
|[SBS]     | Planning / Semaine 46      ⌕ Rechercher       AK  |  surface topbar 52
|─red 3px──|══ 1px border ═══════════════════════════════════ |
|Staffing  | Planning   [Filtres ▾]      [■ Affecter]          |  ■ = Prussian
|(Bodoni)  |--------------------------------------------------|
| Planning | Collaborateur | L  | M  | M  | J  | V            |
| Équipes  | Amel B.       |▒▒▒▒|▓▓▓▓|░░░░|▓▓▓▓|////|          |
| Charge   | Karim S.      |░░░░|▒▒▒▒|▓▓▓▓|▓▓▓▓|▓▓▓▓|          |
+----------+--------------------------------------------------+
 Prussian    blue single-hue ramp; red = ribbon under logo only
```
**Wordmark/monogram.** Dark sidebar: `sbs-logo-light.png` (36px) over a **3px `#E4042C` ribbon** that spans the logo width (the shared anchor, an echo of the logo's red stripes without redrawing them), then "Staffing" in Bodoni Moda 600 italic, 20px, beige. Monogram « Trame »: three parallel 45° strokes of decreasing length (`<path d="M4 20 20 4M4 13 13 4M11 20 20 11" stroke=currentColor stroke-width=2.5 fill=none/>`), the longest in `#E4042C`; used collapsed (72px), favicon and loading state. Original geometry, but visibly kin to the ribbon.
**Red/conflict.** Redefined by design: red lives on exactly one 3px line in the sidebar header and the monogram's long stroke. Everything in the working area is blue/neutral + status colours, so the only large red regions anywhere are conflicts.
**Weakness.** Blue sidebar departs from "ink and red" DNA; a naive build could drift to generic SaaS blue. Guard: only Prussian `#0F1A2E`/`#1B3358` (very low chroma, L ≈ 10–23), never a bright blue, always on warm paper.

---

## 5. Recommendation: **Direction C — « Trame »**, with B's "red never touches the data zone" rule and B's density tokens

Rationale against the five criteria:

1. **Relation to SBS.** Keeps the SBS paper canvas, Didone typography (Bodoni Moda next to the logo's Didone), near-square corners, hairline-over-shadow, and the red as a deliberate single anchor. The logo PNG appears untouched. A reader recognises "SBS" in two seconds, which A achieves but B (red-less, anonymous) only barely.
2. **Difference from 360°.** A is the 360° sidebar again. C changes the sidebar hue (ink → Prussian), the primary action (ink → Prussian), the chart palette family (blue vs warm), the typefaces, and the display role (Bodoni on the product name). 360° users instantly know they changed product, which matters for people using both.
3. **Dense-data legibility.** The single-hue blue heatmap has more distinguishable steps than the warm taupe ramp (steps 2–4 of A are muddy next to beige), keeps white/ink label flip clean (5.2+ and ≥5.6), and, critically, a cool ramp is perceptually separate from the warm orange/red alert hues. Hairline grid + tabular mono hours = 34px rows readable for 8h a day.
4. **Status integrity.** Highest of the three except B: brand red occupies ~0.1 % of the screen (one ribbon line), so a red cell is always a conflict. Conflict is also pattern + icon + word, and was moved from `#B42318` to `#971B12`/`#B3261E`, bigger L gap (33 vs 48).
5. **Not generic SaaS.** Generic = white card on grey, indigo-500, rounded-xl. C is warm paper, Didone product name, red ribbon device, ledger hairlines, 0.25em corners, deep ink-blue. B is distinctive in sobriety but has no memorable device; A is distinctive only because 360° is.

Opinionated verdict: **C wins**. If the client insists "just reuse 360°" choose A with the §1 fixes (conflict colour, border-strong, red zones); never ship A without them. B is the fallback if red must be banned from the UI entirely.

### Decisions for the build team (no code here)
- Tokens to add beyond 360°: `--status-*-{text,tint,fill}`, `--ramp-1..8`, `--series-1..8`, `--hatch-conflict` (CSS repeating-linear-gradient 45°), `--border-input`.
- Fix 360° at the same time: `warning` text → `#9A5707`; input border → `#8A857A`.
- Pre-merge checks: grayscale screenshot test; ensure no `accent` utility class is allowed inside `.data-zone`; contrast table recomputed in CI.
- Screenshot reference: `/Users/macbook/Workspace/Projects/SBS2/docs/research-raw/img/C-sbsfirm-home.jpg`.
