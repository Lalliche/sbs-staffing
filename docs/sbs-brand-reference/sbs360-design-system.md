# SBS 360° — Design system

Derived from sbsfirm.org (see `reference-analysis.md`), tuned for a calm back-office. Structure follows `SBS360_PROTOTYPE_SPEC_v2.md` §5.

## Principles
Institutional, precise, warm. Paper-beige canvas, ink for structure, **one red accent with a budget** (≤ 2 uses per viewport: logo mark, active-nav bar, one CTA, critical highlight). Data is the hero; chrome is quiet. Corners are **nearly square** (SBS signature) — radius 0.125–0.375em, pills only for badges/avatars.

## Tokens (`@theme` in `globals.css`)
| Token | Value | Use |
|---|---|---|
| `bg` | `#FFFFFF` | cards, tables, inputs |
| `canvas` | `#F7F5F0` | app background |
| `paper` | `#F3F0EA` | landing bands, subtle fills |
| `paper-deep` | `#E7E1D4` | borders on paper, hover fills |
| `ink` | `#050703` | headings, sidebar, primary buttons |
| `ink-soft` | `#1A1D17` | sidebar raised surfaces |
| `text` | `#16181A` | body |
| `text-secondary` | `#555759` | secondary |
| `text-muted` | `#77797A` | meta, placeholders |
| `border` | `#E6E1D6` | hairlines (warm) |
| `border-strong` | `#CFC9BB` | inputs |
| `accent` | `#E4042C` | SBS red |
| `accent-soft` | `#FDEBEE` | red tint fill |
| `success` / bg | `#1F7A4D` / `#EAF6EF` | |
| `warning` / bg | `#A8620A` / `#FFF4E0` | |
| `danger` / bg | `#B42318` / `#FEF1EF` | |
| `info` / bg | `#1D4E89` / `#EBF1F9` | |
| Series | ensemble `ink`, responsable `accent`, pairs `#2F6F5E`, équipe `#B7791F` (dashed), archive `#9A978E` (dotted) | charts — always +marker shape +dash |

## Type
- **UI / body:** Inter (variable), tabular numerals for every figure. Scale (em at 16px base): 12 / 13 / 14 (base) / 16 / 20 / 24 / 32.
- **Display (landing + empty hero moments only):** Playfair Display 600–700 — echoes the Didone "SBS" wordmark. Never inside tables/forms.
- Weights 400/500/600. Headings `text-balance`, tracking −0.01 to −0.03em on display.

## Surfaces
Borders before shadows (`1px solid border`). Shadows only for overlays and the landing hero object (`--shadow-lg/xl`, warm-tinted). Radius: controls `0.25em`, cards `0.375em`, badges/avatars `full`.

## Layout
Sidebar 248px→72px collapsed (ink, animated), top bar 56px, content max 1440, padding 2em. Page header: breadcrumb → H1 + one-line description → actions. Details in spec §5.3/§5.5.

## Components (src/components/ui)
Button · IconButton · Input/Textarea/Select · Badge/StatusPill · Avatar(+Stack) · Tabs (layoutId underline) · Modal · Drawer · Toast · Tooltip · Switch · SegmentedControl · Skeleton · EmptyState · DataTable · ProgressRing/Bar · KPI · Callout. Charts (src/components/charts): Radar, LineChart, Bars, Donut, Sparkline.
