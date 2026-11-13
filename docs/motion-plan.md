# SBS Staffing — Motion plan

Derived from agent D's report (`research-raw/D-motion-dataviz.md`), the kit's playbook and the 360° plan; tuned for **a tool used for hours a day**. Frequency decides: entrances may delight once; anything repeated is ≤ 160 ms or static. All numbers live in `src/lib/motion-tokens.ts`. `MotionConfig reducedMotion="user"` plus explicit `useReducedMotion()` branches on the flagship moments.

**Hero object:** the *planning grid* — the one picture that says "staffing". It appears at the login (assembling) and is the only place with physical interaction (drag, snap, conflict).

## Login / persona entry (≤ 1.6 s, never blocks input)
"The grid assembles": a faint 6-row × 12-column week grid sits behind the persona cards; 9–11 department-coloured blocks slide into their rows (x −1.5em → 0, opacity), row by row (60 ms/row); the last block snaps with a one-time ring flash; persona cards stagger in (70 ms). Cards/CTAs are interactive from t = 0. Card hover (fine pointer only): lift 0.125em, top Prussian bar `scaleX 0→1`, 160 ms. Select: others dim to 0.4, page enters. **Reduced:** final state, single 240 ms opacity fade, no flash.

## Quiet app motion
| Pattern | Spec |
|---|---|
| Page transition | enter-only: opacity + y 0.25em, 180 ms; keyboard nav opacity only |
| List stagger | 30 ms steps, cap 10, first mount only, never on sort/filter/page |
| Tabs | `layoutId` underline, spring ui; panel crossfade 140 ms |
| Sidebar | width spring (documented single exception to transform-only); labels opacity 100 ms |
| Popover / modal / drawer | 140 / 220 / 280 ms in; 100 / 140 / 200 ms out |
| Toast | spring in; 5 s (undo 8 s), pause on hover/focus |
| Skeleton | only if load > 150 ms, hold ≥ 250 ms; shimmer 1.4 s (static under reduced motion) |
| Count-up | 700 ms, **first view per session per KPI**, max 4 per screen; refilter sets the value instantly |
| KPI update | 600 ms neutral flash (opacity 0→0.1→0) |
| Row hover | colour only, 60 ms in / 120 ms out |

## Planning-grid interaction
Pickup after 4 px (scale 1.02, pre-blurred shadow layer opacity, 120 ms); origin slot stays as a 35 % ghost with dashed outline; dragged block follows the pointer **1:1**; a target outline jumps cell-to-cell with an overdamped spring only when the cell index changes; floating label "12 nov. → 20 nov. · 6 j · 48 h". Drop: spring snap + success ring (360 ms) + toast `Annuler` (8 s, ⌘Z). **Conflict:** block returns to origin with a ±4 px shake (280 ms) and a danger outline for 1.2 s; the engine's reason is announced in `aria-live`. **Reduced:** no travel, no shake — outline pulse ×2 (600 ms) + colour + text. Resize: 8 px visible grip (12 px hit), width driven by a motion value on the one active block. Auto-scroll within 48 px of edges (quadratic ramp, rAF only while in zone; halved under reduced motion). Performance: one pointermove listener with pointer capture, arithmetic cell lookup, React state only on cell change, memoised rows/blocks, `content-visibility: auto` per row.
**Non-motion alternatives (WCAG 2.5.7):** click-click placement, block popover with steppers, keyboard `M`/`R` modes — all without animation.

## Charts — first view only
Draw once per session per chart id when ≥ 40 % in view, then static. Line `pathLength` 900 ms (area fades after); bars `scaleY` from baseline 500 ms, 25 ms stagger capped at 400 ms; donut one masked `pathLength` 800 ms; heatmap cells fade in a diagonal wave (10 ms/step, cap 400 ms); threshold lines draw last (`scaleX`, 300 ms). Data change = ≤ 160 ms morph or none. Never replay on tab switch, filter, resize or remount.

## Budget and reduced-motion table
≤ 3 concurrent tracks per viewport, ≤ 24 animated nodes per stagger, ≤ 2 charts drawing at once, one signature moment per screen, ambient motion suppressed during drag. Reduced motion: login → opacity fade; page/modal/popover → opacity only 120–160 ms; drawer → fade; sidebar → instant; stagger → none; count-up → final value; charts → static + 200 ms opacity; drag → outline + instant snap; shake → outline pulse; shimmer → static tint; auto-scroll halved.

## Tokens (see `motion-tokens.ts`)
Durations (s): micro .12 · fast .16 · base .24 · page .18 · popover .14 · modal .22 · drawer .28 · toastOut .16 · ring .36 · countFirst .7 · shake .28 · flash .6; chart: line .9 · bar .5 · donut .8 · heatCell .22 · morph .16 · threshold .3. Easings: `out [0.23,1,0.32,1]`, `outExpo [0.16,1,0.3,1]`, Carbon productive `[0.2,0,0.38,0.9]`, enter `[0,0,0.38,0.9]`, exit `[0.2,0,1,0.9]`. Springs: sidebar 380/36/1, toast 400/30/1, dragSnap 520/38/0.8, dragTarget 700/45/0.6. The kit's 1.6 s count and 1.4 s draw are **shortened** for in-app use (agent D's recommendation, accepted).
