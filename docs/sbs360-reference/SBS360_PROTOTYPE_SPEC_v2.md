# SBS 360° — Prototype Specification v2.1 (Mission Feedback)

> **v2.1 — aligned with the CDC of 12 Nov 2026 (`Proposition SBS - Contrat.pdf`, `CDC_SBS360_officiel.md`).** The changes versus v2 are listed in section 1.1 and applied inline. Where this file and the CDC disagree, the CDC wins.

> **Audience:** Google AI Studio (code-generation model). **Author:** SOL R US. **Goal:** build a client-ready, believable preview of the final product.
> **UI language:** French (every visible string). **Code, comments, identifiers:** English.
> **This version replaces the previous "360° campaign" specification.** The client changed the product during the last meeting. Ignore anything you may have built from the earlier brief (campaigns, self-evaluation, weights, global score, 9-Box, perception gap, confidentiality-threshold masking, PDI, org chart).

---

## 0. How to read and use this document

**Your role:** senior product designer + senior front-end engineer. You are building a prototype of a **mission-by-mission feedback platform** for the client SBS. It must feel like a real, calm, premium SaaS product, not a mock-up.

**Hard rules**

1. **No dead buttons.** Every button, link, tab, row and icon that looks clickable must do something visible: navigate, open an overlay, change state, or show a toast. Out-of-demo features open a small "Aperçu" overlay that shows the final behaviour statically.
2. **One source of truth.** A single central store holds all data (persisted to `localStorage`, seeded on first load). Every number on screen is **computed from the store** by selectors. Never hard-code a figure in a component.
3. **Everything is connected.** Sending a feedback updates the recipient's counters, the quota rings, the team leader's view, the dashboard, notifications and (for named feedback) the sender's "Envoyés" list, without a reload.
4. **Roles are enforced.** Navigation, content and buttons change per role. Hide controls a role cannot use.
5. **Anonymity is real, not cosmetic** (section 7.2). The data layer must make it impossible to find the author of an anonymous feedback, even from code paths used by admins.
6. **Clean over clever.** Fewer, better-aligned elements. Generous whitespace, strict grid. When in doubt, remove.
7. **Stack:** keep the current one if it already works; otherwise React + TypeScript + Tailwind CSS, a headless component base (Radix UI / shadcn/ui style), `lucide-react`, Framer Motion for subtle transitions, custom SVG or Recharts for charts. **No backend.**
8. **Dates are relative** to the demo clock (never stale).
9. **No certification claims** ("ISO 27001", "RGPD certifié", etc.). Use neutral wording.
10. **No integration with any external HR tool.** The final rating and objectives live in SBS's existing annual-evaluation tool. Show this once, as a calm note in the synthesis (section 9.9). Do not draw any connector.

**Delivery:** build in the phases of section 14, in order.

---

## 1. Product in one paragraph, and what changed

SBS 360° collects **feedback on people's contribution to a mission**, all year long. Any employee can **ask for** feedback, **give spontaneous** feedback, and choose to give it **by name or anonymously**. Team leaders see the feedback about their team members. At the end of the yearly **cycle**, each person gets a **synthesis** (strengths, development areas, radar overview, PDF) which supports the team leader's final rating, done elsewhere. The cycle then **archives itself** and the next one starts. HR can also create a **public link** for a client to give feedback on a mission.

| Previous prototype | Now |
|---|---|
| Campaigns with wizard, dates, participants | **Cycle** (annual, automatic) + **Missions** |
| Self-evaluation | **Removed**. Nobody evaluates themselves. |
| Weighted scores, global score | **Removed**. Simple averages only, no overall score. |
| Likert questionnaire first | **Written answers first** (5–8 questions); **optional 1–5** after |
| Confidentiality threshold masking | **Giver chooses** named or anonymous. Anonymous is absolute. |
| Evaluator assignments by HR | **Requests** by employees + **spontaneous** feedback |
| 9-Box, perception gap, PDI, org chart | **Removed** (PDI and detailed access rules are "à confirmer") |
| — | **Client feedback by public link** (optional module) |
| AI evaluator, AI quality flags | **AI drafts strengths/development areas**, switchable; team leader validates |

### 1.1 Changes introduced by the CDC of 12 Nov 2026

| Topic | v2 | **v2.1 (current)** |
|---|---|---|
| Who manages missions | Admin RH (all missions) | **Responsables (d'équipe / de mission) create and manage missions. Admin RH does not manage missions** (he/she only participates like any collaborateur). |
| Mission fields | name, description, dates, lead, participants | + **numéro OTP** and **durée / nombre d'heures** |
| Client feedback links | Created by Admin RH, one link per mission, optional identification | **Created and sent by the mission lead or the collaborateur concerned. ONE LINK PER CLIENT** (nom, entreprise, e-mail captured at creation), one link = one client + one mission, never reusable. The platform always knows which client received which link and who answered. No identification form for the client. Client reminder (relance). |
| Objectives | minimum feedbacks received | minimum feedbacks **given and received** (values set by SBS) + **mandatory feedback for some profiles** (e.g. juniors), configurable |
| Anonymous feedback & relation | Q10 default ON | CDC 3.8: relation of the giver shown **except on anonymous feedback** → Q10 default **OFF** (still a toggle) |
| AI assistant | In scope, switchable | **Optional, not included (sur devis).** In the delivered platform the strengths and development areas are **written by the team leader**. Default `aiMode = MANUEL`; the AI screens remain as a clearly labelled "Option sur devis" preview. |
| Feedback request | nominative | nominative **and also received by e-mail** by the recipient |
| Per-mission view | — | "**Mes missions, mes feedbacks**": per mission, the feedback I received |
| Out of scope (sur devis, never built) | PDI, org chart | AI assistant, SAP, voice answer for client link, SMS reminders, intranet link, integration with the annual-evaluation tool, development plan. Self-evaluation / weights / global score: excluded by principle. |

---

## 2. Product model

### 2.1 Vocabulary (use exactly these French words)

| Term | Meaning |
|---|---|
| **Collaborateur** | Any employee. |
| **Responsable d'équipe / de mission** | Employee who does the annual evaluation of his/her team members, creates and manages missions and sends client links. |
| **Cycle** | Yearly period (named by HR). Archived automatically at its end. |
| **Mission** | Shared piece of work with a name, **numéro OTP**, dates / **hours**, participants and a lead (responsable de mission). Managed by responsables, not by HR. |
| **Feedback** | Written feedback from one person to another about their contribution to a mission. |
| **Demande** | A feedback request sent by an employee to people he/she worked with. |
| **Nominatif / Anonyme** | Author known / author not stored anywhere. |
| **Relation** | *Responsable*, *Pair*, *Équipe* (from the giver to the recipient). |
| **Compétence** | One of six: Inspirer · Développer · Intégrité et inclusion · Expertise et outils · Engagements et livraison · Orientation client. |
| **Note** | Optional 1–5, shown as a supporting summary. |
| **Synthèse** | End-of-cycle document per employee. |
| **Feedback client** | Answer from one identified client via his/her own public link, about a mission. |

### 2.2 Roles and navigation

Roles: `COLLABORATEUR`, `RESPONSABLE` (also a collaborateur), `ADMIN_RH`, `ADMIN_TECH`.

| Group | Item | Collab. | Responsable | Admin RH | Admin tech |
|---|---|:-:|:-:|:-:|:-:|
| **Mon espace** | Accueil | ✅ | ✅ | ✅ | ✅ (tech variant) |
| | **Donner un feedback** (primary button in top bar + sidebar) | ✅ | ✅ | ✅ | — |
| | Mes demandes (badge = to answer) | ✅ | ✅ | ✅ | — |
| | Mes feedbacks (Reçus / Envoyés) | ✅ | ✅ | ✅ | — |
| | Mes missions | ✅ | ✅ | ✅ (participation only) | — |
| | **Retours client** (links I created / on my missions) | ✅ | ✅ | — | — |
| **Mon équipe** | Suivi de l'équipe | — | ✅ | — | — |
| | Synthèses (badge = to write) | — | ✅ | — | — |
| **Pilotage RH** | Cycles | — | — | ✅ | — |
| | Suivi & rappels (incl. feedbacks non réalisés) | — | — | ✅ | — |
| **Référentiels** | Collaborateurs | — | 👁 team | ✅ | 👁 read |
| | Compétences & questions | — | — | ✅ | — |
| **Administration** | Messages (templates, notifications) | — | — | ✅ | — |
| | Journal d'administration | — | — | ✅ | ✅ |
| | Utilisateurs & rôles | — | — | — | ✅ |
| | Paramètres | — | — | ✅ | ✅ (technical) |
| | Aide & anonymat | ✅ | ✅ | ✅ | ✅ |

### 2.3 Visibility rules (client has not decided: ALL are toggles in Settings, defaults below)

| Rule (ref. to the CDC question) | Default |
|---|---|
| Collaborateur sees feedback he/she received (Q1) | ON |
| Collaborateur sees own synthesis (Q2) | ON, only once *Validée* (Q34) |
| Named feedback shows the author's name to the recipient (Q3) | ON |
| Team leader sees anonymous feedback content about team members (Q4) | ON |
| N+1 of the team leader sees syntheses (Q5) | OFF |
| Admin RH sees individual feedback and syntheses (Q6) | OFF |
| Collaborateur sees feedback from clients on his/her mission (Q7) | OFF |
| Mission participants see all client feedback of the mission (Q8) | OFF |
| A requested feedback may be anonymous (Q9) | ON |
| Giver's relation is shown on anonymous feedback (Q10) — CDC 3.8 says *except anonymous* | **OFF** |
| Admin RH may hide an inappropriate anonymous text (Q11) | ON |
| Anonymous feedback counts in quotas (Q12) | ON |
| Any collaborateur may create a mission (Q13) — HR never does | OFF |
| Collaborateur sees average per competency (Q22) | ON |
| PDF of the synthesis can be given to the collaborateur (Q35) | ON |

Always true, not a toggle: **nobody can ever find the author of an anonymous feedback.**

A **"Voir en tant que…"** button in Settings opens a split preview of the chosen persona's screen that updates live as toggles change. This is the key demo moment.

---

## 3. Demo layer (separate from the product UI)

A 40 px bar fixed at the very top (dark neutral, 12 px text), collapsible to a pill (`Ctrl+Shift+D`).

| Control | Behavior |
|---|---|
| **"Voir en tant que"** | Personas: *Sophie Martin — Admin RH*, *Thomas Dubois — Responsable d'équipe*, *Lucas Bernard — Collaborateur*, *Claire Moreau — Collaboratrice (donne des feedbacks)*, *Karim Saci — Admin technique*. Switch with 200 ms fade, keep route if allowed. |
| **"Scénario"** | ① *Début de cycle* ② *Cycle en cours* ③ *Fin de cycle — synthèses à rédiger* ④ *Nouveau cycle (ancien archivé)*. Rebuilds the seed deterministically. |
| **"Avancer le temps"** | Popover: +1 semaine, +1 mois, jusqu'à la fin du cycle. Triggers reminders, notifications and the **automatic archiving** when the end date is crossed. |
| **"Simuler des feedbacks"** | Adds N plausible feedbacks (default 12, mixed named/anonymous) so counters and rings move live. |
| **"Ouvrir le lien client"** | Opens the public client page (section 9.12) in a phone-sized frame, as a client would see it. |
| **"Visite guidée"** | Role-specific coach marks (6–8 steps). |
| **"Réinitialiser"** | Modal, then resets to the current scenario. |

The product UI never mentions "démo" except a discreet `Version de démonstration` in the sidebar footer.

---

## 4. Scope boundaries

| Status | Items |
|---|---|
| **In the prototype** | Cycles (automatic archiving), missions, requested and spontaneous feedback, named/anonymous choice, six competencies and adapted questions, optional 1–5 ratings, given + received objectives with mandatory feedback for some profiles, reminders, team-leader view, synthesis (strengths and development areas written by the leader, radar, PDF), missions managed by responsables (OTP, hours), client feedback by one public link per client. |
| **Shown as "à confirmer"** | Detailed access rules (all visibility toggles), exact quota values, development plan with action tracking (not built), multiple leaders per employee. |
| **Not built / sur devis (CDC 3.11)** | AI assistant (preview only, labelled paid option), SAP, voice answers, SMS reminders, intranet link, integration with the annual-evaluation tool, development plan. Never: self-evaluation, weights, overall score, org chart, talent matrix. |

---

## 5. Design system

### 5.1 Principles

Calm, institutional, precise. Think *consulting firm meets modern SaaS*. White canvas, navy for structure, one red accent used sparingly (primary CTAs on landing only; elsewhere the primary is blue). Data is the hero; chrome is quiet.

**Reference products to study (search their public screenshots/design docs and imitate the *patterns*, not the branding):**

- **Linear** — density, speed, keyboard-first, command menu, subtle motion.
- **Stripe Dashboard** — data tables, detail pages with tabs, side panels, empty states, typography.
- **Vercel Dashboard / Geist** — restrained neutrals, clean forms.
- **Notion** — calm empty states, inline editing.
- **Lattice, Leapsome, Culture Amp, 15Five, Workday Peakon** — 360 flows: nominations, report layout, radar and gap visuals, comment grouping, calibration/9-box.
- **Design systems to borrow patterns from:** shadcn/ui + Radix (primitives), Atlassian Design System (tables, filters, empty states), Shopify Polaris (resource index pattern, bulk actions), IBM Carbon (data table anatomy), GOV.UK Design System (form error patterns).
- **Reading:** *Refactoring UI* (Wathan & Schoger) for hierarchy/spacing; Nielsen Norman Group articles on data tables, wizards and filters.

### 5.2 Tokens (define as CSS variables, with a dark theme prepared but optional)

| Token | Value |
|---|---|
| `--brand-900` | `#0B1F3A` (deep navy — sidebar, headings) |
| `--brand-700` | `#16345F` |
| `--primary` | `#1E4FD8` (actions, links, focus) |
| `--primary-50` | `#EEF3FD` (selected rows, soft fills) |
| `--accent` | `#C8102E` (SBS red — very sparing: landing CTA, critical highlights) |
| Neutrals | slate scale: `#F8FAFC` canvas, `#F1F5F9` subtle, `#E2E8F0` border, `#94A3B8` muted text, `#475569` secondary text, `#0F172A` primary text |
| Semantic | success `#15803D` / bg `#ECFDF3`; warning `#B45309` / bg `#FFF7E6`; danger `#B42318` / bg `#FEF3F2`; info `#1D4ED8` / bg `#EEF3FD` |
| Chart series colors (also differentiated by **line style + marker shape**, never color alone) | Ensemble `#16345F` solid ● · Responsable `#1E4FD8` solid ■ · Pairs `#0E9F6E` solid ▲ · Équipe `#D97706` dashed ◇ · Archive `#94A3B8` dotted ○ |

Typography: **Inter** (UI) with tabular numerals (`font-variant-numeric: tabular-nums`) for every number in tables/KPIs. Scale: 12 / 13 / 14 (base) / 16 / 20 / 24 / 32. Weights 400/500/600. Line-height 1.5 body, 1.25 headings. Headings use `brand-900`.

Spacing: 4 px grid; layout gaps 16/24/32. Radius: 8 px (controls), 12 px (cards, overlays), 999 px (badges, avatars). Elevation: borders first (`1px solid #E2E8F0`), shadow only for overlays (`0 12px 32px rgba(15,23,42,.12)`).

Motion: 150–200 ms, ease-out; overlays fade+translate 8 px; lists stagger max 40 ms; skeleton shimmer; honour `prefers-reduced-motion`.

### 5.3 Layout

- **Sidebar** 248 px (collapsible to 72 px, icons + tooltips), brand-900 background, grouped sections with small uppercase labels, active item = lighter fill + left 3 px primary bar.
- **Top bar** 56 px, white, bottom border: breadcrumb left; right: global search trigger (`Rechercher… ⌘K`), notification bell, help, user menu (avatar → "Mon profil", "Préférences de notification", "Aide", "Se déconnecter").
- **Content** max-width 1440 px, 32 px padding. **Page header pattern:** breadcrumb → H1 (24 px) + one-line description → primary action (right) + secondary actions (ghost buttons or a "…" menu).
- Primary desktop target 1280–1920 px. Tablet works. Mobile (≤ 640 px) must work for: evaluation form, notifications, Accueil, Mes résultats (stacked).

### 5.4 Component inventory (build once, reuse everywhere)

Button (primary / secondary / ghost / danger, sizes sm-md, loading state), IconButton, Input, Textarea (counter), Select, Combobox (searchable, multi), DatePicker + range, Checkbox, Radio, Switch, Slider (weights), SegmentedControl, Tabs, Badge/StatusPill, Avatar (+ stack), Tooltip, Popover, DropdownMenu, Modal, Drawer, FullScreenWizard, Toast (with Undo), Banner/Callout, Stepper, ProgressBar, ProgressRing, Skeleton, EmptyState, DataTable, FilterBar (chips), BulkActionBar, Pagination, KPI card, Timeline, CommandPalette, PeoplePicker, Chart set (Radar, Dumbbell gap, Heatmap, 9-Box, Line, Bar, Donut, Sparkline), RatingScale (1–5), CoachMark tour.

### 5.5 Back-office patterns (follow strictly)

**Data table anatomy:** toolbar (search · filter chips · "Colonnes" menu · density toggle · export) → sticky header with sortable columns (sort icon on hover, arrow when active) → rows 44 px (compact 36 px) with hover background and **row actions revealed on hover** (kebab always visible on touch) → checkbox column enabling the **bulk action bar** (floats at bottom, "N sélectionnés" + actions + "Désélectionner") → footer with count, rows-per-page, pagination. Persist column/density choices. Numbers right-aligned, text left-aligned, status as pills, people as avatar + name + muted subtitle.

**Filters:** chips like `Département : Engineering ×`, "+ Filtre" opens a popover; "Effacer les filtres" appears when any is active; filter state in the URL; **saved views** (tabs above the table: "Tous", "En retard", "Sous le seuil", plus "+ Enregistrer cette vue").

**Overlay rule — choose the right container:**

| Use | When |
|---|---|
| **Popover / menu** | quick choice, ≤ 5 options |
| **Modal (480 px)** | confirmation, single decision, short form (≤ 4 fields) |
| **Drawer (right, 480–640 px)** | view/edit an entity while keeping the list visible (employee, competency, question, mission, audit event) |
| **Full-screen wizard** | multi-step creation (CSV import, client-link creation) |
| **Command palette** | navigation/search |

Overlay anatomy: header (title + subtitle + close ✕) → scrollable body → **sticky footer** (secondary left/ghost, primary right; primary shows spinner on submit). `Esc` closes (with unsaved-changes guard), focus trapped, focus returns to the trigger.

**Destructive actions:** reversible → perform immediately + toast "Action annulée · **Annuler**" (6 s). Irreversible or high impact → modal listing the **impact** ("3 participants seront retirés de la mission") and requiring the user to type the name for the most severe (restore backup).

**Forms:** labels above fields, required marked with `*`, helper text under, inline validation on blur, error summary at top of long forms, never disable the submit button silently (show what's missing instead).

**Empty states:** illustration-free, one icon, a title, one sentence, one primary action ("Créer la première mission").

**Loading:** 300–500 ms skeletons on first view of data-heavy pages (fake latency, so the UI feels real), optimistic updates elsewhere.

**Accessibility:** WCAG AA contrast, visible focus ring (2 px primary + offset), full keyboard navigation, `aria-live` for toasts, charts have a "Voir en tableau" toggle.

---

## 6. App shell behaviors

| Element | Behavior |
|---|---|
| **Logo** | Goes to Accueil. |
| **Collapse chevron** | Collapses the sidebar (state remembered). |
| **Primary button "Donner un feedback"** | In the top bar for everyone except Admin tech: opens the feedback wizard (9.3) from anywhere. |
| **Search / ⌘K** | Command palette: Pages, Personnes, Missions, Actions rapides ("Donner un feedback", "Demander un feedback", "Créer une mission"). Role-filtered. |
| **Bell** | Popover (380 px): tabs *Tout / Non lues*; items grouped by day; click marks read and deep-links to the exact object; "Tout marquer comme lu"; "Voir toutes les notifications". |
| **Help (?)** | Drawer: 3-bullet guide for the current page, link to *Aide & anonymat*, "Relancer la visite guidée". |
| **User menu** | Mon profil (drawer: photo, notification preferences), Aide, Se déconnecter (back to Entry page). |
| **Toasts** | Bottom-right, max 3, 5 s, optional Undo link. |
| **Cycle banner** | Slim banner under the top bar: `Cycle FY27 · ouvert jusqu'au 30 juin` (links to Cycles for RH). When viewing an archived cycle: amber banner "Cycle archivé — lecture seule". |

---

## 7. Data model and seed data

### 7.1 Entities (TypeScript; ids are strings)

- `User` { id, matricule, firstName, lastName, email, departmentId, jobTitle, grade, leaderId (single, but model `leaderIds[]` ready for Q41), status, role }
- `Cycle` { id, name, startDate, endDate, status (`A_VENIR|OUVERT|ARCHIVE`), quotaRule { minReceived, **minGiven**, minFromDirectReports, teamLeaderNeedsTeamFeedback, **mandatory { enabled, grades[] }** }, reminderRules[], aiMode (`OFF|MANUEL|ASSISTE`; default `MANUEL`, `ASSISTE` = optional paid feature) }
- `Mission` { id, cycleId, name, **otp**, **hours**, description, startDate, endDate, leadId, status (`EN_COURS|TERMINEE`), participantIds[] }
- `FeedbackRequest` { id, missionId, requesterId, recipientsIds[], message, dueDate, allowAnonymous } — **per-target status stored on the giver's side only** (`PendingTask` { giverId, requestId, status `EN_ATTENTE|TRAITEE|DECLINEE` }); see 7.2.
- `Competency` { id, name, description, order }
- `Question` { id, competencyId, variants: { relation (`RESPONSABLE|PAIR|EQUIPE`) × gradeBand (`JUNIOR|CONFIRME|SENIOR`) → text }, kind (`COLLAB|CLIENT`), order }
- `NamedFeedback` { id, cycleId, missionId?, authorId, recipientId, relation, requestId?, answers {questionId: text}, ratings {competencyId: 1–5}, createdAt, status (`BROUILLON|ENVOYE`), hiddenByHR? }
- `AnonymousFeedback` { id, cycleId, missionId?, recipientId, relation (nullable if rule Q10 OFF), answers, ratings, createdAt, hiddenByHR? } — **no author field, no request id, no giver reference, ever.**
- `Synthesis` { id, cycleId, userId, status (`NON_COMMENCEE|EN_REDACTION|VALIDEE`), strengths {competencyId: text}, axes {competencyId: text}, aiDraft?, validatedAt }
- `ClientLink` { id, token, missionId, **createdById**, **clientName, company, clientEmail** (one client per link), title, welcome, questionIds[], expiresAt, maxResponses (default 1), status (`ACTIF|EXPIRE|DESACTIVE`) } — no `identification` field: the client is always known from the link.
- `ClientResponse` { id, linkId, missionId, clientName, company (copied from the link), answers, rating?, createdAt }
- `Notification`, `AdminEvent` { id, ts, actorId, action, target, details } — **admin actions only; never feedback authorship.**
- `Settings` { brand, visibilityRules, noteMode (`PAR_COMPETENCE|PAR_MISSION`), noteRequired, quotas { minReceived, **minGiven**, minFromDirectReports, teamLeaderNeedsTeamFeedback, **mandatory { enabled, grades[] }** } } (the former `countsMode` switch is removed: both counts are tracked)

### 7.2 Anonymity architecture (must be implemented as described)

1. Anonymous feedback is written to a **separate collection** (`AnonymousFeedback`) through a function that **does not receive the author id**. The wizard passes author info only to the named path.
2. The giver's task ("réponse à une demande") is marked `TRAITEE` in a **per-giver** list that is not joinable to any feedback. No timestamp is copied from the task to the feedback; the feedback's timestamp is **rounded to the day** to limit correlation.
3. "Mes feedbacks › Envoyés" lists **named feedback only**. A permanent note explains why anonymous ones are not listed.
4. The request counter shows "3 réponses reçues sur 5 demandées". It never shows who answered anonymously.
5. Admin events for an anonymous send record only `Un feedback anonyme a été envoyé` with **no actor**.
6. Exports, backups, the audit view and the "Voir en tant que" preview use the same collections, so the guarantee holds everywhere. Add a **unit test** asserting no author-like field exists on anonymous records and that no selector can derive one.
7. Anonymous feedback cannot be edited or withdrawn after sending (the author cannot be identified).
8. Visual proof for the client: the page *Aide › Comment fonctionne l'anonymat* (9.16) shows a diagram of this separation.

### 7.3 Seed volume and storylines

- **30 collaborateurs**, 4 departments (*Strategy & Consulting* 9, *Engineering & Tech* 8, *People & HR* 5, *Finance & Operations* 6) + 2 leaders. Grades are **placeholders** (`Junior`, `Consultant`, `Senior`, `Manager`, `Directeur`), replaced later by SBS's list. Avatars are initials with deterministic pastel colors.
- **Anchors:** Karim Saci (Managing Partner, Admin tech), Sophie Martin (Directrice du Capital Humain, Admin RH), Thomas Dubois (Partner, team leader of 5), Lucas Bernard (Principal, in Thomas's team), Claire Moreau (Consultante senior, same team, peer).
- **Cycle:** `FY27`, open, ends in about 7 months. Archived `FY26` with full syntheses and PDFs.
- **Missions:** 14 in the open cycle (2 finished), each with 3–7 participants, an OTP number (e.g. `OTP-26-0142`) and a budget in hours. Leads are responsables (or the collaborateur concerned); never Admin RH.
- **Feedback:** about 160 in the open cycle, 25 % anonymous; every competency covered; ratings present on about 70 %.
- **Stories to make visible:**
  - *Lucas Bernard:* 9 feedbacks over 4 missions, 2 anonymous. Strong on *Expertise et outils* and *Engagements et livraison*; clear development area on *Inspirer*. Quota ring at 3 of 5 (needs 2 more, 1 from a direct report).
  - *Claire Moreau:* 3 pending requests to answer, one due within 3 days.
  - *Thomas Dubois:* 2 team members below quota; he received one anonymous feedback from his team.
  - *Mission with client links:* mission « Schéma directeur… » has 3 links, one per client: 2 answered, 1 pending (expires in 3 days); another mission has one expired link. Each response shows the client name + company.
  - *Mandatory feedback:* juniors must give at least `minGiven` feedbacks; those who have not are flagged in *Suivi & rappels*.
  - *Scenario ③:* 22 syntheses: 9 validated, 6 in writing (3 with an AI draft ready), 7 not started.
- **Question bank (placeholders to be replaced by SBS's):** 7 written questions, one per competency plus one open comment:
  1. *Inspirer* — confiance, énergie positive sous pression, direction claire, progression des autres.
  2. *Développer* — recherche et usage du feedback, apprentissage, partage.
  3. *Intégrité et inclusion* — intégrité, qualité du travail, valeurs, inclusion.
  4. *Expertise et outils* — structuration de problèmes complexes, recommandations argumentées, usage responsable des outils, données et IA.
  5. *Engagements et livraison* — délais, budget, qualité.
  6. *Orientation client* — compréhension des besoins, conseil, contribution à l'organisation.
  7. *Commentaire libre.*
  Each question has a wording variant per relation (*Responsable*, *Pair*, *Équipe*) and a depth variant per grade band. Generate them consistently. Client questions (4): overall satisfaction, quality of delivery, communication, a free comment.

---

## 8. Calculation rules (pure functions in `engine.ts`, unit-tested)

| Rule | Definition |
|---|---|
| **RG-02 Relation** | `RESPONSABLE` if the giver is the recipient's leader; `EQUIPE` if the giver is in the recipient's team (recipient is the giver's leader); otherwise `PAIR`. If it cannot be derived, the giver picks it. |
| **RG-04 Ratings** | Integers 1–5. Missing rating is not zero. |
| **RG-05 Average** | Per competency: sum of ratings given ÷ number of ratings given, per mission or over the whole cycle. No ratings → `null`, displayed "—". |
| **RG-06 No weights** | No weighting, no overall score anywhere (header, table, PDF, charts). |
| **Radar** | One point per competency = RG-05. If Q21 is ON, one polygon per relation plus an "Ensemble" polygon; otherwise only "Ensemble". Reference ring at 3. Always offer "Voir en tableau". |
| **Quota progress** | Per user: `received` vs `minReceived` **and** `given` vs `minGiven`; `fromDirectReports` count (direct circle: leader or direct reports); anonymous counted if Q12. `given` = named feedbacks sent + requests answered (an answered request never reveals whether it was named or anonymous; spontaneous anonymous sends cannot be attributed, by design). A team leader also needs feedback from team members. Ring shows received `3 / 5`; given is shown as a second line. **Mandatory:** if `mandatory.enabled` and the user's grade is in `mandatory.grades`, reaching `minGiven` is required and flagged. |
| **Reminders** | Rules (e.g. weekly for pending requests, monthly for quota gaps) fire when the demo clock crosses them, creating notifications and history rows. |
| **Archiving** | When `now > cycle.endDate`: status `ARCHIVE`, read-only everywhere, next cycle becomes `OUVERT` the next day, notification to RH and team leaders. |
| **Client link validity** | Active only if `status = ACTIF`, `now < expiresAt` and responses `< maxResponses` (default 1: one link = one client = one answer). Otherwise the public page shows the right message. |
| **Evolution** | Delta of a competency average against the archived cycle (only if present in both). |

State machines: Cycle `A_VENIR → OUVERT → ARCHIVE`; Mission `EN_COURS → TERMINEE`; Task `EN_ATTENTE → TRAITEE|DECLINEE`; Synthesis `NON_COMMENCEE → EN_REDACTION → VALIDEE`; ClientLink `ACTIF → EXPIRE|DESACTIVE`.

---

## 9. Screens: purpose, layout, every button, every overlay

Unless stated, mutations may create a notification and (for admin actions) an `AdminEvent`.

### 9.1 Entry page (outside the app shell)

Hero with product name, one-sentence value proposition, two CTAs, a polished static dashboard built from real components (radar + quota ring). Below: **"Choisir un profil"** with 4 cards (Admin RH, Responsable d'équipe, Collaborateur, Collaborateur qui donne un feedback) each with avatar, name, job, 3 capabilities, primary button. Then "Comment ça marche" in 4 steps (*Ouvrir un cycle → Échanger des feedbacks → Synthétiser → Archiver*) and a "Vos garanties" row (anonymat réel, accès par rôle, aucune note finale calculée). Footer link "Administrateur technique".

| Button | Action |
|---|---|
| **[Explorer la plateforme]** | Enters as Admin RH. |
| **[Voir la visite guidée]** | Enters as Admin RH with tour. |
| **[Entrer en tant que …]** | Enters as that persona. |

### 9.2 Accueil (per role)

Greeting, contextual subtitle, cycle banner.

**Collaborateur:**
- **"Vos tâches"** checklist card: *N demandes de feedback à traiter* (with due dates) · *Votre objectif : 3 / 5 feedbacks reçus* (ring + hint "1 de vos collaborateurs directs") · *Feedbacks donnés : x / minGiven* (flagged **Obligatoire** for the profiles concerned) · *Missions terminées sans feedback demandé*. Each row has a button (**[Répondre]**, **[Demander]**).
- Big card **"Donner un feedback"** with **[Donner un feedback]** and **[Demander un feedback]**.
- "Mes missions récentes" (cards), "Derniers feedbacks reçus" (if allowed).

**Responsable d'équipe / de mission:** the above plus *Mon équipe* (avatar list with quota rings, **[Relancer]**), *Synthèses à rédiger* with deadline, "Feedbacks récents sur mon équipe", **[Nouvelle mission]** and a *Retours client* shortcut.

**Admin RH:** KPI row (clickable): *Feedbacks du cycle* · *Participation* (% employees who gave at least one) · *Objectifs atteints* · *Synthèses validées*. Charts: feedbacks over time (named vs anonymous), participation by department. "Points d'attention" list with inline actions (e.g. "6 collaborateurs sous l'objectif" **[Relancer]**, "N demandes sans réponse" **[Relancer]**, "N retours obligatoires non réalisés" **[Suivre]**). Quick actions: **[Ouvrir Suivi & rappels]**, **[Gérer les collaborateurs]**, **[Règles de visibilité]**. Admin RH has no mission or client-link action (CDC 3.1).

**Admin technique:** users, last backup, recent technical events; **[Créer une sauvegarde]**, **[Gérer les utilisateurs]**.

### 9.3 Donner un feedback (full-screen wizard)

**Entry points:** top-bar primary button, a request in *Mes demandes*, a mission page, a person's profile card. Left: stepper (4 steps). Right: live summary card (to, mission, type, progress). Autosave draft every 5 s ("Brouillon enregistré à HH:MM"). **[Quitter]** guards unsaved content.

1. **Pour qui ?** People picker (search, filters department/grade; shows relation chip computed by RG-02). **Mission** select (suggested from shared missions; "Aucune mission" allowed only if Q14 is ON). Cannot select oneself (inline message "Vous ne pouvez pas vous donner de feedback.").
2. **Nominatif ou anonyme ?** Two large selectable cards. *Nominatif*: "Votre nom sera visible par la personne et son responsable." *Anonyme*: "Votre identité n'est enregistrée nulle part. Personne ne pourra la retrouver, pas même les administrateurs." A **"Ce que verra le destinataire"** mini-preview updates with the choice (shows or hides name, relation per Q10). For anonymous: required checkbox "J'ai compris que je ne pourrai plus modifier ni retirer ce feedback."
3. **Vos réponses.** One question per screen or all on one page (toggle). Each question: competency tag, question text adapted to relation and grade, textarea with soft guidance ("Décrivez une situation observée, en une phrase ou un paragraphe"), counter. Keyboard `←/→` between questions. Progress dots.
4. **Note facultative et envoi.** Optional ratings (per competency or one for the mission depending on `noteMode`) with a 5-button control and **[Passer]**. Review table of all answers with **[Modifier]** links. Primary **[Envoyer le feedback]**.

**Overlay "Envoyer ce feedback ?" (modal):** summary (to, mission, type, N réponses, notes données). For anonymous: red-tinted notice "Envoi anonyme définitif". **[Revenir]**, **[Envoyer]**. Success screen: "Merci, votre feedback a été envoyé." with **[Donner un autre feedback]**, **[Retour à l'accueil]**; counters and notifications update immediately.

### 9.4 Mes demandes, Mes feedbacks

**Mes demandes** (tabs *À traiter · Traitées · Envoyées*):
- *À traiter*: cards with requester avatar, mission, message, due date (red if < 3 days). **[Répondre]** opens the wizard prefilled (type choice still free unless `allowAnonymous` is OFF). **[Décliner]** opens a modal with optional reason.
- *Envoyées* (requests I made): per request, "3 réponses sur 5 demandées", progress bar, per-person status **only for named responses**; anonymous responses appear as a counter, never as a person. **[Relancer]** (modal with message preview), **[Demander à d'autres]**.

**Mes feedbacks** (tabs *Reçus · Envoyés*):
- *Reçus* (if allowed): grouped by mission; filters mission, competency, relation, period, type. Feedback card: giver (name or "Anonyme"), relation chip, date, answers per question, ratings. Empty state if the visibility rule is OFF: "Vos feedbacks seront consultables lors de la publication de votre synthèse."
- *Envoyés*: named feedback only, read-only, with note "Les feedbacks anonymes ne sont pas listés : personne, pas même vous, ne peut les retrouver."

The request is **nominative** (the recipient sees who asks) and **also reaches the recipient by e-mail** (notification + one row in *Messages › Historique*; toast says so).

**Overlay "Demander un feedback" (drawer 560 px):** Mission (required), People picker multi (participants of the mission pre-suggested, with relation chips and workload hint "a déjà 3 demandes en attente"), Message (optional), Due date, switch *Autoriser les réponses anonymes* (if rule Q9 ON). Footer **[Annuler]**, **[Envoyer N demandes]**.

### 9.5 Missions

**List (everyone sees the missions they lead or take part in; Admin RH sees only his/her own participations):** header "Mes missions", **[Nouvelle mission]** (**responsables**, or everyone if Q13 ON — never driven by HR), tabs *En cours · Terminées*, search, table: Mission · **OTP** · Responsable de mission · Participants (avatar stack) · Dates · **Heures** · Feedbacks (count) · Statut · ⋯.

**Mission page** (tabs):
- *Aperçu*: description, **OTP, dates and hours**, lead, KPIs (feedbacks, demandes en attente), activity timeline.
- ***Mes feedbacks*** (participants): the feedback I received on this mission — the "Mes missions, mes feedbacks" view (CDC 3.9).
- *Participants*: table with each participant and **"Évaluateurs suggérés"** chips (lead, peers, team) with **[+]**; **[Suggérer automatiquement]** (preview of suggestions then **[Appliquer]**); **[Ajouter un participant]** (picker); per-row **[Demander un feedback]**.
- *Feedbacks*: counts per participant (not content), filters. Content opens only through the person's page according to rules.
- *Feedback client* (lead and participants concerned): one row per client link (client, status, answered or not), **[Créer un lien]**, **[Voir les réponses]**, **[Relancer le client]**.
- *Paramètres*: edit fields; **[Marquer comme terminée]** (modal: "Les feedbacks restent possibles jusqu'à la fin du cycle." + confirm).

**Overlay "Nouvelle mission" (drawer):** Nom*, **Numéro OTP***, **Durée / nombre d'heures**, Description, Dates*, Responsable de mission* (picker), Participants* (multi picker with department filter and "tout un département"), **[Créer la mission]**, **[Créer et demander des feedbacks]**.

### 9.6 Suivi de l'équipe (Responsable d'équipe)

Header "Mon équipe", summary strip (*Feedbacks reçus · Objectifs atteints · Synthèses validées*). Table: Collaborateur · Missions · Feedbacks reçus · Objectif (ring) · Dernier feedback · Synthèse (status pill) · ⋯. Saved views: *Tous · Sous l'objectif · Synthèse à rédiger*. Bulk **[Relancer]**.

Row opens **Page collaborateur** (tabs):
- *Feedbacks*: explorer with filters mission / competency / relation / period / type; cards as in 9.4 *Reçus*; the author is shown only for named feedback; anonymous cards show "Anonyme" and the relation if Q10.
- *Synthèse*: see 9.9.
- *Missions*: list with feedback counts per mission.
- *Objectifs*: ring + breakdown (reçus, de collaborateurs directs).

### 9.7 Cycles (Admin RH)

List of cycles with status pill, dates, KPIs. **[Nouveau cycle]** (drawer: nom, dates début/fin; warning if overlapping). **Cycle page** tabs:
- *Aperçu*: progress through the year (timeline with today marker), KPIs, archive countdown.
- *Objectifs & rappels*: quota editor (minimum de feedbacks **reçus**, minimum de feedbacks **donnés**, dont de collaborateurs directs, retours de l'équipe pour un responsable; switch *Les feedbacks anonymes comptent*; **rule "Retour obligatoire"**: switch + grades concerned, default *Junior*), reminder rules builder (add rule: weekly pending requests, monthly quota gaps, 30 days before end), live preview "Concerne 11 collaborateurs".
- *Synthèses*: table of syntheses status per person; **[Relancer les responsables]**.
- *Archivage*: explains automatic archiving; shows what will happen on the end date; **[Prévisualiser l'archivage]** (modal listing consequences). No manual archive button (only via time travel in the demo bar).
- *Archives*: list of archived cycles, **[Ouvrir]** → read-only mode with amber banner; every action hidden; PDF available.

### 9.8 Compétences & questions (Admin RH)

Tabs *Compétences · Banque de questions · Questions client*.
- *Compétences*: six cards with name, description, number of questions; edit drawer (name, description).
- *Banque de questions*: table grouped by competency; row opens **drawer "Question"**: wording per relation (tabs *Responsable · Pair · Équipe*) and per grade band (segmented), preview as it appears to a giver, status active/inactive. Banner "Les modifications s'appliquent aux feedbacks futurs uniquement." **[Ajouter une question]**; the bank warns when outside 5–8 questions.
- *Questions client*: own list; reorder by drag; preview on phone frame.
- **[Aperçu du formulaire]** (any tab): opens the wizard step 3 in preview mode with relation and grade selectors.

### 9.9 Synthèse (Responsable d'équipe; read-only for the collaborateur when allowed)

**Header:** person, cycle selector (current and archived), status stepper *Non commencée → En rédaction → Validée*, **[Exporter en PDF]**, **[Valider la synthèse]** (leader).
**Banner:** "Cette synthèse accompagne l'évaluation annuelle réalisée dans l'outil de SBS. Elle ne contient aucune note finale."
**Layout:**
- *Left:* **Radar** of the six competencies (RG-05; relation polygons if Q21; hover tooltip; "Voir en tableau"), under it the **competency table** (Compétence · Moyenne · Nb de notes · Nb de feedbacks · Évolution vs cycle archivé). No total row.
- *Right:* **"Points forts"** and **"Axes de développement"** lists. Each item is editable inline, tagged by competency, with **[Ajouter]**, drag to reorder, **[Supprimer]** (undo toast).
- *Below:* **Verbatims** grouped by competency, each with relation chip and nominatif/anonyme badge (names only if rules allow); filter by mission.
- **AI panel — OPTIONAL, NOT INCLUDED (sur devis, CDC 3.11).** In the delivered platform the leader writes strengths and development areas by hand; the panel is hidden by default (`aiMode = MANUEL`). When an Admin RH switches the preview on (*Paramètres › Intelligence artificielle*, labelled "Option sur devis"), button **[Proposer avec l'IA]** (in mode *Assisté*) opens a right panel: for each competency a short summary and suggested strength or axis, each with **[Utiliser]**, **[Modifier]**, **[Ignorer]**. Label "Généré par IA — à vérifier", sources line "basé sur 11 réponses écrites, 7 missions". Nothing enters the synthesis without the leader's action. Feedback buttons **[Utile] / [Pas utile]**. In mode *Responsable seul* the panel is absent.
- **Overlay "Valider la synthèse" (modal):** checklist (points forts rédigés, axes rédigés, aucune suggestion IA non traitée), notice "La synthèse deviendra visible par {Nom}" (if Q34 ON) and **[Valider]**; after validation fields lock, with **[Rouvrir]** for the leader.
- **Overlay "Exporter en PDF":** options (checkboxes: Radar, Tableau des moyennes, Points forts et axes, Réponses écrites), live **A4 preview** of page 1, **[Télécharger le PDF]** (simulated progress + download) and **[Imprimer]** (print stylesheet).

### 9.10 Suivi & rappels (Admin RH)

Header "Suivi & rappels". Tabs:
- *Participation*: bars by department and grade; line chart of feedbacks over the cycle (named vs anonymous); filters.
- *Objectifs*: table of all collaborateurs with ring, received, **given**, from direct reports, status (*Atteint · En bonne voie · En retard*); saved views *En retard · **Retour obligatoire non réalisé** · Responsables · Par département*; bulk **[Relancer]**. This is also where HR follows the **feedback requests left unanswered** (with **[Relancer]**).
- *Rappels*: rules list with on/off switches, next run, history table (date, rule, recipients, sent/read). **[Envoyer un rappel maintenant]** (modal: audience, template select, recipients count, preview, **[Envoyer N rappels]**).

### 9.11 Collaborateurs (annuaire)

Table (Collaborateur · Département · Poste · Grade · Responsable · Statut · ⋯), saved views *Tous · Actifs · Sans responsable · Responsables*, bulk **[Changer de responsable]**, **[Désactiver]**, **[Exporter]**. Row opens a profile drawer: identity, leader, team members, missions, objectives ring, **[Modifier]**.

| Control | Result |
|---|---|
| **[Ajouter un collaborateur]** | Drawer: matricule*, nom*, prénom*, e-mail*, département*, poste*, grade*, responsable (picker). Inline duplicate detection. **[Enregistrer]**, **[Enregistrer et ajouter un autre]**. |
| **[Importer]** | Full-screen wizard (4 steps): ① file drop + **[Télécharger le modèle]** ② column mapping ③ validation table with inline fixes, duplicate matricule/e-mail, unknown leader ④ result with error report. |
| **Désactiver** | Modal showing impact (missions, team members to reassign) — history is kept; **[Réactiver]** appears afterwards. |
| **Responsable multiple** | A switch "Autoriser plusieurs responsables" in Settings (Q41) shows a second leader field. |

### 9.12 Feedback client (CDC 3.7 — one link per client)

**Page "Retours client"** (collaborateur and responsable; **not Admin RH**): table of the client links I created or that concern the missions I lead / take part in (Client · Entreprise · Mission · Statut (*Actif, Répondu, Expiré, Désactivé*) · Expiration · ⋯). Row menu: **Voir la réponse**, **Copier le lien**, **Envoyer par e-mail**, **Relancer le client**, **Prolonger**, **Désactiver/Réactiver**, **Dupliquer pour un autre client** (creates a *new* link for a *new* client).

**Wizard "Créer un lien" (3 steps, full-screen):**
1. *Mission et client*: mission picker (missions I lead or take part in), **client name\*, entreprise\*, e-mail\***, title shown to the client, welcome message.
2. *Questions*: choose from *Questions client*, reorder, add a custom question; live phone preview.
3. *Paramètres*: expiration date, maximum responses (default **1**), anti-abuse notice (read-only), switch *Activer le lien*. (No "identification" setting: the client is already known.)
**Success overlay:** link field with **[Copier le lien]**, QR code with **[Télécharger le QR]**, **[Envoyer par e-mail]** (composer prefilled with the client's address, subject, message and link), **[Prévisualiser comme client]**. The sender sends the link himself/herself.

**Drawer "Réponse":** the client name and company, the mission, the answers and rating; **[Exporter en CSV]**. Visible to the creator and the mission lead; to other participants only per rules Q7 / Q8.

**Public client page (route `/c/:token`, outside the app shell, mobile-first):** SBS logo and colors, "Bonjour {client}", title, welcome message, questions (textarea, optional 1–5 stars), **[Envoyer mes réponses]**, then a confirmation screen "Merci pour votre retour." **No identification form** (the link already identifies the client). States: *Lien expiré*, *Lien désactivé*, *Réponse déjà reçue pour ce lien*, *Lien introuvable*. No account, no navigation to the app.

### 9.13 Messages (Admin RH)

Tabs *Notifications · Modèles d'e-mail · Historique*.
- *Notifications*: full list with filters (*Toutes, Non lues, Demandes, Rappels, Synthèses, Système*), "Tout marquer comme lu".
- *Modèles*: *Demande de feedback reçue · Rappel de demande · Rappel d'objectif · Synthèse disponible · Fin de cycle · Lien client*. Editor page: Objet, body (bold, list, link), variable chips (`{{prenom}}`, `{{mission}}`, `{{date_limite}}`, `{{lien}}`), live preview (desktop/mobile), **[Envoyer un e-mail de test]**, **[Réinitialiser]**, **[Enregistrer]**.
- *Historique*: sends with delivered/opened rates; row opens a drawer with recipients.

### 9.14 Journal d'administration (Admin RH, Admin tech)

Header with the note: "Ce journal enregistre les actions d'administration. Il n'enregistre jamais l'auteur d'un feedback anonyme." Toolbar: search, date range, category (*Cycles, Missions, Questions, Liens client, Collaborateurs, Paramètres, Sécurité*), actor. Table: timestamp, category pill, action in French, actor, target. Row opens a drawer with before/after diff for configuration changes. **[Exporter]** (modal: range, CSV).

### 9.15 Paramètres

Left sub-navigation, sticky save bar ("Annuler / Enregistrer les modifications") when changed.

1. **Organisation & marque** (RH): raison sociale, logo upload, primary/secondary/accent pickers with live preview and contrast check.
2. **Règles de visibilité** (RH): matrix from 2.3 (rows = rules, switches, locked cells with lock + tooltip, e.g. "Auteur d'un feedback anonyme : jamais visible"), inline impact sentence on change, **[Voir en tant que…]** split preview.
3. **Notes** (RH): *par compétence / par mission*, *note obligatoire*, *radar par relation*.
4. **Anonymat** (RH): read-only explanation card + diagram link; toggles for relation shown (Q10), RH moderation (Q11), anonymous counts in quotas (Q12). The "never identifiable" line is locked.
5. **Intelligence artificielle** (RH) — badge **"Option sur devis · non incluse"**: callout "Dans la plateforme livrée, les points forts et axes sont rédigés par le responsable."; preview switch (off by default); mode segmented control *Rédaction par le responsable seul · Rédaction assistée par l'IA*; policy text "L'IA ne modifie jamais une note et ne publie rien sans validation."
6. **Utilisateurs & rôles** (Admin tech): table with role, last login, status; **[Attribuer un rôle]** modal; at least one Admin RH must remain.
7. **Messagerie** (Admin tech): sender, status card with **[Tester la connexion]** (simulated).
8. **Données & sauvegarde** (Admin tech): **[Créer une sauvegarde]**, list with **[Télécharger]**, **[Restaurer]** (severe modal, type "RESTAURER"), retention period.

### 9.16 Aide & anonymat

Quick start per role (3 cards), FAQ (*Qu'est-ce qu'un feedback anonyme ? Qui peut voir mon feedback ? Pourquoi ma note est-elle facultative ? Comment est calculée une moyenne ?*), glossary, and the page **"Comment fonctionne l'anonymat"**: a clear diagram with two lanes (*Feedback nominatif* keeps author → recipient; *Feedback anonyme* is stored with no link to any person), three plain-language guarantees, and a short "Ce qui est enregistré / ce qui ne l'est pas" table. **[Relancer la visite guidée]**.

### 9.17 Profil (drawer)

Avatar color, read-only identity, notification preferences (switches), **[Enregistrer]**.

---

## 10. Cross-screen consistency

- One `PersonChip` (avatar, name, job, department color) with hover card everywhere. An anonymous giver is always rendered by one `AnonymousBadge` ("Anonyme", mask icon), never by a fake name.
- Central status map: Cycle `OUVERT` blue · `ARCHIVE` slate · `A_VENIR` violet; Synthesis `NON_COMMENCEE` grey · `EN_REDACTION` blue · `VALIDEE` green; Task `EN_ATTENTE` amber · `TRAITEE` green · `DECLINEE` grey; Link `ACTIF` green · `EXPIRE` red · `DESACTIVE` grey.
- Dates `12 nov. 2026` / `dans 12 jours`, French locale numbers (`3,8 / 5`), tabular figures.
- Deep links to the exact object, URL-based filters.
- Undo toast for reversible actions; no native `alert/confirm/prompt`.
- `can(user, action, resource)` helper used by routes, menus and buttons; forbidden URL shows a 403 empty state.

---

## 11. Demo script (must work flawlessly)

**A. Collaborateur (Lucas), 2 min:** Accueil → quota ring 3/5 → **[Demander un feedback]** (mission, 4 people) → switch to Claire → answers a request anonymously → back to Lucas: "1 réponse sur 4", still no name.
**B. Donner un feedback (Claire), 90 s:** top-bar **[Donner un feedback]** → pick Lucas → choose *Anonyme* and show "Ce que verra le destinataire" → write answers → optional ratings → send. Open *Mes feedbacks › Envoyés*: not listed, explanation shown.
**C. Preuve d'anonymat, 45 s:** as Admin RH open Journal (no author), Paramètres › Anonymat, and *Aide › Comment fonctionne l'anonymat*.
**D. Responsable (Thomas), 2 min:** Suivi de l'équipe → Lucas → Feedbacks (filters) → scenario ③ → Synthèse → radar, write one strength and one development area by hand, edit one → **[Valider la synthèse]** → **[Exporter en PDF]**. (Optional: in *Paramètres* switch the "Option sur devis" AI preview on to show the draft panel, clearly labelled as a paid option.)
**E. Responsable de mission (Thomas), 2 min:** *Mes missions* → **[Nouvelle mission]** (nom, **numéro OTP**, heures, participants) → *Retours client* → **[Créer un lien]** for a named client (nom, entreprise, e-mail) → demo bar **[Ouvrir le lien client]** → answer as that client → the response appears with the client name and the mission → **[Relancer le client]** on a pending link.
**E2. Admin RH (Sophie), 2 min:** Accueil KPIs → Suivi & rappels (demandes sans réponse, retour obligatoire non réalisé, **[Relancer]**) → Collaborateurs → Paramètres › Règles de visibilité: switch a rule and use **[Voir en tant que…]** → Cycle › Archivage → demo bar "jusqu'à la fin du cycle" → cycle archived, new cycle open. (Sophie has no mission nor client-link screen.)
**F. Admin technique (Karim), 45 s:** Utilisateurs & rôles, sauvegarde, restauration (annuler).

---

## 12. Microcopy, states, edge cases

- Tone: sober, warm, plain French; infinitive verbs on buttons; no exclamation marks except success moments.
- Every list/table: skeleton (300–500 ms on first view), first-use empty state, filtered-empty state with **[Effacer les filtres]**, error state with **[Réessayer]**.
- **Edge cases to simulate:** employee with no feedback yet ("Aucun feedback pour le moment"), competency without ratings ("—"), anonymous feedback without relation (Q10 OFF), request to someone who left (flag "Indisponible"), mission finished with no feedback, cycle end crossing while a draft exists (draft kept, "Cycle archivé : le brouillon ne peut plus être envoyé" with **[Copier le texte]**), client link expired/disabled/maxed, two leaders (Q41), very long names, zero notifications.
- **Avoid:** English strings, lorem ipsum, any weighting or overall score, any "note finale", certification claims.
- **Responsive:** tables become stacked cards under 768 px; drawers become full-screen sheets under 640 px; sidebar becomes a sheet. Mobile must work for: Donner un feedback, Mes demandes, notifications, Accueil and the public client page.

---

## 13. Acceptance checklist

- [ ] Every clickable element does something visible; no native dialogs; no console errors.
- [ ] No self-evaluation anywhere; a user cannot select themselves as recipient.
- [ ] **No overall score or weighting anywhere** (screens, PDF, charts).
- [ ] Sending a named feedback updates recipient counters, quota ring, team view, dashboard, notification, sender's *Envoyés*.
- [ ] Sending an anonymous feedback updates everything except any author-linked list, and the unit test on anonymous records passes; admin journal shows no actor for it.
- [ ] Request counters show "X réponses sur Y" without identifying anonymous answers.
- [ ] Visibility toggles change what each persona sees immediately; **[Voir en tant que…]** updates live.
- [ ] Question wording changes with relation and grade; bank outside 5–8 shows a warning.
- [ ] Synthesis: radar and table agree with feedback data; AI suggestions never appear without a human action; validation locks the fields.
- [ ] PDF preview and print layout are clean A4.
- [ ] Time travel crosses the cycle end: archiving, new cycle, read-only archive with banner.
- [ ] Client link: public page works on mobile; expired/disabled/maxed states; responses appear in the drawer.
- [ ] Role enforcement and 403 state; keyboard (⌘K, `Esc`, focus visible); AA contrast; charts have "Voir en tableau".
- [ ] All strings French; relative dates; no certification claims; first paint under 1 s.
- [ ] Visual QA at 1280, 1440, 1920 and 390 px.

---

## 14. Build phases (feed to AI Studio one at a time)

**Phase 1 — Foundation:** tokens, component library, app shell, router with role guards, store + seed + selectors, `engine.ts` and the anonymity unit test, demo bar (persona, scenario, reset), Entry page.
**Phase 2 — Core feedback loop:** feedback wizard, Mes demandes, Demander un feedback drawer, Mes feedbacks, notifications and bell, role-specific Accueil.
**Phase 3 — Missions and team:** Missions (list, page, drawers), Suivi de l'équipe, page collaborateur, quota rings.
**Phase 4 — Synthesis and cycle:** Synthèse (radar, table, verbatims, editor, AI panel, validation, PDF), Cycles (including archiving, archives viewer), time travel.
**Phase 5 — Admin and referentials:** Suivi & rappels, Compétences & questions, Collaborateurs (drawer, import wizard), Messages, Journal.
**Phase 6 — Client feedback and settings:** Feedback client (wizard, success overlay, drawer, public page), Paramètres (visibility matrix with "Voir en tant que", anonymat, notes, IA, rôles, sauvegarde), Aide & anonymat page, guided tours.
**Phase 7 — Polish:** skeletons, empty/error states, responsive and accessibility passes, run the checklist of section 13.

---

*End of specification.*
