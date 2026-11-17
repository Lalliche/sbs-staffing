# SBS Staffing & Resource Management (client prototype)

Client: **SBS — Sovereign Business & Strategy** (cabinet de conseil et d'audit, Algérie). Second, **independent** SBS product (the first is SBS 360°, folder `../SBS`). Built as a pitch prototype: **no backend**, one client-side store persisted to `localStorage`, deterministic seed, every number computed by selectors. UI in French, code in English, data fictional.

Source of truth: `docs/SBS_STAFFING_PROTOTYPE_SPEC_v1.md`. Brand/UX: `docs/ux-research.md`, `docs/design-system.md` (tokens), `docs/motion-plan.md`. Raw research: `docs/research-raw/`. Generic rules: `docs/prototype-kit/` (read `skills/dos-and-donts.md` first). Sibling reference: `docs/sbs360-reference/`.

Next.js is **16.4** (`node_modules/next/dist/docs/` is the reference; `AGENTS.md` says the same). Motion is `motion@14` — import from `"motion/react"`.

## Conflict order
1. The user's brief + the spec. 2. `docs/design-system.md`. 3. Kit skills.

### Deliberate overrides of the kit
- **TypeScript** (typed data model, pure engine, unit tests).
- **`em` scale via Tailwind**: `--spacing: 0.25em` so `p-4` = 1em; radius/text tokens in `em`. No `px` for spacing/size (borders ≤ 2px excepted; a few documented exceptions: grid geometry computed in JS).
- Body size `text-[15px] xl:text-[16px]`; UI base text `0.875em`.
- Default Tailwind palette wiped (`--color-*: initial`); tokens only (`docs/design-system.md`).
- Brand: direction **« Trame »** (Prussian ink on warm paper, IBM Plex Sans, Bodoni Moda product name, red ribbon only). **Brand red (`ribbon`) never appears in the data zone**; status colours (ok/alert/conflict) never in the identity zone.
- Algerian week: offices work **Sunday→Thursday**; weeks start Sunday (settings per office).

## Hard rules (never break)
1. No dead buttons, no empty pages; out-of-demo features open a small « Aperçu » overlay. No native `alert/confirm/prompt`.
2. One store (`src/lib/store`). **Every number is computed by a selector/engine function** — never hard-code a figure.
3. Business rules live ONLY in `src/lib/engine/*` (pure, unit-tested). UI never computes capacity, utilization, conflicts, scores or forecasts.
4. Every write goes through an **action** (`src/lib/store/actions*`) which checks `can()`, mutates a draft, writes an **AuditLog** row and (when relevant) a notification.
5. RBAC: `can(state, user, perm, resource)` from `engine/permissions.ts`, editable matrix in `state.rolePermissions`; used by routes (Guard → 403), menus, buttons, actions AND selectors. Sensitive fields (dailyCost, dailyRate, budgets) are **stripped in selectors** for roles without the permission.
6. Dates are ISO strings relative to the demo clock `state.now` — never `Date.now()` / `new Date()` in business code.
7. Matching never invents skills/experience; AI answers come from selectors, cite their source, and never assign anything by themselves.
8. Scope (client meeting, Nov 2026): the product keeps dashboard, planning, missions, staffing requests, collaborateurs (import from the client's HR system), capacity, analytics/reports and admin. Marketplace, timesheets, leave/availability workflow, the Compétences module and Évaluations were **removed**. Skills stay as data on each employee (matching, requests, capacity); approved absences (`state.leaves`) stay as read-only data feeding planning, capacity and matching.
9. No real people or client names; data labelled fictional (« Version de démonstration — données fictives »).
10. Do NOT add a remote, push or deploy. Dev server on **port 3000**; stop it by killing only the PID on that port (`lsof -ti :3000 -sTCP:LISTEN | xargs kill`), never `pkill -f "next dev"`.

## Architecture
```
src/lib/engine/    PURE functions + tests: dates, capacity, utilization (planned only), matching, conflicts, booking,
                   forecast, workmode (présentiel / à distance), permissions, audit, format, memo, ids
src/lib/store/     types.ts · seed.ts (deterministic, 4 scenarios) · store.ts (useSyncExternalStore + localStorage)
                   actions/*.ts (writes) · selectors/*.ts (reads, RBAC-aware) · hooks.ts
src/components/ui  primitives (Button, Overlay, Toast, Popover, Tabs, DataTable, FormInputs, Surface …)
src/components/charts · motion · app (shell) · <module>/…
src/app/           login (/) and /app/** routes
```
Module contract for parallel work: a module owns `src/app/app/<route>/**`, `src/components/<module>/**`, `src/lib/store/selectors/<module>.ts`, `src/lib/store/actions/<module>.ts`. It may READ any engine/selectors but must not edit `types.ts`, `seed.ts`, `store.ts`, `engine/*` or `components/ui/*` (ask the integrator).

## Routes
`/` login & persona entry · `/app/accueil` dashboard · `/app/planning` · `/app/missions[/id]` · `/app/demandes[/id]` · `/app/collaborateurs[/id]` · `/app/capacite` · `/app/analytics` · `/app/notifications` · `/app/admin/*` (utilisateurs, roles, referentiels, regles, audit, donnees, ia) · `/app/aide`

## Commands
`npm run dev` (port 3000) · `npm run build` · `npm run lint` · `npm test`

## Status / known gaps
*Updated at the end of every phase.*

- **Phase 0 (done):** research by 4 parallel agents → `docs/ux-research.md`, `docs/design-system.md`, `docs/motion-plan.md` (raw reports in `docs/research-raw/`). Direction « Trame » chosen.
- **Phase 1 (done; timesheet/leave/real-utilization parts were removed in Phase 9):** pure engine + unit tests (capacity, utilization planned/real/billable, matching + blocking, conflicts, soft→hard, leave, timesheets, forecast « Déficit : 2 Seniors », RBAC, audit); typed store + deterministic seed (40 people, 15 missions, 4 scenarios, storylines asserted by tests); RBAC-aware selectors; design tokens, UI primitives, app shell, demo bar, login.
- **Phases 2–8 (done; marketplace, timesheets, leave, skills and evaluations screens were removed in Phase 9; UI built by the integrator after the parallel module agents hit an account usage limit; their selectors/actions for people, skills, evaluations, timesheets, projects, requests survived and are used):** dashboards per role + chart library · missions (list, 4-step wizard, 8-tab page) + matching drawer (scorecards, blocking, compare, soft/hard, exception modal) · planning grid (3 lenses, 4 zooms, drag/resize, popover steppers, keyboard M/R, heatmap mode, conflict dialog, undo) · leave workflow + availability calendar · staffing requests (queue, state machine, detail) · timesheets (weekly grid, validation, anomalies, traced correction) · marketplace · notifications centre · collaborateurs (list, import wizard, form, 10-tab fiche) · skills (referential, advanced search, matrix) · evaluations (light) · capacity (what-if, sliders, recruitment needs) · analytics (14 reports, CSV/Excel/print) · admin (users, live roles matrix, rules with live ranking preview, audit viewer, referentials, data, AI settings) · SBS Staffing Intelligence (deterministic router + CV validation flow) · help.
- Commands: `npm test` (100+ tests), `npm run lint` (0 errors), `npm run build` (green).

- **Phase 9 (done, after the client meeting):** scope reduction + **présentiel / à distance**. Removed: marketplace, timesheets, leave/availability workflow, Compétences module, Évaluations (routes, components, actions, selectors, engine `timesheet`/`leave`, state fields `timesheets/entries/evaluations/opportunities/applications`, orphan permissions and the two timesheet hour limits). Utilization is now **planned only** (no real/billable). Added work mode: `Employee.remoteWeekdays` (usual remote weekdays) + `state.workModes` (one-day overrides); pure `engine/workmode.ts` (`presenceOn`: OFF → ABSENT → override → usual pattern); actions `setWorkMode` / `setUsualRemoteDays` (perm `workmode.edit`, audited); selectors `selectors/presence.ts` (perm `workmode.view`, scope-aware); UI: dashboards (« Présence aujourd'hui »), planning (today icon by each name + dashed line on remote days, toggle « Jours à distance »), employee page tab « Présence » (click a day to toggle), people list column + filter, mission tab « Présence », analytics report « Présence », AI intent « Qui est sur site ? ». `STATE_VERSION` = 4. **Collaborator view:** `isSelfView(state)` (selectors/core) is true when the viewer can only see their own record; then « Collaborateurs » becomes « Mon profil » (nav group « Mon espace », breadcrumb, ⌘K) and `/app/collaborateurs` renders their own `Fiche` in a self layout (hero card, editable « Ma présence », « Mes missions en cours ») instead of the directory table.

### Known gaps (honest list)
- Visual QA done at the Chrome window available (≈1568×773 screenshot frame of a 2560 px viewport) — 1280/1440/1920/tablet passes are not exhaustive; mobile layouts for Accueil / timesheets / congés / marketplace / notifications rely on responsive classes and were not visually verified on a phone.
- Planning: `Jour` / `Semaine` zooms are the polished ones; `Mois` / `Trimestre` use a coarse snap (7 days). Virtualisation is not implemented (40 rows are fine). Keyboard `M`/`R` modes move by whole days only.
- « Aperçu » only: security previews, theme/logo upload, notification-template editor (read-only list), password reset.
- Presence has no bulk editor (one day per click, or `setWorkMode` with several dates from code); the usual pattern (`setUsualRemoteDays`) has an action and tests but no screen yet.
- Absences are read-only seed data: there is no screen to add or approve leave any more.
- Mission page « Planning » tab is a simple Gantt (phases, milestones, team bars).
- No automated component/e2e tests: engine, seed storylines, actions, selectors and AI router are unit-tested.

### Gotchas found so far
- `@theme inline` does not emit variables that no utility uses (`--font-sans`): body font is set from `--font-ui` directly.
- Pages that pass icon components to UI must be client components.
- The engine's per-state memo cache (`engine/memo.ts`) is invalidated by `audit()`/`refreshStatuses()`; call `invalidate(state)` after mutating a state object in place in tests.
- Bump `STATE_VERSION` (`store/blank.ts`) whenever the seed changes, otherwise browsers keep the previous localStorage state.
