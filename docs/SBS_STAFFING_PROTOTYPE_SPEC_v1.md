# SBS Staffing & Resource Management — Prototype Specification v1

> **Product (working name):** *SBS Staffing* — Enterprise Resource Management & Intelligent Staffing for SBS (Sovereign Business & Strategy).
> **Author:** SOLRUS. **Goal:** a client-ready, believable **prototype** of the final product, built with the shared prototype kit (`docs/prototype-kit/`).
> **UI language:** French (every visible string). **Code, comments, identifiers:** English.
> **Source:** derived from the functional brief written by SOLRUS for SBS (17 modules). Where the brief says "real backend / PostgreSQL / Node / real authentication", this document **overrides it for the prototype** (section 0.2). Everything *functional* in the brief stays in scope.

---

## 0. How to read and use this document

### 0.1 Your role
Senior product designer + senior front-end engineer. You are building the prototype of a **resource-management and staffing platform for a consulting and audit firm**. It must feel like the internal tool of a large international firm (the standard of PwC / Deloitte / EY / KPMG internal platforms) **without copying anyone's branding, UI or IP**. It must feel like a calm, dense, premium product used for hours every day, not a mock-up.

### 0.2 What is a prototype here (overrides the brief)
| Brief says | Prototype does |
|---|---|
| Node.js API, PostgreSQL, ORM, migrations | **No backend.** One central client-side store, persisted to `localStorage`, seeded deterministically. Same pattern as the sibling project `SBS 360°` (see `docs/sbs360-reference/`). |
| Real authentication, sessions, password reset, login throttling | **Persona switching** (demo bar) + a believable login screen; role = permission set. Password reset / throttling screens exist as static, labelled previews. |
| Server-side permission enforcement | `can(user, action, resource)` enforced in routes, menus and buttons (spec 3.3). Forbidden URL → 403 state. |
| Real e-mail, real storage, real AI API | Simulated and **clearly labelled**: e-mail → notification + log row; documents → in-memory metadata + generated file previews; AI → deterministic assistant over store queries (spec 8.15). |
| PDF / Excel export | Real downloads where cheap (CSV via Blob, `.xls`-compatible CSV for "Excel"), PDF via print stylesheet / A4 preview. |
| "No fake data, no dead buttons" | **Keeps its full force**: every visible control works against the store. Seed data is demonstration data, labelled as such. |

### 0.3 Hard rules
1. **No dead buttons.** Every button, link, tab, row, icon that looks clickable navigates, opens an overlay, changes state, or shows a toast. Anything out-of-demo opens a small "Aperçu" overlay describing the final behaviour. **No empty pages.**
2. **One source of truth.** A single store holds all data. **Every number on screen is computed by selectors** from the store. Never hard-code a figure in a component.
3. **Everything is connected.** Creating a mission, a request, an assignment, a leave, a timesheet entry updates planning, utilization, capacity, KPIs, notifications and audit log **without reload**.
4. **Roles are enforced** (section 3). Hide controls a role cannot use; sensitive data (salaries, costs, confidential evaluations) is absent from the selectors for roles that cannot see it.
5. **Never invent data in a result.** Matching must never invent skills or experience; AI answers must come from real store queries and cite the figures' source.
6. **Business coherence over breadth.** *PRIORITÉ ABSOLUE of the brief: the coherence of the business rules and the real functioning of the staffing engine.* If time is short, cut polish, never cut engine correctness (and its unit tests).
7. **Dates are relative to the demo clock** (`state.now`), never `Date.now()`.
8. **UI language French; code English.** No lorem ipsum. No certification claims. Data labelled fictional.
9. Stack: Next.js (App Router), React, **TypeScript**, Tailwind v4, `motion`, `lucide-react`, custom SVG charts (no heavy chart library needed), Vitest. No backend. Follow `docs/prototype-kit/skills/*` (see 12).

### 0.4 Relationship with the sibling product SBS 360°
`SBS 360° — Talent & Performance` (folder `SBS`, already built) is a **separate product** (feedback per mission). SBS Staffing is **independent**: own repo, own store, own deploy. Design the data so that a future integration is trivial, but build **no connector** now:
- Shared notions: employees, grades, departments, managers, **missions identified by their OTP number**.
- **Never duplicate 360° features.** *Performance & Evaluations* stays **light** here (spec 8.13) and must not contradict the 360° principles (no weights, no global score, feedback ≠ evaluation).

---

## 1. Product in one paragraph

SBS Staffing is the operational control centre of the firm. It answers, permanently: who works here, with which skills and certifications; who is available today / next week / in three months; who works on which mission and for how many hours; which people best match a mission; who is under- or over-loaded; which resource needs are unsatisfied; which skills are missing; what each team costs; what the real capacity is; what recruitment is forecast; how to rebalance between departments. It covers 14 modules (section 8).

---

## 2. Vocabulary (use exactly these French words)

| Term | Meaning |
|---|---|
| **Collaborateur** | Any employee of SBS. |
| **Grade** | Junior · Consultant · Senior · Manager · Partner (configurable list of 5). |
| **Département** | Audit · Expertise comptable · Conseil juridique & fiscal · Stratégie & conseil · Transactions. |
| **Bureau** | Office (e.g. Alger, Oran — placeholders to be replaced by SBS's list). |
| **Mission** | Engagement for a client, identified by a unique **référence** and an **OTP** number. |
| **Besoin de staffing** (requirement) | A seat to fill on a mission: grade, quantity, mandatory/desired skills, period, % allocation. |
| **Demande de staffing** (request) | A manager's formal request, processed by the Resource Manager. |
| **Affectation** (assignment) | A collaborateur on a mission for a period at a %, with hours and a status. |
| **Soft booking / Hard booking** | Provisional reservation / confirmed assignment counted in capacity (spec 7.5). |
| **Capacité** | Theoretical / available capacity in hours (spec 7.1). |
| **Taux d'utilisation planifié / réel / de facturabilité** | Spec 7.2. |
| **Timesheet** | Weekly time sheet, validated by the manager. |
| **Marketplace** | Internal market of mission opportunities. |
| **Certitude** | Confirmée · Probable · Opportunité (forecast weighting, spec 7.8). |

---

## 3. Roles, permissions and navigation

### 3.1 Roles
`SUPER_ADMIN`, `ADMIN`, `DIRECTION`, `PARTNER`, `RESOURCE_MANAGER`, `MANAGER`, `RH`, `COLLABORATEUR`. A user has **one primary role** and may hold extra flags (e.g. a Manager is also a Collaborateur — "same person may cumulate profiles").

### 3.2 Navigation (14 modules) × role

| # | Module | Super Admin / Admin | Direction | Partner | Resource Mgr | Manager | RH | Collab. |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| 1 | Dashboard | ✅ (admin variant) | ✅ executive | ✅ own scope | ✅ staffing | ✅ team | ✅ HR variant | ✅ personal |
| 2 | Staffing & Planning | 👁 | 👁 | 👁 scope | ✅ edit | 👁 scope (+ drag own missions) | 👁 | 👁 own |
| 3 | Missions & Projets | 👁 | 👁 | ✅ own dept | ✅ | ✅ own missions (create) | — | 👁 own |
| 4 | Collaborateurs | ✅ | 👁 consolidated | 👁 scope | 👁 | 👁 scope | ✅ | 👁 own profile |
| 5 | Skills Management | ✅ referential | 👁 | 👁 | ✅ search / matrix | ✅ validate | ✅ | ✅ own |
| 6 | Disponibilités & Absences | 👁 | 👁 | 👁 | ✅ | ✅ approve | ✅ | ✅ own requests |
| 7 | Staffing Requests | 👁 | 👁 | ✅ approve | ✅ process queue | ✅ create | — | — |
| 8 | Timesheets | 👁 | 👁 | 👁 | 👁 | ✅ validate team | 👁 | ✅ own |
| 9 | Capacity Planning | 👁 | ✅ | ✅ | ✅ | 👁 scope | 👁 | — |
| 10 | Talent Marketplace | 👁 | 👁 | ✅ publish | ✅ | ✅ publish / select | 👁 | ✅ apply |
| 11 | Performance & Evaluations (light) | 👁 | 👁 | ✅ | — | ✅ evaluate | ✅ confidential read | ✅ own non-confidential |
| 12 | Analytics & Reporting | 👁 | ✅ | ✅ scope | ✅ | ✅ scope | ✅ HR reports | — |
| 13 | Notifications | ✅ all | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 14 | Administration & Paramètres | ✅ | 👁 | — | settings of staffing rules only | — | roles view | — |

(✅ = full for that role's scope, 👁 = read-only, — = hidden.) The matrix above is the **default**; `Administration › Rôles & permissions` must let a Super Admin edit it live (every action is a permission string, e.g. `assignment.create`, `timesheet.validate`, `employee.salary.read`).

### 3.3 Permission rules to demonstrate
- A **collaborateur** sees own profile, own assignments, own timesheets, own leave; **cannot** see salaries/day rates/costs, confidential evaluations, or other people's personal data.
- A **manager** sees resources and missions **of his/her scope** (department / own missions).
- A **resource manager** manages assignments within granted permissions.
- **Direction** sees consolidated indicators; **RH** manages people data, not missions or assignments.
- `can(user, action, resource)` is used by routes, menus, buttons and selectors; forbidden URL → 403 empty state; sensitive fields are stripped in selectors, not just hidden in the UI.

### 3.4 Demo personas (demo bar → "Voir en tant que")
Use a **fictional** cast (never real people). You may reuse the SBS 360° cast names for continuity, except real people.
*Super Admin* (technical), *Direction générale*, *Partner (Audit)*, *Resource Manager*, *Manager (Audit)*, *RH*, *Collaborateur (Senior, Audit)*, *Collaborateur (Junior)*.

---

## 4. Demo layer (separate from the product UI)

A 40 px bar fixed at the top (dark neutral, collapsible, `Ctrl+Shift+D`), identical in spirit to SBS 360°.

| Control | Behaviour |
|---|---|
| **Voir en tant que** | Persona switch, 200 ms fade, keep route if allowed. |
| **Scénario** | ① *Démarrage* (few assignments) ② *Activité normale* (default) ③ *Pic de charge — conflits et déficits* (overloads, unsatisfied requests, deficit of Seniors) ④ *Fin d'année — prévisions de recrutement*. Rebuilds the seed deterministically. |
| **Avancer le temps** | +1 jour / +1 semaine / +1 mois. Triggers: timesheet reminders, expiring certifications, leave start/end, soft bookings expiring, utilization alerts. |
| **Simuler une demande** | Adds a plausible staffing request / leave request / marketplace application so queues move live. |
| **Visite guidée** | Role-specific coach marks (6–8 steps). |
| **Réinitialiser** | Modal then reset to current scenario. |

The product UI never mentions "démo" except a discreet `Version de démonstration — données fictives` in the sidebar footer and the login screen.

---

## 5. Design system — decided by UX research (do NOT take it from the brief)

The brief's art-direction paragraph (navy, deep blue, grey, white) is **a starting hypothesis only**. The brand and design system of SBS Staffing are decided by a **UX/brand research step** (agents) before any UI code — see `docs/START_PROMPT.md`. Constraints that survive the research:

- **Mood:** enterprise, premium, sober, modern, calm; dense but perfectly legible tables; refined data-viz; light, fluid motion.
- **Status semantics (fixed):** green = normal, orange = alert, red = conflict / urgency. Never colour alone: always dot/icon + label (and dash/marker on charts).
- **Avoid:** generic template look, overloaded UIs, excessive gradients, glass effects, over-saturated colours, giant headings wasting space, consumer-app feel.
- **Must feel related to SBS, not identical to SBS 360°:** the SBS identity (see `docs/sbs-brand-reference/`: ink `#050703`, red `#E4042C`, warm beige `#F3F0EA`, Didone-serif wordmark) is an input the research must weigh. The research decides whether the product inherits it, adapts it, or defines a sibling sub-brand — with a written rationale.
- **Typography:** one UI family with tabular numerals for every figure; at most one display face, only for marketing/empty moments (if any). No marketing landing page is required for this product: the entry is a **login / persona screen** (premium, short motion), then the app.
- **Layout:** collapsible left sidebar, top bar (global search ⌘K, notifications, help, user menu), central workspace, breadcrumbs, detail pages with tabs, contextual menus, modals/drawers, filterable dense tables. Desktop-first, usable on tablet; mobile must work for: Accueil, Mes timesheets, Mes congés, Marketplace, Notifications.
- **Component inventory (build once, reuse):** Button, Input/Select/Combobox/Multi-select, DatePicker + range, Switch, Slider, SegmentedControl, Tabs, Badge/StatusPill, Avatar, Tooltip, Popover, Menu, Modal, Drawer, Wizard, Toast (+ Undo), Callout, Stepper, ProgressBar/Ring, Skeleton, EmptyState, **DataTable** (sticky header, sort, filters, bulk, saved views, column chooser, density, pagination, CSV export), KPI card, Timeline, CommandPalette, PeoplePicker, **Planning grid (resource × time, drag-and-drop)**, **Heatmap**, **Gantt**, Line/Bar/Stacked/Donut/Sparkline charts, Matrix, Scorecard (match breakdown), Kanban/queue.

Back-office patterns, overlays, destructive actions, forms, empty/loading states, accessibility: follow section 5.5 of `docs/sbs360-reference/SBS360_PROTOTYPE_SPEC_v2.md` (same rules apply).

---

## 6. Data model (TypeScript; ids are strings)

Entities (all required by the brief; prototype keeps them in one store):
`User`, `Role`, `Permission`, `Employee`, `Department`, `Office`, `Grade`, `Skill` (+ `SkillCategory`), `EmployeeSkill`, `Certification`, `EmployeeCertification`, `Client`, `Project` (mission), `ProjectPhase`/milestones, `StaffingRequirement`, `StaffingRequest`, `Assignment`, `Availability`, `LeaveRequest`, `Holiday`, `Timesheet`, `TimesheetEntry`, `Evaluation`, `MarketplaceOpportunity`, `MarketplaceApplication`, `Notification`, `Document`, `AuditLog`, `Forecast` (pipeline items), `Setting`.

Key fields (non-exhaustive — follow the brief for the rest):
- `Employee` { id, matricule (unique), firstName, lastName, photo?, email, phone, jobTitle, gradeId, departmentId, officeId, managerId, contract (`CDI|CDD|STAGE|CONSULTANT`), weeklyHours, startDate, endDate?, status (`ACTIF|ARCHIVE|CONGE_LONG`), bio, yearsExperience, sectors[], languages[], diplomas[], dailyCost (**restricted**), dailyRate? (**restricted**), skills[] }
- `Skill` { id, name, categoryId, description, expectedLevel, certificationIds[], active }; `EmployeeSkill` { employeeId, skillId, level (1 Débutant · 2 Intermédiaire · 3 Avancé · 4 Expert), selfLevel?, validatedById?, validatedAt?, updatedAt, evidence?, experienceNote }
- `Project` { id, reference (unique), otp, name, clientId, description, departmentId, leadId, type, priority (`BASSE|NORMALE|HAUTE|URGENTE`), startDate, endDate, estimatedDays, budget, currency (`DZD`), resourceBudget, estimatedDailyCost, dailySellPrice?, certainty (`CONFIRMEE|PROBABLE|OPPORTUNITE`), status (`EN_ATTENTE_STAFFING|A_VENIR|ACTIVE|TERMINEE|ANNULEE`), phases[], milestones[], sector }
- `StaffingRequirement` { id, projectId, gradeMin, quantity, mandatorySkillIds[], desiredSkillIds[], minExperienceYears, startDate, endDate, allocationPct, priority }
- `Assignment` { id, employeeId, projectId, requirementId?, startDate, endDate, allocationPct, plannedHours, status (`SOFT|HARD|ANNULEE|TERMINEE`), validatedById?, softExpiresAt?, exceptionReason? }
- `LeaveRequest` { id, employeeId, type (`CONGE_ANNUEL|MALADIE|FORMATION|DEPLACEMENT|MISSION_INTERNE|EXCEPTIONNEL|TEMPS_PARTIEL`), startDate, endDate, status (`BROUILLON|SOUMISE|APPROUVEE|REFUSEE`), approverId?, comment? }
- `StaffingRequest` { id, reference, projectId, requesterId, grade, quantity, skillIds[], startDate, endDate, estimatedLoad, priority, justification, status (`BROUILLON|SOUMISE|EN_ANALYSE|PROPOSITION_ENVOYEE|EN_ATTENTE_VALIDATION|APPROUVEE|REJETEE|ANNULEE|SATISFAITE`), proposedEmployeeIds[], handledById? }
- `Timesheet` { id, employeeId, weekStart, status (`BROUILLON|SOUMIS|VALIDE|REJETE|CORRECTION_DEMANDEE`), validatedById?, comment? }; `TimesheetEntry` { timesheetId, projectId|internalCode, date, hours, billable, activityType, description }
- `Evaluation` { id, employeeId, projectId, evaluatorId, criteria (qualité, délais, technique, autonomie, communication, esprit d'équipe, relation client, responsabilités: 1–5 each, optional), strengths, improvements, trainingRecommendation, confidential (bool), createdAt } — **light** (spec 8.13).
- `AuditLog` { id, ts, actorId, action, entity, entityId, before?, after?, reason? } — **every sensitive write** (assignment changes, exceptions, validations, role changes, imports).
- `Settings` { scoring weights (30/25/15/15/10/5), blocking criteria on/off, utilization targets per grade & department, overload/under-use thresholds, forecast weights per certainty, working-day calendar per office, holidays per office, soft-booking expiry days, timezone, default currency, language `fr` (architecture ready for `en`) }.

Rules: unique matricule and mission reference; archived employees keep their history; assignments reference existing employees/missions; deleting is replaced by archiving; never delete audit logs.

---

## 7. Calculation and business rules (pure functions in `engine/*.ts`, unit-tested)

### 7.1 Capacity
`theoretical(employee, period)` = Σ over working days in period of (`weeklyHours / workingDaysPerWeek`), using the **office calendar** (weekends, holidays).
`available(employee, period)` = theoretical − absences (approved leaves, training, travel counted once) − confirmed (HARD) assigned hours.
**Never count the same unavailability period twice** (merge overlapping absences/holidays before summing).

### 7.2 Utilization (never confuse planned and real)
- **Planned utilization** = (assigned hours in period) / (theoretical capacity) × 100 — assigned = HARD (and optionally SOFT, configurable view toggle).
- **Real utilization** = (hours actually worked, from VALIDATED timesheets) / (theoretical capacity) × 100.
- **Billability** = (billable hours validated) / (theoretical capacity) × 100.
Period selectable (week / month / quarter / custom). **Targets** configurable per grade and per department; **alerts** configurable (under-use below X %, overload above Y %). Default thresholds: sous-occupé < 60 %, surchargé > 100 %.

### 7.3 Matching score (0–100, weights configurable; default)
| Criterion | Points | Notes |
|---|---:|---|
| Compétences | 30 | Coverage of mandatory then desired skills, weighted by level ≥ requested. |
| Disponibilité | 25 | Share of the requested period × allocation actually free (after absences + existing HARD/SOFT). |
| Expérience sectorielle | 15 | Sector match (profile + past missions). |
| Grade | 15 | 15 at/above minimum grade, decreasing below. |
| Certifications | 10 | Associated certifications held and valid. |
| Historique pertinent | 5 | Similar past missions. |

**Blocking criteria (configurable):** missing mandatory skill, grade below mandatory minimum, **unavailable** → the candidate is returned **with a "Non compatible" flag and the blocking reason**, never presented as a perfect match, and can't be auto-selected. Per candidate show: global score, per-criterion breakdown, strengths, missing skills, real availability, conflicts, estimated cost (only if the viewer may see costs), current missions. **Never invent skills or experience.**

### 7.4 Assignments and conflicts
Create/modify/cancel/replace; assign one person to several missions; propose a replacement. Each assignment has validator, hours, %.
The engine **prevents or flags**: (a) total allocation > 100 % of the person's capacity over any day (overlap), (b) beyond contract dates, (c) during approved leave/holiday, (d) incompatible with working hours/part-time. A **habilitated** user may authorise an **exception** with a written justification; it is logged (`AuditLog.reason`).

### 7.5 Soft vs hard booking
- **SOFT** = provisional reservation (expires after N days, default 7 → notification). Counted in "réservé" views, **not** in confirmed capacity.
- **HARD** = confirmed, in the official planning and **counted in capacity and utilization**.
- Convert SOFT → HARD with conflict re-check.

### 7.6 Leave workflow
Collaborateur submits → manager notified → approves/refuses → calendar updated → matching/availability recomputed. Holidays configurable per country/office.

### 7.7 Timesheets
Draft → Submitted → Validated | Rejected | Correction requested. Weekly view with totals; reminders; anomaly detection (> daily/weekly max, hours on leave days, on unassigned missions); a **validated timesheet cannot be edited** except through a **traced correction procedure**.

### 7.8 Capacity planning / forecast
Compare **available capacity** vs **forecast demand**, for 1 / 3 / 6 / 12 months, by grade and by skill. Demand = Σ requirements of missions weighted by certainty: default **Confirmée 100 %, Probable 60 %, Opportunité 25 %** (configurable). Output: needs by grade/skill, future availability, **deficits**, surpluses, overload risks, **recruitment needs**. Example the engine must reproduce: 3 bank-audit missions need 5 Seniors, only 3 free → "Déficit : 2 Seniors".

### 7.9 Notifications (in-app + e-mail log)
New staffing request · assignment confirmed · mission modified · new marketplace application · leave request · approval/rejection · timesheet not submitted / awaiting validation · planning conflict · overload · **certification expiring** · mission without complete team. Preferences per user; read/unread; history.

---

## 8. Modules — screens, buttons, overlays

Unless stated, mutations create an `AuditLog` row and (when relevant) a notification.

### 8.1 Dashboard (per role)
- **Executive (Direction/Admin):** KPI row (all computed): collaborateurs actifs · disponibles · affectés · missions actives · missions à venir · missions en attente de staffing · taux d'utilisation (planifié + réel, shown separately) · taux de facturabilité · sous-occupés · surchargés · demandes ouvertes · demandes urgentes. Each KPI is clickable (drills into the filtered list).
- **Charts:** monthly utilization trend · headcount by grade · by department · by availability · billable vs non-billable hours · workload by department · missions by status · 3-month capacity forecast.
- **Global filters:** période, département, bureau, grade, manager, type de mission → recompute all KPIs/charts. **Export PDF / Excel.**
- Other roles get their own variant (Resource Manager: queue + conflicts + unstaffed missions; Manager: team load; RH: leave/archives/certifications; Collaborateur: my week, my assignments, my timesheet status, my open leave requests).

### 8.2 Staffing & Planning
Views: jour · semaine · mois · trimestre · par mission · par collaborateur · par département. Rows = people, columns = periods; assignments are coloured blocks (mission, client, %, period, status; soft = hatched, hard = solid). **Drag-and-drop to move, resize to change dates, edit % inline**; zoom; filters; conflict markers; free-period visualisation; **heatmap** (disponible / partiel / plein / surchargé); export PDF. Drops are validated by the engine (conflict modal with *Annuler / Autoriser l'exception*). Synchronised with collaborateurs, missions, absences, requests.

### 8.3 Missions & Projets
List (référence, nom, client, département, responsable, début/fin, budget, ressources nécessaires/affectées, statut, **taux de staffing**) with search/filters/saved views. **Create/Edit wizard:** Informations générales · Planning (dates, durée, jalons, phases) · Finances (budget, devise, budget ressources, coût/jour estimé, prix de vente/jour si dispo) · **Besoins en ressources** (multiple rows: grade, quantité, compétences obligatoires/souhaitées, expérience, dates, %, priorité). **Mission page tabs:** Informations générales · Besoins de staffing · Équipe affectée · Planning · Timesheets · Budget et coûts · Documents · Historique; with a team-composition visual and requirement **coverage rate**.

### 8.4 Moteur de staffing (the heart)
From a requirement or a mission: **"Trouver des candidats"** opens the matching panel (7.3): ranked candidates with scorecard, filters, side-by-side comparison, **[Affecter]**, **[Réserver (soft)]**, multi-select **[Affecter la sélection]**, **[Proposer un remplacement]**. Edit/cancel/convert assignments; conflicts per 7.4; exception flow with justification.

### 8.5 Collaborateurs
Table (photo, nom, matricule, poste, grade, département, manager, compétences principales, taux d'utilisation, disponibilité, statut) with instant search, multi-criteria filters, sort, pagination, **CSV/Excel export**, **import wizard** (file → mapping → validation table with inline fixes → result + error report). **Create/Edit form** in sections (personnel / professionnel / profil / complémentaire). **Fiche tabs:** Vue générale · Informations professionnelles · Compétences · Certifications · Missions actuelles · Historique des missions · Planning personnel · Timesheets · Évaluations · Documents. Everything audited. **Archive** (never delete) keeps history; "Restaurer".

### 8.6 Skills Management
Referential (categories: Audit, Finance, Comptabilité, Fiscalité, Conseil en stratégie, Risk Management, Transaction Services, RH, Technologie, Data Analytics, Juridique; each skill: nom, catégorie, description, niveau attendu, certifications associées, actif/inactif). Levels 1–4 (labels configurable). Per employee: self-assessment, **manager validation**, last update, evidence, linked experience. **Advanced search** (e.g. "niveau avancé en audit financier + secteur bancaire + certification IFRS") with instant filterable results, and a **skills matrix** by department × grade × sector (heat-coloured).

### 8.7 Disponibilités & Absences
Global availability calendar (people × days) with leave types, holidays (configurable per country/office), part-time. **Leave request workflow** (7.6) with notifications; the staffing engine recomputes availability; no double counting.

### 8.8 Staffing Requests
Portal for managers (create/edit/submit) and a **processing queue** for the Resource Manager (statuses in section 6). Request detail: requirement, proposed candidates (from the matching panel), decision, comments, history. Satisfied automatically when the requirement is fully covered by HARD bookings.

### 8.9 Timesheets
Collaborateur: weekly grid (missions + internal codes), billable flag, activity type, description, **draft / submit**. Manager: **validation queue** (validate / reject / request correction + comment), anomalies panel, reminders, history, **Excel export**. Validated sheets locked (correction procedure, traced).

### 8.10 Capacity Planning
Per 7.8: horizon switch (1/3/6/12 mois), by grade and by skill, stacked demand vs capacity, deficit/surplus chips, overload risks, **recruitment needs** table, certainty weighting editable (scenario sliders), "what-if" (add a probable mission → see impact).

### 8.11 Talent Marketplace
Managers publish opportunities (mission, skills, dates, % , deadline). Collaborateurs browse/filter, see requirements, **express interest / apply**, track their application. Managers review applications and shortlist. **An application never creates an assignment**: the decision stays with a habilitated user (button leads into the normal assignment flow).

### 8.12 Notifications
Centre with tabs (Tout / Non lues / par type), mark read, preferences (internal + e-mail log), history; bell popover (380 px) with deep links.

### 8.13 Performance & Évaluations — **LIGHT**
Only: end-of-mission **evaluation form** (the 8 criteria 1–5 optional, strengths, improvements, training recommendation, confidential flag) by the manager; a per-employee **history synthesis** (timeline + criterion averages — *simple averages, no global score, no weights*); access control (confidential entries visible to RH / Partner / evaluator only; the collaborateur sees non-confidential ones). Not a 360° tool: no anonymous feedback, no self-evaluation here.

### 8.14 Analytics & Reporting
Reports (all filterable and exportable CSV/Excel, printable PDF): utilization by employee · by department · billability · workload by grade · forecast availability · staffing by mission · **uncovered missions** · resource cost by mission · average cost by grade · forecast profitability · billable vs non-billable · assignment history · skills evolution · recruitment forecast. Professional charts + detailed tables with "Voir en tableau" toggle on every chart. Cost/profitability reports only for roles with the cost permission.

### 8.15 Intelligence artificielle — "SBS Staffing Intelligence"
In-app assistant (drawer + ⌘K entry). **Prototype = deterministic and honest:** an intent router over real store queries; every number comes from a selector and is shown with its source ("Basé sur 12 collaborateurs, période…"). Capabilities: (a) **CV analysis** — upload a PDF/DOCX *(simulated parsing of a sample CV into extracted experiences, skills, diplomas, certifications, sectors)*, then a **validation screen** before anything is saved to the profile; (b) **staffing assistant** ("Trouve les meilleurs consultants pour une mission d'audit dans le secteur bancaire") → runs the matching engine and explains; (c) **executive Q&A** (examples in the brief: disponibilités du mois prochain, département le plus surchargé, missions non staffées, compétences insuffisantes, taux d'utilisation réel, Seniors disponibles en janvier); (d) **forecast risks** (overload, skills deficits). The AI **never** makes a final assignment or an HR decision; it only drafts/proposes. Respect RBAC: it only reads data the connected user may see. A settings screen shows the **provider connection (API key placeholder)** and a "fonctionne sans IA" fallback note — core features do not depend on it.

### 8.16 Administration & Paramètres
Users and **roles & permissions editor** (matrix of permission strings, per-role); referentials (departments, offices, grades, skill categories, certifications, holidays); **scoring weights, blocking criteria, utilization targets, thresholds, forecast certainty weights, soft-booking expiry**; notification templates; **audit log** (filter by actor / entity / date, before/after diff); data (import/export), theme (logo/colours), timezone, language (fr; en-ready architecture), "Réinitialiser les données de démonstration". Security previews (password policy, login throttling, session list) are static labelled screens.

### 8.17 Global behaviours
Global search ⌘K (people, missions, requests, assignments, skills, actions). Breadcrumbs everywhere. Every list: search, filters, sort, pagination (where long), empty state, skeleton (300–500 ms on first view), error state. Sensitive operations ask confirmation; successes show a toast (undo when reversible). Data refreshes after every operation. Keyboard shortcuts documented in the help drawer.

---

## 9. Seed data and storylines (deterministic, labelled fictional)

**Volumes (minimum):** 40 collaborateurs · 5 départements · 5 grades · ~30 compétences (11 catégories) · 15 missions · 10 clients fictifs (generic names, never real companies) · 30 affectations (mix SOFT/HARD) · leave requests (approved, pending, refused) · timesheets for the last 8 weeks · 6–8 staffing requests across statuses · evaluations · notifications · pipeline items (Confirmée / Probable / Opportunité) · certifications (some expiring within 30 days) · holidays for the office calendar.

**Storylines to make visible:**
- One **overloaded** employee (120 %) and 3 **under-used** (< 50 %) — shows on dashboard, heatmap, alerts.
- A **conflict** waiting to happen: a Senior booked at 60 % on mission A, asked for 60 % on mission B → engine flags it; exception flow demonstrable.
- A mission **"en attente de staffing"** with a ready-to-run matching (best candidate ~90, one blocked for missing mandatory skill, one unavailable because of approved leave).
- **Capacity deficit**: bank-audit pipeline needs 5 Seniors, 3 free → "Déficit : 2 Seniors" in 3 months.
- A **leave request pending** that, once approved, removes the person from candidates.
- A **timesheet** awaiting validation with an anomaly (hours during leave).
- A **certification expiring** (IFRS) → notification.
- Marketplace: 3 open opportunities, 2 applications.
- Scenario ③ amplifies overloads and unsatisfied requests; scenario ④ shows a recruitment forecast.

Clients, names, certifications: **fictional or generic** (e.g. « Groupe bancaire A », « Industriel B »); never real client or real people names. Currency DZD, French locale numbers (`1 234 567 DZD`, `3,8 / 5`).

---

## 10. Demo script (must work flawlessly)

**A. Resource Manager (4 min):** Dashboard (unstaffed mission) → Mission → "Trouver des candidats" → scorecards (blocked / unavailable shown honestly) → soft-book 2, hard-book 1 → availability and utilization update → drag a block in Planning → conflict modal → authorise exception with justification → Audit log shows it.
**B. Manager (2 min):** create a mission with requirements (1 Manager, 2 Seniors, 3 Juniors) → create a staffing request → watch it appear in the Resource Manager queue; approve a leave request → person disappears from candidates.
**C. Collaborateur (90 s):** My week → fill and submit a timesheet → Marketplace: apply → My leave request.
**D. Direction (2 min):** Executive dashboard with filters → Capacity Planning 6 months (deficit of 2 Seniors) → what-if (add probable mission) → ask the AI "Combien de Seniors seront disponibles en janvier ?" → export PDF.
**E. RH (60 s):** import employees (wizard with an error row) → archive a leaver → confidential evaluation visibility.
**F. Super Admin (60 s):** edit a role's permissions live → persona with that role loses/gains a button immediately; change scoring weights → ranking changes.

---

## 11. Acceptance checklist

- [ ] Every clickable element does something visible; no native dialogs; no console errors; no empty page.
- [ ] Every number is computed from the store (no hard-coded figures); filters recompute KPIs/charts.
- [ ] Matching: score = weighted breakdown; blocking criteria enforced; unavailable/under-graded candidates flagged, never shown as perfect; no invented skills.
- [ ] Soft vs hard booking behave per 7.5; capacity counts only HARD (reserved views may add SOFT).
- [ ] Conflict detection covers overlap/100 %, leave, contract dates, part-time; exception requires a justification and is logged.
- [ ] Leave approval recomputes availability; no double counting of overlapping absences/holidays.
- [ ] Planned ≠ real utilization; billability formula respected; targets per grade/department; alerts configurable.
- [ ] Timesheet workflow + lock after validation + traced correction.
- [ ] Capacity planning weights (100/60/25 default) and "Déficit : N Seniors" example reproduced.
- [ ] RBAC: collaborateur cannot see salaries/costs/confidential evaluations; manager limited to scope; role editor changes behaviour live; 403 state.
- [ ] Audit log records assignment changes, exceptions, validations, role changes, imports.
- [ ] Persistence: refresh keeps data; reset restores scenario.
- [ ] AI answers come from store queries with sources; never assigns on its own; CV parse requires validation.
- [ ] Exports work (CSV/Excel + printable PDF); import wizard validates and reports errors.
- [ ] All strings French; relative dates; fictional data labelled; first paint < 1 s; AA contrast; keyboard + focus; visual QA at 1280 / 1440 / 1920 and a tablet width.
- [ ] Unit tests (Vitest) cover: capacity, utilization (planned/real/billable), scoring + blocking, conflicts, soft→hard, leave effect on availability, timesheet states, forecast deficit, RBAC (`can`), audit logging.

---

## 12. Build phases (the build session follows these in order)

**Phase 0 — Research and brand (before any UI code):** UX/brand research with agents → `docs/ux-research.md`, `docs/design-system.md`, `docs/motion-plan.md`, logo/wordmark decision.
**Phase 1 — Foundation:** project setup, tokens, UI primitives, app shell, router with role guards, store + seed + selectors, `engine/*` + tests, demo bar, login/persona entry.
**Phase 2 — People and referentials:** Collaborateurs (list, form, fiche, import, archive), Skills (referential, search, matrix), Administration basics (departments, grades, offices).
**Phase 3 — Missions and the staffing engine:** Missions (wizard, page), requirements, matching + scorecards, assignments, soft/hard, conflicts + exceptions, audit log.
**Phase 4 — Planning and availability:** planning grid (drag, resize, heatmap, views), leave workflow, holidays.
**Phase 5 — Control:** utilization, timesheets, dashboards (all roles), capacity planning + what-if.
**Phase 6 — Collaboration modules:** staffing requests, marketplace, evaluations (light), notifications.
**Phase 7 — Intelligence and reporting:** analytics/reports + exports, AI assistant (deterministic), CV analysis flow.
**Phase 8 — Administration and polish:** roles/permissions editor, settings, skeletons/empty/error states, responsive + accessibility passes, run the checklist of section 11.

*End of specification.*
