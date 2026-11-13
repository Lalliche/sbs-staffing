# SBS 360° — Talent & Performance (client prototype)

Client: **SBS — Sovereign Business & Strategy** (cabinet de conseil, Algérie). Built by SOLRUS as a pitch prototype of a mission-by-mission feedback platform. Showcase only: **no backend**, all data lives in `localStorage` (a cookie stores the active persona). Deployed later as-is.

## Read before coding

Generic rules live in the shared kit, copied into this repo at `docs/prototype-kit/` (original: `~/Workspace/prototype-kit/`).

| Task | Read |
|---|---|
| Any UI work | `docs/prototype-kit/skills/dos-and-donts.md` |
| Structure, server/client split, buttons, forms | `docs/prototype-kit/skills/nextjs-architecture.md` |
| Units, colors, shadows, global CSS | `docs/prototype-kit/skills/tailwind-rules.md` |
| Animation | `docs/prototype-kit/skills/motion-playbook.md` + `docs/motion-plan.md` |
| Product behaviour, every screen, data model | `docs/SBS360_PROTOTYPE_SPEC_v2.md` (source of truth) and `docs/CDC_SBS360_officiel.md` |
| Brand values | `docs/design-system.md` (derived from sbsfirm.org, see `docs/reference-analysis.md`) |

Next.js here is **16.4** (`node_modules/next/dist/docs/` is the reference; `AGENTS.md` says the same). Motion is `motion@14` — import from `"motion/react"`.

## Conflict order (client project overrides the kit)

1. The brief from the user + `SBS360_PROTOTYPE_SPEC_v2.md`.
2. `docs/design-system.md`.
3. Kit skills.

### Deliberate overrides of the kit

- **TypeScript**, not `.jsx`: the spec requires a typed data model, `engine.ts` and unit tests.
- **`em` sizing via the Tailwind v4 scale**: `globals.css` sets `--spacing: 0.25em`, and the radius/text tokens in `em`, so `p-4` = `1em`, `gap-2` = `0.5em`, `h-10` = `2.5em`. This keeps the kit's "everything scales from the body font-size" rule without writing `p-[1em]` 4,000 times. Arbitrary values are still used when the scale has no step. Never use `px` for spacing/size (borders ≤ 2px excepted).
- **Body size**: `text-[15px] xl:text-[16px]` (not the kit's 12px mobile base) so the dense back-office stays readable on phones; UI base text is `0.875em`.
- The default Tailwind palette is **wiped** (`--color-*: initial`); only tokens from `design-system.md` exist.
- The spec's navy/blue palette is **replaced by the SBS brand** extracted from sbsfirm.org (ink `#050703`, red `#E4042C`, warm beige). The spec's *structure* (density, tokens roles, red used sparingly) is kept.
- Content: the app UI is French and its copy is mostly in `src/lib/store/seed.ts` and `src/content/`. Landing + app chrome strings live in `src/content/`. Short UI labels inside app screens may be inline when they are pure labels (back-office), landing copy never is.

## Hard product rules (from the spec — never break)

- Every clickable thing does something visible (navigate / overlay / state / toast). No native `alert/confirm/prompt`.
- One store (`src/lib/store`), persisted in `localStorage`, seeded deterministically. **Every figure on screen is computed by selectors.**
- No self-evaluation, **no weights, no overall score**, no certification claims, no link with SBS's annual-evaluation tool (Talentéo is mentioned only in the one calm note on the synthesis).
- Anonymity is architectural: `AnonymousFeedback` has no author field; the function that writes it never receives the author id; `engine.test.ts` asserts it.
- Roles enforced via `can(user, action, resource)`; navigation, content and buttons change per role.
- UI language French; code and comments English. Relative dates from the **demo clock** (`state.now`), never `Date.now()`.

## Stack

Next 16 (App Router, React 19) · Tailwind v4 · `motion` · `lucide-react` · custom SVG charts (animated with Motion) · Vitest for `engine`/anonymity tests. No UI kit dependency: primitives in `src/components/ui`.

## Routes

```
/                       landing + entry page (profile cards enter the app)
/app/accueil            home per role
/app/feedback/nouveau   feedback wizard (full screen)
/app/demandes           my requests
/app/feedbacks          my feedbacks (received / sent)
/app/missions[/id]      missions
/app/equipe[/id]        team follow-up + collaborator page (Responsable)
/app/syntheses[/id]     synthesis list + editor
/app/cycles[/id]        cycles (RH)
/app/suivi              follow-up & reminders (RH)
/app/feedback-client    client links (RH)
/app/collaborateurs     directory
/app/competences        competencies & questions
/app/messages           notifications / templates / history
/app/journal            admin log
/app/utilisateurs       users & roles (Admin tech)
/app/parametres         settings
/app/aide[/anonymat]    help
/c/[token]              public client page (mobile-first, outside shell)
```

## Commands

`npm run dev` · `npm run build` · `npm run lint` · `npm test`

## Status (end of session 1)

Built and verified (`npm run build`, `npm run lint`, `npm test` all pass; 14 engine/anonymity tests):
landing (Motion-heavy), app shell (animated sidebar, top bar, ⌘K, notifications, demo bar with persona / scenario / time travel / simulate / client preview / reset, guided tour), Accueil ×4 roles, feedback wizard, Mes demandes, Mes feedbacks, Missions (+detail), Suivi de l'équipe (+collaborator page), Synthèses (radar, table, editor, AI panel, validation, PDF preview/print), Cycles (+automatic archiving), Suivi & rappels, Feedback client (wizard, drawer, public `/c/[token]`), Collaborateurs (+import wizard), Compétences & questions, Messages, Journal, Utilisateurs, Paramètres (visibility matrix + live « Voir en tant que… »), Aide & anonymat.

Known gaps / next passes:
- Visual QA only done at ~1440 desktop and a 390 px spot check; 1280 / 1920 / tablet passes still to do.
- "Voir en tableau" exists on the radar only (not on the line chart).
- Stubs (toast "Aperçu"): adding a question, logo upload, CSV/PDF real files, backup restore.
- Skeleton / empty / error states are present on main lists but not exhaustive.
- Keyboard + focus pass done on primitives; full a11y audit pending.
