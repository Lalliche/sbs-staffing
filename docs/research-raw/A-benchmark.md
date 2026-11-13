# A - Product benchmark: staffing / resource-management tools

Method: public help centres, product pages and vendor case studies fetched in Nov 2026. Marketing pages rarely give pixel details (row heights, block dimensions, stripe patterns). Where a detail was not found it is marked **[unverified]** or **[design inference]**. Nothing here comes from private or leaked material. No public description of a Big-4 firm's own internal staffing tool was found (see section 8).

Sources: Runn help (People Planner overview, utilization dashboard), Float help (Allocate time, Tentative allocations, Date range insights), Productive help (Capacity indicators), Resource Guru features page, Kantata skills/resource pages, Planview docs (AdaptiveWork Capacity Planning, KeyedIn Scenario Capacity, PPM Pro What-If Workbench), Smartsheet help (workload heatmap), OnePlan/Upland/Oracle heat-map threshold docs, Napta Big-4 case study, Dayshape brief, Workday and SAP marketplace pages, Forecast.app pages.

---

## 1. Information architecture / navigation

Observed across tools:
- **Two lenses on the same data are the norm.** Runn: People Planner vs Project Planner. Productive: Resource Planner "By Person / By Project / By Absence". Float: Schedule (people rows) vs Project view/plan. Rule: the planner toggles *row dimension* (people vs missions), not a separate screen.
- **Planner is the home, dashboards are secondary.** Float, Runn, Resource Guru all open on the grid. Kantata and Planview (enterprise PSA) put a Resource Center/Capacity module beside project lists and gate it by role (Planview AdaptiveWork: only users with the Resource Manager role access Capacity Planning).
- **Demand queue next to supply.** Kantata has a Resource side panel to define and fill open requests by role and skill ("all open and filled requests in one place"). Resource Guru keeps unresolved bookings in a queue until capacity opens. Runn shows placeholders under their team as unmet demand.
- **Saved views and filters are first-class.** Float: saved views. Runn: filtered lists can be saved; favourites (star) are per-user. Kantata: save/combine planning filters by skill, project, dates.
- **Settings in a side "cogwheel" panel, not in the toolbar.** Runn People Planner keeps unit (hours/day, hours/week, FTE, capacity %), "show total effort", summary toggle in a side panel.
- **Enterprise suites (Planview, Workday, SAP) split by persona**: resource manager (supply), project/engagement manager (demand/requests), employee (marketplace/self-service).

Implication for SBS: left rail with ~8 entries max (Dashboard, Planning, Missions, Staffing requests, Capacity, Talent, Timesheets/Leave, Analytics), persona-aware defaults, and a shared top bar (period, department filter, saved view, "include tentative" toggle).

## 2. Planning-grid patterns

- **Rows = people, grouped, collapsible.** Runn groups by Team by default and offers Group By: Default Role, Team, Employment Type, Skills, Tags, Projects, Workstreams, custom fields; an expand/collapse-all icon; group header carries a summary (availability or utilization chart), or only a headcount when the summary is toggled off. Sorting works within a group only. Expanding a person lists their projects/assignments beneath.
- **Zoom levels (Runn, verified):** Week (5 days), Month (5 weeks), Quarter (3 months), Half-year (6 months), Year (12 months), plus custom range with Days/Weeks/Months period. Group summary granularity auto-coarsens: week view = daily, month/quarter = weekly, half-year/year = monthly. Weekends only appear in Month view or custom days. Left/right arrow keys move one week; "Today" button; today column highlighted in blue.
- **Float:** Schedule rows are people; allocations are tiles; confirmed tiles are project-coloured, **tentative tiles are outlined** (verified). Allocations can be percentage-based, hourly or tentative. Date-range insights: drag across dates to get per-person and team totals for a range (capped at 92 days), shown in hours (unscheduled / scheduled / overtime) or %.
- **Block anatomy:** project colour fill + project/client label; hours or % on the block when width allows **[design inference; Float/Runn show it per unit setting, exact rule not documented]**. Runn's "Show total effort" setting prints total effort on each assignment, otherwise only on hover.
- **Units are a user setting**, not a fixed choice: Runn offers hours/day, hours/week, FTE, capacity %. Productive's hover card shows total capacity, booked hours and % incl. tentative, plus the list of bookings.
- **Soft vs hard bookings:** Float outlined (tentative) vs filled (confirmed); Runn "Tentative" toggle includes/excludes tentative load in all availability numbers and charts; Productive "Include Tentative" toggle; Kantata "locked in vs tentative". A global include-tentative switch is the consistent pattern. SBS hatched = soft is consistent with this; hatching specifically is **[not verified in any competitor]**.
- **Free slots:** Runn colours the availability cell itself (see section 3); Resource Guru and Productive show under-use via the same heatmap, so idle time is as visible as overload.
- **Time off:** shown as distinct booking types (Resource Guru) or shaded cells when a full day is booked off (Runn).
- **Drag/resize feedback:** all tools support drag to move, resize to extend, and split/duplicate (Resource Guru: expand, split, duplicate, drag to another resource). Specific ghost/snap visuals are **[unverified]** in public docs.
- **Placeholders** (Runn, Productive, Resource Guru): unnamed "role" rows carrying demand, reassigned later to a person. Direct model for SBS "request for a Senior Audit".

## 3. Heatmap / utilization conventions

| Tool | Scale (verified) |
|---|---|
| Runn People Planner | Availability: green 75-100% free, light blue 50-74, mid blue 25-49, strong blue 0-24, dark blue + red bar = overbooked, shaded = time off. Blue-based ramp, red only for the error state. |
| Runn utilization dashboard | Under 0-80% blue, well utilized 80-100% green, over 100%+ red. Dotted 100% line on charts. |
| Float (date-range) | Grey = within capacity; orange = under 100% overall but overtime exists (uneven load); red = over 100%. Over-capacity day cell: background turns red. |
| Productive | Red = over capacity (darker = more over), green = under (lighter = more free); three densities: with hours / extended / compact / hidden. No numeric cut-offs published. |
| Smartsheet | Red over-allocated, dark grey 100%, medium grey partial, light grey 0% allocated. Neutral-greys for normal states, red reserved for problems. |
| OnePlan | Blue below 100, green 100, yellow >100, red >110 (configurable). |
| Planview | Red box in totals = overload; colours admin-configurable (min/max/target). |

Takeaways: (a) all tools reserve red for over 100%; (b) the calmest palettes (Smartsheet greys, Runn blues) avoid green/amber/red traffic lights for normal states; (c) thresholds are configurable at admin level in enterprise tools; (d) Float's orange = "balance problem hidden by a healthy average" is a smart, rarely copied insight; (e) a 100% reference line on charts is standard.

## 4. Conflict and over-allocation UX

- **Inline, on the cell, not in a modal:** Float turns the day background red; Runn adds a red bar on dark blue; Productive darkens red proportionally to overload.
- **Group-level roll-up:** Float colours the *range summary*; Planview shows a red box in totals; Runn shows group utilization charts above each group.
- **Proactive clash warning before booking:** Resource Guru flags clashes before they become overbookings, with amber + warning symbol; unresolved bookings wait in a queue; optional approval workflow for in-demand people.
- **Resolution assist:** Productive advertises agents resolving double-bookings; Float lets you sort a team by unscheduled time to find who can absorb work; Runn's sort by Availability.
- **Hover cards** with the breakdown of what the person is booked on (Productive, By Person view only) answer "why is this red?" without navigation. Smartsheet: full-screen workload schedule explains overallocation and lists other projects.
- **Non-capacity conflicts** (independence, rotation, certifications): Napta's Big-4 audit case describes team suggestions that account for independence and rotation rules plus conflict checks; step-level UI not public.

## 5. Candidate-matching scorecards

Public detail is thinner than for grids.
- **Kantata (verified from product pages):** recommendations scored on role, availability and skills incl. required proficiency; proprietary match score per candidate; up to 15 recommended resources per open role sorted by fit; admins can set weighting of fields; can run per task, whole project or role and view *cost impact*, then adjust and re-run; "Team Builder" assembles a whole team from required skills. Exact card layout **[unverified]**.
- **Forecast.app:** AI matches project needs to skills/roles and learns over time (self-reported marketing); no scorecard detail public.
- **Workday Opportunity Marketplace:** ML skill matching incl. near-matches; hosts see a "flex team match analysis". No public numeric score found. **SAP:** "intelligent recommendations"; no documented numeric score found.
- **Napta (Big-4 audit):** matching uses skills, rates and costs, with independence/rotation rules; central record of competencies, certifications, independence, availability, budgets. Vendor claim: 50% less planning time.
- **Dayshape (vendor brief about an unnamed Big-4 audit practice):** resource managers *review, adjust and approve* AI recommendations; staffing joined to rate cards/timesheets for margin. Human-in-the-loop framing.

No competitor was found publicly showing side-by-side compare or explicit "blocking criteria" badges: this is a differentiation opportunity for SBS, but the design must be original. The score breakdown / strengths / gaps structure below is **[design inference]**, supported only by Kantata's weighted-fields and proficiency-level model.

## 6. Capacity forecast views

- **Planview AdaptiveWork:** toggle between "Requested demand vs availability" (open requests against remaining availability) and "Demand vs capacity" (total capacity incl. already assigned). Editing requests updates the heatmap live.
- **Planview KeyedIn Scenario Capacity:** capacity by role and department against demand for projects in a scenario, with variance and utilization colour-coded. **PPM Pro What-If Workbench:** assess impact of a new project or changed projects on utilization/role demand.
- **Runn:** Placeholder Demand (FTE) display mode grouped by Default Role = unmet demand by role ("forecast hiring needs"); Capacity / Availability / Utilization charts of future scheduled workload; tentative toggle acts as the simplest scenario control.
- **Kantata:** evaluate multiple resource plans at once and see effect on performance and profit; locked vs tentative.
- **Mosaic** (consulting-focused forecasting vendor) page could not be fetched; no claims made.
- Stacked demand vs capacity with a capacity line, deficit chips per role/grade, and a scenario toggle bar are consistent with the above but exact chart anatomy is **[design inference]**.

## 7. Premium vs cluttered

Feels premium (observed/inferred from the tools above):
- Colour is used for *meaning*: project hue on blocks, one semantic red for overload, neutrals elsewhere (Smartsheet greys; Runn blues).
- Density controls offered to the user (Productive's with hours / extended / compact; Runn units and summary toggle) instead of one cramped layout.
- Settings tucked into a side panel; the toolbar holds only period, grouping, display mode, search.
- Collapsible groups with one-line summary rows; progressive disclosure on hover (total effort, booking list).
- Auto-coarsening granularity at wider zoom.

Feels cluttered:
- Enterprise PPM suites (Planview, legacy Oracle/Upland tools) with many tabs, per-product naming drift and configurable five-band heat-map thresholds; module names differ per product line.
- Traffic-light everywhere (green/amber/red on normal states) and heatmap colours that stack with project colours on the same cell.
- Modal-heavy booking flows **[general observation, not product-verified]**.

## 8. ADOPT / AVOID (with origin)

**Adopt**
1. People/Missions lens toggle on one grid - Productive (By Person/By Project/By Absence), Runn.
2. Group By role/team/skill with per-group summary chart and expand-all - Runn.
3. Zoom presets Week/Month/Quarter/Half-year/Year with auto-coarsening summary granularity, Today button, arrow-key paging - Runn.
4. Global "Include tentative" toggle applied to every number and chart - Runn, Productive.
5. Outlined/different texture for tentative vs solid confirmed (SBS: hatched vs solid) - Float.
6. Red reserved for over 100%; neutral/blue ramp for the rest, with 100% reference line - Runn, Smartsheet.
7. Orange "uneven load" state when the average is fine but individuals are overbooked - Float date-range insights.
8. Drag across dates to get a range summary in hours or % - Float.
9. Density switch (hours / extended / compact) - Productive.
10. Hover card: capacity, booked h and %, list of bookings - Productive.
11. Placeholder rows as unmet demand by role/grade - Runn, Productive.
12. Open-request side panel with weighted-score candidates and cost impact - Kantata.
13. Human-in-the-loop: recommend, then review/adjust/approve - Dayshape, Napta (Big-4 audit use cases).
14. Independence/rotation/certification as hard rule checks, separate from soft score - Napta.
15. Demand vs capacity toggle (requested vs availability / total capacity) - Planview AdaptiveWork.
16. Per-user favourites and saved views - Runn, Float.

**Avoid**
1. Five configurable heat-map bands and admin threshold screens in the first release - Upland/Oracle/Planview style.
2. Traffic-light colouring of ordinary states (green=fine, amber, red) - OnePlan-style yellow>100 / red>110 is noisy.
3. Group-level sorting missing (sort only inside group) - Runn's limitation; offer group sort by deficit.
4. Capacity modules gated behind a single role with different naming across product lines - Planview.
5. Hiding overload only behind hover - Productive's hover card exists for By Person only; keep a visible marker everywhere.
6. Black-box AI "auto-assign" without explanation - Forecast.app marketing; always show score breakdown.

**Big-4 note:** only vendor-side (Napta, Dayshape) descriptions of Big-4 staffing were found; they emphasise annual planning campaigns, partner rotation/independence rules, approval workflows, and margin/rate cards joined to staffing. Details of any firm's own tool are not public.

---

## Top 12 decisions I recommend

1. **One planning grid, People/Missions lens toggle**, default group by department then grade; collapsible groups with a one-line summary strip (avg utilization + count of over-allocated).
2. **Zoom presets: Week / Month / Quarter / Half-year / Year**, summary granularity auto-coarsens (day, week, month); keyboard paging, Today button.
3. **Unit switch (% / hours / days)** in a settings popover; block label shows mission + % (or h) only if width allows, else on hover.
4. **Soft = hatched/outlined, hard = solid**, plus one global "Include soft bookings" toggle driving every number, heatmap and chart.
5. **Colour discipline:** mission hue only on blocks; heatmap ramp is a single-hue blue/slate for availability; **red only for over 100%** (intensity grows with overload); amber/orange only for "uneven load" at group level.
6. **Heatmap as a mode, not a layer** - switching it replaces block fills with availability cells so the two colour systems never overlap.
7. **Conflicts inline:** red cell background + count chip on the row and group header; hover card explains the breakdown and offers "Rebalance" suggestions; pre-drop warning while dragging.
8. **Placeholder rows ("Besoin: Senior Audit")** carry unmet demand; they link to the staffing-request queue and the matching panel.
9. **Matching panel:** ranked candidates, 0-100 score with 4-5 weighted sub-scores (skills, grade, availability, experience, cost/margin), strengths and gaps lines, and **blocking criteria separate from the score** ("Non compatible": independence conflict, missing certification, on leave) shown as a red chip that disables Assign. Side-by-side compare of up to 3 candidates (original; no competitor shows it publicly).
10. **Human-in-the-loop framing:** "Recommended / Review / Approve" - never auto-assign; show the weights used.
11. **Capacity view:** stacked demand (confirmed + soft + pipeline) vs capacity line per grade/skill, 100% reference line, deficit chips ("-2.5 FTE Manager, Q1"), with a scenario toggle bar (include pipeline, add hire, shift mission) - modelled on Planview's requested-vs-capacity toggle and Runn's placeholder demand.
12. **Density and calm:** user-selectable row density (compact 32px / comfortable 40px **[design inference, not a measured competitor value]**), settings in a side popover, saved views and per-user favourites, hover cards for detail - keep the toolbar to period, grouping, display mode, search.
