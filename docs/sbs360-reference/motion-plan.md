# SBS 360° — Motion plan (per kit §4)

**Hero object:** the *synthesis* — a living radar of the six competencies inside a framed A4-like card, with a quota ring and one anonymous "feedback" chip beside it. It is the product's output, so the whole page orbits it.

## Landing
| Section | Signature moment | Micro | RM design |
|---|---|---|---|
| Navbar | — | active pill `layoutId`, hide-on-scroll-down, progress hairline | no hide, no progress |
| Hero | Headline masked-line reveal → the hero card "assembles": radar polygon draws (pathLength + fill fade), vertices pop in order, quota ring sweeps, floating feedback chips settle. CSS 3D tilt follows the pointer (springs). | magnetic CTA, spotlight on card edge | static final state |
| Cycle strip (4 steps) | Sticky scroll: a rail fills with scroll, each step swaps the right-hand visual (open cycle → feedback → synthesis → archive) | step number crossfade | all steps stacked |
| Anonymity | **Two-lane diagram**: named lane keeps the author→recipient line drawn; anonymous lane's line *breaks* mid-way and disappears (pathLength + dash) | lock icon settle | static diagram |
| Profiles (persona cards) | Cards fan in; hover = spotlight + capability lines reveal; click = shared-element expand into the app (page transition fade) | tilt (hover-only) | none |
| Guarantees / Stats | count-ups, once | — | final numbers |
| FAQ / Footer | still | accordion 180ms | — |

## Back-office (quiet)
Sidebar: width spring (`spring.ui`), label fade, active bar + pill via `layoutId`, section labels collapse. Top bar: hide nothing; notification popover scale/fade 8px. Pages: 180ms fade/translate page swap, list stagger ≤ 40ms, tabs `layoutId` underline. Charts: first-view draw only (radar polygon, line pathLength, bars scaleY from baseline with transform-origin, rings stroke-dashoffset via pathLength), then static. Toasts spring-in. Wizard step transitions: directional slide 24px + fade.

All durations/easings/springs from `src/lib/motion-tokens.ts`. `MotionConfig reducedMotion="user"` + `useReducedMotion()` branches on every flagship.
