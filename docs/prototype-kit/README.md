# Prototype Kit

Shared rules for building client-pitch prototypes with Next.js, Tailwind v4, and `motion` — distilled from prior projects so each new one starts from proven conventions instead of a blank slate.

## What's in here

```
CLAUDE.md                     ← top-level instructions, read this first
skills/
  dos-and-donts.md            ← quick-scan cheat sheet
  nextjs-architecture.md      ← structure, server/client split, buttons, forms
  tailwind-rules.md           ← units, colors, shadows, global CSS
  motion-playbook.md          ← animation tokens, API patterns, 3D, per-section planning
  analyze-reference.md        ← how to turn a client-given link into a design-system draft
```

Nothing in here is specific to any one client. Business domain, language, currency, data model, and brand colors always live in the client's own project, never here.

## How to use it for a new client project

1. Start a fresh Claude Code session in the new project's folder (a new folder under `~/Workspace/Projects/`, separate from this kit).
2. Tell Claude Code to read `~/Workspace/prototype-kit/CLAUDE.md` and the skills it points to.
3. Give it the client's brief: what they do, what the prototype needs to show, any hard constraints (language, must-have screens, deadline).
4. If there's a reference link (the client's current site, a competitor, something aesthetically close to what they want), give it the URL and ask Claude to run `skills/analyze-reference.md` first — review and approve its design-system draft before any component gets built.
5. Have Claude write that project's own `CLAUDE.md`, stating the client-specific facts and pointing back at this kit's path for everything generic.
6. Build.

## Keeping this kit current

If a rule here turns out to be wrong, too rigid, or missing something that came up in a real project, update the file here — don't just patch around it in one client's project. This kit is only useful as long as it reflects what's actually been proven to work.
