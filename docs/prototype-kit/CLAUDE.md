# Prototype Kit — shared rules for client-pitch prototypes

This is a **shared, reusable kit**, not a project of its own. It holds the conventions that have proven out across prior client prototypes (Next.js, Tailwind v4, `motion`) — UI architecture, styling discipline, and motion/aesthetic craft — so a new client prototype doesn't start from a blank slate.

**This file and the files in `skills/` never contain anything specific to one client.** The moment something client-specific needs to be written down (currency, language, business domain, data model, brand colors), it belongs in that client's own project folder, not here.

## How a new project uses this kit

For each new prototype, the user will typically provide:
1. **A client spec/brief** — functionalities wanted, business domain, any hard constraints (language, must-have screens, timeline).
2. **Optionally, a reference link** — the client's current solution, a competitor, or a site whose aesthetic should inform the new one.

When starting a new client project, tell Claude Code to read this file and the relevant skills below, then hand over the brief (and link, if any). The new project should get its **own** `CLAUDE.md` that:
- States the client-specific facts (domain, language, currency, stack versions if pinned, data model, route map) — mirror the structure of a prior project's `CLAUDE.md` for the pattern, not the content.
- References this kit's path (e.g. `Read before coding` table pointing at `~/Workspace/prototype-kit/skills/*.md`) so future sessions on that project know where the generic rules live.
- Explicitly states any override: if the client's own brief conflicts with a generic rule here (e.g. a different breakpoint scale, a non-`em` sizing convention the client insists on), the client's own file wins.

## Read before coding

| Task | Read |
|---|---|
| Any UI work | `skills/dos-and-donts.md` — the quick-scan cheat sheet |
| Structure, server/client split, buttons, forms | `skills/nextjs-architecture.md` |
| Units (`em`), colors, shadows, global CSS | `skills/tailwind-rules.md` |
| Animation / 3D | `skills/motion-playbook.md` |
| A reference link was given (current site, competitor, inspiration) | `skills/analyze-reference.md` — **read this first**, before any of the above, when a link exists |

## Conflict order

1. The client's own brief / spec (explicit instructions from the person paying for this prototype always win).
2. The client project's own `design-system.md` / brand values, once established (often itself derived from `analyze-reference.md`'s output).
3. The client project's own screens/behavior spec.
4. This kit's skills (`dos-and-donts.md`, `nextjs-architecture.md`, `tailwind-rules.md`, `motion-playbook.md`) — the generic "how to write the code" layer.
5. This file, only for anything not covered above.

## What this kit is for

The goal of every prototype built with this kit is to look and feel like a real, premium product within a short build window — distinctive enough per-client (via `analyze-reference.md` and genuine per-project motion planning in `motion-playbook.md` §4) that two prototypes built from this kit should not look like templated siblings of each other. The architecture/styling/motion *discipline* is shared; the *aesthetic result* is not.

## What this kit is not

- Not a component library to import from — there's no shared `node_modules` package here. Each client project implements its own `src/components/ui` following the patterns described, because a real client deliverable should be a self-contained repo.
- Not a source of client data, copy, or business rules. Never carry assumptions, sample data, or domain terminology from one client project into another.
- Not a place to accumulate project-specific exceptions. If a rule here stops fitting most projects, revise the rule; don't leave client-specific carve-outs in these files.
