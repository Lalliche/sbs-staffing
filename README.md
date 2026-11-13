# SBS Staffing & Resource Management (prototype)

Second, **independent** SBS product (separate from SBS 360°). A client-pitch **prototype**: Next.js 16 · TypeScript · Tailwind v4 · `motion` · no backend (state in `localStorage`, deterministic seed). UI in French, code in English, all data fictional.

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # Vitest — engine, seed storylines, actions, selectors
npm run lint
npm run build
```

Start at `/` (login / persona entry), then use the demo bar (top): *Voir en tant que*, *Scénario*, *Avancer le temps*, *Simuler une demande*, *Visite guidée*, *Réinitialiser* (`Ctrl+Maj+D` hides it).

Read `CLAUDE.md` (architecture, rules, status), `docs/ux-research.md`, `docs/design-system.md`, `docs/motion-plan.md`, and the source of truth `docs/SBS_STAFFING_PROTOTYPE_SPEC_v1.md`. Module interface contract: `docs/MODULE_CONTRACT.md`. Raw research reports: `docs/research-raw/`.
