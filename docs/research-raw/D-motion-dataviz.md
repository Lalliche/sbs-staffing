# D — Motion + data-viz plan (SBS Staffing & Resource Management)

Scope: a tool used for hours daily. Rule of thumb from the kit (frequency decides animation): **entrance can delight once; everything repeated is 100-200 ms or static.** Tokens extend `src/lib/motion-tokens.ts` (seconds, `motion/react`, `MotionConfig reducedMotion="user"`).

## 0. Evidence used (and its limits)
- NN/g: most UI animation 100-500 ms, simple feedback ~100 ms, modals 200-300 ms, >400 ms only for large travel, exits shorter than entrances, "far more common to be too long than too short" ([NN/g](https://nngroup.com/articles/animation-duration)).
- Carbon: *productive* motion (data tables, dropdowns, micro-interactions) is subtle and fast; *expressive* is reserved for alerts/notifications. Durations 240 ms (expansion/toast), 400 ms (large expansion), 700 ms (dimming). Productive standard curve `cubic-bezier(0.2,0,0.38,0.9)`, entrance `(0,0,0.38,0.9)`, exit `(0.2,0,1,0.9)` ([Carbon](https://carbondesignsystem.com/elements/motion/code/)). Our app = productive; login/first-view charts = expressive.
- WCAG 2.3.3 (AAA): non-essential interaction-triggered motion must be disableable; `prefers-reduced-motion` is the sufficient technique C39 ([W3C Understanding](https://w3c.github.io/wcag/understanding/animation-from-interactions.html)). Apple HIG: honour Reduce Motion by minimizing/replacing (crossfade), scaling/spinning/peripheral motion are the dizziness triggers ([Apple HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion.md)).
- Heer & Robertson 2007: animated transitions help perception when they preserve *object constancy* (a mark = a data tuple) and stay simple ([paper](https://homes.cs.washington.edu/~jheer/files/2007-AnimatedTrans-InfoVis.pdf)). So: animate filter changes only as a short morph of the same marks, never re-draw.
- Motion docs: use motion values rather than React state to avoid re-renders; `dragControls` + `dragListener={false}` for handle-only drag ([Motion](https://motion.dev/docs/react-reorder)).
- Not verified from primary sources (Linear/Vercel/Stripe internals, Material 3 tokens, Datawrapper/FT guidance): treated as convention/judgement below, marked "(judgement)".

## 1. Login / persona entry (<= 1.8 s, never blocks input)

**Signature: "the grid assembles."** A faint 5-row x 12-col week grid sits behind the persona cards; 9-11 mission blocks slide into their rows (x from -1.5em, opacity 0 -> 1), row by row; the last block "snaps" with a single ring-flash. It says "scheduling" with zero decoration. (Capacity ring is kept for the in-app dashboard, not here: one signature per section.)

| t (ms) | Element | Motion | Duration | Ease |
|---|---|---|---|---|
| 0 | Wordmark + headline | opacity, y 0.5em | 380 | out |
| 80 | Grid lines | opacity 0 -> 0.5 (static after) | 300 | out |
| 160-860 | Blocks (6 rows, 60 ms/row, blocks in a row +25 ms) | x -1.5em -> 0, opacity | 420 each | outExpo |
| 700 | Last block snap | outline ring opacity 0 -> 1 -> 0 | 360 | out |
| 520-1160 | Persona cards (stagger 70 ms) | y 0.75em, opacity | 420 | out |
| **end ~1.6 s** | | cards/CTAs interactive from t=0 (pointer-events never disabled) | | |

- **Card hover** (gated `(hover:hover) and (pointer:fine)`): y -2px (0.125em), border colour to accent, top accent bar `scaleX 0->1` origin-left, 160 ms out; role description line `opacity 0.6->1`. No tilt/scale >1.02 (tool, not landing). Press `scale(0.98)` spring.press. Focus-visible: same as hover + ring.
- **Select**: chosen card holds, others `opacity 0.4` 160 ms, then route change with page-enter (section 2). Total <= 300 ms.
- **Reduced motion**: grid + blocks render in final position; whole page = single opacity fade 240 ms; hover = border/background colour only; no ring flash (static).

## 2. Quiet app motion

| Pattern | Spec (ms / values) | Notes |
|---|---|---|
| Page transition | **enter only**: opacity 0->1, y 0.25em->0, 180 ms `out`; no exit | Exit animations with the Next App Router are fragile and slow. Keyboard-initiated nav: opacity only (drop `y`). Replaces the 400 ms `pageSwap` for in-app use. |
| List/row stagger | step 30 ms, cap 10 items (300 ms max), 200 ms/item, y 0.25em | **Only first mount of a route**; never on sort/filter/pagination (set `initial={false}`). |
| Tabs underline | `layoutId`, spring ui (visualDuration 0.25, bounce 0); panel crossfade 140 ms | |
| Sidebar collapse | width spring {k 380, c 36, m 1} (~280 ms); labels opacity 100 ms, delayed 60 ms on expand, none on collapse | The **one** documented width exception (single element). Below `lg`: translateX drawer instead. |
| Popover/menu | in 140 ms scale .98->1 + opacity, origin = trigger; out 100 ms | |
| Modal | overlay 160 ms; panel 220 ms scale .98 + y .5em; out 140 ms | |
| Drawer | x 100%->0, 280 ms `drawer`; out 200 ms `in`; reduced = 160 ms fade | |
| Toast | spring toast {k 400, c 30, m 1}, y 1em; exit 160 ms; auto-dismiss 5 s (undo: 8 s, pause on hover/focus); stack via `layout="position"` | |
| Skeleton -> content | show skeleton only if load >150 ms, keep >=250 ms (no flash); shimmer = translateX of gradient 1.4 s linear; content crossfade 160 ms; reserve exact dimensions | Reduced: static tint, no shimmer. |
| Count-up | 700 ms `outExpo` (kit's 1.6 s is too long for daily use); **first view per session per KPI id**, max 4 per screen; refilter = set value instantly (or 120 ms opacity dip 0.6->1) | `tabular-nums`, sr-only final value. |
| Table row hover | bg colour in 60 ms, out 120 ms; no transform | CSS only. |
| KPI update flash | overlay layer opacity 0 -> 0.10 -> 0, 600 ms, neutral accent (not red/green); delta chip colour changes instantly | Reduced: keep (opacity-only) at 0.06. |
| Keyboard actions | none beyond focus ring | kit rule. |

## 3. Planning-grid interaction (drag/resize)

| Moment | Behaviour |
|---|---|
| Pickup | after 4 px move (or 120 ms hold on touch): scale 1.02, shadow = pre-blurred sibling layer opacity 0 -> 1 (no box-shadow animation), 120 ms. Cursor `grabbing`. |
| Ghost | origin slot stays: opacity .35 + 1px dashed outline. Dragged block follows pointer **1:1 (no spring on position)**; z-index above rows. |
| Target preview | an outline "slot" jumps cell-to-cell with spring target {k 700, c 45, m .6} (overdamped, ~90 ms). Valid = accent, invalid = danger dashed. Updates only when the **cell index changes**. |
| Drop (valid) | block springs to cell {k 520, c 38, m .8}; scale 1.02 -> 1; success: ring flash opacity 0->.8->0 in 360 ms; toast "Affectation deplacee - Annuler" (undo 8 s, Ctrl/Cmd+Z). |
| Conflict | on drop onto overload/overlap: block returns to origin (same spring), **shake** x keyframes [0,-4,4,-3,3,0] px (amplitude 0.25em, 280 ms, `inOut`), danger outline stays 1.2 s, inline message in `aria-live="polite"`. **Reduced**: no shake, no travel; outline pulse opacity 0.2<->1 x2 (600 ms) + colour + message. |
| Resize | 8px hit area, visible 2px bar fades in on block hover (120 ms); width driven by a MotionValue on the single active block (layout-property exception), snaps to column on `pointerup` (spring snap), column readout chip follows. |
| Auto-scroll | edge zone 48 px; speed = ((zone - dist)/zone)^2 x 18 px/frame @60 Hz (dt-normalised, ~1080 px/s max); rAF only while pointer in zone; writes `scrollLeft/Top` directly. Reduced motion: halve max speed (scroll is user-driven, keep). |

**Performance (40 rows x N blocks)**
- One `pointermove` listener on the grid with `setPointerCapture`; cell = arithmetic on cached rect (`floor((x - left + scrollLeft)/cellW)`), no hit-testing, rect re-read on resize/scroll only.
- Position lives in `useMotionValue` x/y; React state changes **only** on cell change (store with `useSyncExternalStore` selector per row, so only source row + target row re-render).
- `React.memo` rows and blocks; stable ids; `content-visibility:auto; contain: layout paint` per row; virtualise past ~60 rows.
- `touch-action:none` on the handle only; transform/opacity only; no `getBoundingClientRect` in rAF; conflict check memoised per (block, cell).

```ts
// useBlockDrag.ts - motion values, state only on cell change
const x = useMotionValue(0), y = useMotionValue(0), lift = useMotionValue(0);
const scale = useTransform(lift, [0, 1], [1, 1.02]);
const shadowOpacity = lift; // pre-blurred sibling layer
function onPointerDown(e: React.PointerEvent) {
  e.currentTarget.setPointerCapture(e.pointerId);
  start.current = { px: e.clientX, py: e.clientY, rect: gridRect() }; // read once
}
function onPointerMove(e: React.PointerEvent) {
  if (!start.current) return;
  const dx = e.clientX - start.current.px, dy = e.clientY - start.current.py;
  if (!dragging.current && Math.hypot(dx, dy) < 4) return;
  if (!dragging.current) { dragging.current = true; animate(lift, 1, { duration: dur.base / 2 }); }
  x.set(dx); y.set(dy);                                   // no React state
  const cell = cellAt(e.clientX, e.clientY);              // arithmetic
  if (cell !== lastCell.current) { lastCell.current = cell; gridStore.setTarget(cell); } // discrete
}
async function onPointerUp() {
  const t = gridStore.target();
  const ok = t && !hasConflict(block, t);
  animate(lift, 0, { duration: dur.fast });
  await Promise.all([animate(x, ok ? t.dx : 0, snap), animate(y, ok ? t.dy : 0, snap)]);
  if (ok) commitMove(block.id, t); else reduce ? pulseOutline() : shake(el);
}
```

## 4. Chart animation - first view only

Rules: draw once per session per chart id (module-level `Set`, optional `sessionStorage`) when >= 40% in view; afterwards static. Data change = marks keep identity and morph <= 180 ms (or none for >200 points). Never replay on tab switch, filter, resize, or re-mount.

| Chart | Animation | Duration | Ease | Stagger/cap |
|---|---|---|---|---|
| Line | `pathLength 0->1`, area fill opacity 0->.08 after | 900 | inOut | dots fade at end 200 |
| Bars | `scaleY 0->1`, `transform-origin: bottom` (SVG: `transformBox:"fill-box"`) | 500 | outExpo | 25 ms/bar, total cap 400 |
| Stacked bars | whole bar scaleY (not segment-by-segment when >6 bars); <=6 bars: segments bottom-up 60 ms | 500 | outExpo | bar step 40 ms, cap 400 |
| Donut | **one** mask circle `pathLength 0->1` (-90deg) reveals all segments | 800 | outExpo | single track |
| Heatmap | cell opacity 0->1, delay = (col+row) x 10 ms, cap 400 ms | 220 | out | wave |
| Threshold lines | draw after data, `scaleX` 0->1 | 300 | out | +100 after marks |
| Sparkline (KPI) | pathLength 600 ms; only when count-up plays | 600 | inOut | |
| Data change | marks y/height via animate | **<= 180** | out | none |

```tsx
// first-view-only Bars. initial={false} on re-render = no replay; changes morph 160ms.
const seen = new Set<string>();
export function Bars({ id, data, h }: Props) {
  const ref = useRef<SVGGElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const play = !reduce && !seen.has(id);
  useEffect(() => { if (inView) seen.add(id); }, [inView, id]); // not React state
  return (
    <g ref={ref}>
      {data.map((d, i) => (
        <motion.rect key={d.key} x={d.x} width={d.w} y={d.y} height={d.h}
          style={{ transformOrigin: "50% 100%", transformBox: "fill-box" }}
          initial={play ? { scaleY: 0 } : false}
          animate={inView || !play ? { scaleY: 1, y: d.y, height: d.h } : undefined}
          transition={play && !seen.has(id)
            ? { duration: chart.bar, ease: ease.outExpo, delay: Math.min(i * 0.025, 0.4) }
            : { duration: chart.morph, ease: ease.out }} />
      ))}
    </g>
  );
}
```
(`y/height` morph on data change is a deliberate small-area exception; prefer `scaleY` on a fixed-height rect when the chart has a fixed y-domain.)

## 5. Reduced-motion table and motion budget

| Feature | Normal | `prefers-reduced-motion` |
|---|---|---|
| Login signature | grid assembles 1.6 s | final state, 240 ms opacity |
| Page / modal / popover | opacity + 0.25-0.5em y/scale | opacity only, 120-160 ms |
| Drawer / sidebar | slide / width spring | fade / instant toggle |
| List stagger | 30 ms steps | none (single fade) |
| Count-up | 700 ms | final value |
| Chart first view | draw / scale / wave | static final, 200 ms opacity |
| Data morph | <=180 ms | instant |
| Drag | scale + shadow + springs | no scale; outline + shadow opacity, instant snap |
| Conflict shake | +-4 px x3 | outline pulse (opacity) + colour + aria-live text |
| Toast | spring y | opacity fade |
| Skeleton shimmer | translateX loop | static tint |
| KPI flash | opacity .10 | opacity .06 (kept) |
| Auto-scroll | 1080 px/s max | 540 px/s |
| Hover | colour/translate 2px | colour only |

**Motion budget (rules)**
1. <= **3 concurrent animation tracks** per viewport (e.g. page enter + one chart + one count-up group); a stagger counts as one track, capped at **24 animated nodes** and **<= 400 ms** total spread.
2. <= **2 charts** drawing at once (second starts +100 ms); the rest are static.
3. **One signature moment per screen**; a route's total entrance <= 900 ms, interactive at t=0.
4. Infinite loops: skeleton shimmer only, paused off-screen; none otherwise.
5. During drag/resize: all ambient motion (flash, count-up, shimmer) is suppressed.
6. Anything repeated more than ~10x/hour is <= 160 ms or CSS-only.

## 6. Chart anatomy conventions (dense dashboard)

- **KPI card**: label (12 px, muted) / value (`tabular-nums`, 24-28 px) / delta chip (text + arrow, never colour alone) / sparkline 28 px tall x ~96 wide, no axes, 1.5 px stroke, last-point dot, area 8%. Sparkline `aria-hidden`; a real sentence carries the trend ("+4 pts vs. sem. precedente") (judgement; consistent with Tufte's sparkline idea of small word-embedded graphics).
- **Direct labels**: series name at line end (nudge >= 12 px apart; <= 5 series) instead of legends; legend only for stacked categories, as clickable filter chips.
- **"Voir en tableau"**: toggle button (`aria-pressed`) top-right of every chart card; swaps chart for a `<table>` of the same data (`tabular-nums`, sticky header), 120 ms crossfade, state remembered per chart; also the print/export source. Extend beyond the radar to all charts (known gap).
- **Tooltip/crosshair**: crosshair = 1 px line snapped to nearest x (bisect), driven by a MotionValue, no state; readout panel follows with no delay; hover card appears after **150 ms** enter delay, **100 ms** hide delay, never covers the hovered mark; touch = tap to pin, tap outside to dismiss; keyboard: arrow keys move crosshair.
- **Threshold lines**: **60 % under-use** = dashed neutral, label "Sous-utilisation 60 %"; **100 % overload** = solid danger + label, plus 4 % danger tint above the line. Labels sit on the right inside the plot; encoded by dash + text + icon, not only colour.
- **Capacity vs demand (stacked bars)**: capacity = outlined ghost bar or step line (1.5 px, no fill); demand = stacked fills by project type; demand above capacity = **deficit segment with 45-degree hatch** (SVG `<pattern>`, 4 px, danger colour) + 1 px danger cap; hatch survives colour-blindness and monochrome print. Surplus capacity shown as light dotted fill.
- **Utilisation heatmap**: single-hue sequential steps aligned to thresholds (<60, 60-85, 85-100) and a hatched danger cell for >100; numbers in cells when cell >= 36 px; row/col totals in the margin.
- Axis: <= 4 y ticks, light gridlines (6 % opacity), x labels thinned automatically; zero baseline always present for bars.

## 7. Paste-ready tokens (additive to existing `motion-tokens.ts`, seconds)

| Group | Token | Value |
|---|---|---|
| dur (ms) | micro 120, fast 160 (exists), base 240 (exists), page 180, popover 140, popoverOut 100, modal 220, modalOut 140, drawer 280, drawerOut 200, toastOut 160, sheen 360 | |
| dur chart | line 900, bar 500, donut 800, heatCell 220, morph 160, threshold 300 | |
| dur other | countFirst 700, shake 280, flash 600 | |
| ease | productive `[0.2,0,0.38,0.9]`, enter `[0,0,0.38,0.9]`, exit `[0.2,0,1,0.9]` (Carbon) + existing out/outExpo/inOut/drawer/in | |
| stagger (s) | rows 0.03, bars 0.025, heat 0.01, personas 0.07, caps: items 10, ms 400, nodes 24 | |
| springs (k, c, m) | sidebar 380/36/1; toast 400/30/1; dragSnap 520/38/0.8; dragTarget 700/45/0.6; tilt etc. exist | |

```ts
export const dur2 = { micro: 0.12, page: 0.18, popover: 0.14, popoverOut: 0.1, modal: 0.22, modalOut: 0.14,
  drawer: 0.28, drawerOut: 0.2, toastOut: 0.16, ring: 0.36, countFirst: 0.7, shake: 0.28, flash: 0.6 } as const;
export const chart = { line: 0.9, bar: 0.5, donut: 0.8, heatCell: 0.22, morph: 0.16, threshold: 0.3 } as const;
export const easeApp = { productive: [0.2, 0, 0.38, 0.9], enter: [0, 0, 0.38, 0.9], exit: [0.2, 0, 1, 0.9] } as const;
export const stagger2 = { rows: 0.03, bars: 0.025, heat: 0.01, personas: 0.07 } as const;
export const cap = { items: 10, spreadMs: 400, nodes: 24, concurrentTracks: 3, concurrentCharts: 2 } as const;
export const physical = {            // useSpring / transition spring configs
  sidebar:    { type: "spring", stiffness: 380, damping: 36, mass: 1 },
  toast:      { type: "spring", stiffness: 400, damping: 30, mass: 1 },
  dragSnap:   { type: "spring", stiffness: 520, damping: 38, mass: 0.8 },
  dragTarget: { type: "spring", stiffness: 700, damping: 45, mass: 0.6 },
} as const;
export const shakeKeyframes = { x: [0, -4, 4, -3, 3, 0] } as const; // px; swap for outlinePulse when reduced
```
CSS mirrors (`@theme inline`): `--ease-productive: cubic-bezier(0.2,0,0.38,0.9); --ease-enter: cubic-bezier(0,0,0.38,0.9); --ease-exit: cubic-bezier(0.2,0,1,0.9);`
