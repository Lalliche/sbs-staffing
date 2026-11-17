/* SBS Staffing Intelligence — deterministic intent router over REAL store queries (spec 8.15).
   Pure: (state, text) → structured answer with figures, source line and links. It never assigns, never invents,
   and respects RBAC (it reads only through scoped selectors / permission checks). */
import { availableCountByGrade, forecastByGrade, forecastBySkill, deficitLabel, monthlySeries } from "../engine/forecast";
import { candidatePool, rankCandidates } from "../engine/matching";
import { addDays, addMonths, monthEnd, monthStart } from "../engine/dates";
import { fmtDec, fmtHours, fmtMonth, fmtPct } from "../engine/format";
import { statusOf, utilizationOf, utilizationOfGroup } from "../engine/utilization";
import { presenceOn } from "../engine/workmode";
import { availabilityOf } from "../store/selectors/people";
import { canDo, sessionUser } from "../store/selectors/core";
import { presenceSummary } from "../store/selectors/presence";
import { lastClosedWeekEnd, scopedEmployees, unstaffedMissions } from "../store/selectors/dashboard";
import type { AppState, Employee } from "../store/types";
import type { AiAnswer, IntentId } from "./types";
import { hasPhrase, normalize } from "./normalize";

const MONTHS = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const GRADE_WORDS: [string, string][] = [["junior", "g-1"], ["consultant", "g-2"], ["senior", "g-3"], ["manager", "g-4"], ["partner", "g-5"], ["associe", "g-5"]];
const SECTOR_WORDS: [string[], string][] = [[["bancaire", "banque", "assurance"], "Banque & assurance"], [["industrie", "industriel"], "Industrie"], [["energie", "energetique"], "Énergie"], [["telecom", "telecoms"], "Télécoms"], [["public", "publique"], "Secteur public"], [["distribution", "commerce"], "Distribution"], [["agroalimentaire"], "Agroalimentaire"], [["immobilier"], "Immobilier"]];
const SKILL_WORDS: [string[], string][] = [[["audit", "audit financier", "commissaire"], "sk-audit-fin"], [["ifrs", "normes ifrs"], "sk-ifrs"], [["fiscal", "fiscalite"], "sk-fisc-ent"], [["due diligence"], "sk-dd"], [["evaluation", "valorisation"], "sk-valo"], [["strategie"], "sk-strat"], [["conformite"], "sk-conf"], [["data", "donnees"], "sk-data"], [["risque", "risques"], "sk-risk"], [["consolidation"], "sk-conso"]];

const has = (n: string, ...ps: string[]) => ps.some((p) => hasPhrase(n, p));
export const SUGGESTIONS = [
  "Combien de Seniors seront disponibles en janvier ?",
  "Trouve les meilleurs consultants pour une mission d’audit dans le secteur bancaire",
  "Quel département est le plus surchargé ?",
  "Quelles missions ne sont pas staffées ?",
  "Quelles compétences sont insuffisantes ?",
  "Qui est sur site aujourd’hui ?",
  "Quel est le taux d’utilisation ?",
];

function detectIntent(n: string): IntentId {
  if (has(n, "cv", "curriculum", "analyser un cv")) return "cv";
  if (has(n, "affecte", "affecter", "assigne", "assigner", "nomme") && !has(n, "non affecte")) return "assign_refuse";
  if (has(n, "cout", "couts", "salaire", "salaires", "remuneration", "tarif", "rentabilite", "marge")) return "cost";
  if (has(n, "trouve", "trouver", "meilleurs", "meilleur", "candidat", "candidats", "propose", "profils", "profil") && has(n, "mission", "consultant", "consultants", "senior", "seniors", "manager", "junior", "juniors", "equipe")) return "staffing";
  if (has(n, "combien") && has(n, "disponible", "disponibles", "libres", "libre")) return "availability_grade";
  if (has(n, "plus surcharge", "surcharge", "surcharges", "surcharges") && has(n, "departement", "departements")) return "overloaded_dept";
  if (has(n, "pas staffees", "non staffees", "sans equipe", "a staffer", "non staffe", "missions non staffees", "staffees") && has(n, "mission", "missions")) return "unstaffed";
  if (has(n, "competences insuffisantes", "competence insuffisante", "manque de competences", "competences manquantes", "deficit de competences", "competences") && has(n, "insuffisantes", "manquantes", "deficit", "insuffisante", "gap")) return "skills_gap";
  if (has(n, "sur site", "presentiel", "a distance", "teletravail", "en remote", "remote", "qui travaille", "au bureau")) return "presence";
  if (has(n, "taux d utilisation", "utilisation", "utilises")) return "utilization";
  if (has(n, "risque", "risques", "alerte", "alertes", "prevision", "previsions", "deficit", "deficits", "recrutement", "recruter")) return "risks";
  if (has(n, "qui est disponible", "disponibles", "disponibilites", "disponibilite", "disponible") ) return has(n, "mois prochain", "semaine prochaine", "prochain") || has(n, "qui") ? "who_available" : "who_available";
  if (has(n, "aide", "que sais tu faire", "que peux tu faire", "exemples")) return "help";
  return "help";
}

const refuse = (text: string, intent: IntentId): AiAnswer => ({ kind: "refusal", intent, text, figures: [], source: "Contrôle d’accès : l’assistant lit uniquement les données que vous pouvez consulter.", links: [] });
const NO_SCOPE = "Votre profil ne permet pas d’interroger les données des autres collaborateurs. Je peux en revanche vous aider sur votre propre semaine, vos affectations.";

export function answer(s: AppState, input: string): AiAnswer {
  const n = normalize(input);
  const u = sessionUser(s);
  if (!u) return refuse("Session expirée : reconnectez-vous.", "help");
  if (!canDo(s, "ai.use")) return refuse("Votre profil n’a pas accès à l’assistant.", "help");
  if (!n) return unknown();
  const intent = detectIntent(n);
  const emps = scopedEmployees(s);
  const broad = emps.length > 1; // a Collaborateur only sees themselves
  const period = { from: s.now, to: addDays(s.now, 27) };
  const src = (extra: string) => `Basé sur ${emps.length} collaborateur${emps.length > 1 ? "s" : ""} de votre périmètre — ${extra}`;

  switch (intent) {
    case "cv":
      return { kind: "answer", intent, title: "Analyse de CV", text: "Je peux analyser un CV (PDF ou DOCX) : l’extraction est simulée dans cette démonstration et vous validerez chaque élément avant qu’il ne soit enregistré au profil.", figures: [], source: "Aucune donnée n’est enregistrée sans votre validation.", links: [], action: "cv" };
    case "assign_refuse":
      return { kind: "refusal", intent, title: "Je n’affecte jamais seul", text: "Je propose, vous décidez : une affectation est toujours créée par un utilisateur habilité depuis le moteur de staffing (avec contrôle des conflits). Je peux préparer le classement des candidats.", figures: [], source: "Règle produit : l’assistant ne prend aucune décision d’affectation ni décision RH.", links: [{ label: "Ouvrir les missions", href: "/app/missions" }], suggestions: ["Trouve les meilleurs seniors pour une mission d’audit dans le secteur bancaire"] };
    case "cost":
      if (!canDo(s, "employee.salary.read") && !canDo(s, "analytics.cost")) return refuse("Les coûts, tarifs et marges ne sont pas accessibles avec votre profil : je ne peux pas répondre à cette question.", intent);
      return costAnswer(s, emps);
    default:
  }
  if (!broad && ["staffing", "availability_grade", "who_available", "overloaded_dept", "skills_gap", "risks"].includes(intent)) return refuse(NO_SCOPE, intent);

  if (intent === "staffing") {
    const gradeId = GRADE_WORDS.find(([w]) => hasPhrase(n, w) || hasPhrase(n, w + "s"))?.[1] ?? "g-2";
    const sector = SECTOR_WORDS.find(([ws]) => ws.some((w) => hasPhrase(n, w)))?.[1];
    const skillIds = SKILL_WORDS.filter(([ws]) => ws.some((w) => hasPhrase(n, w))).map(([, id]) => id).slice(0, 2);
    const start = addDays(s.now, 14), end = addDays(start, 89);
    const req = { gradeMin: gradeId, mandatorySkillIds: skillIds, desiredSkillIds: [], minExperienceYears: 0, startDate: start, endDate: end, allocationPct: 100, sector };
    const pool = candidatePool(s, { gradeMin: gradeId }).filter((id) => emps.some((e) => e.id === id));
    const ranked = rankCandidates(s, req, { employeeIds: pool }).slice(0, 5);
    const gradeName = s.grades.find((g) => g.id === gradeId)?.name;
    return {
      kind: "answer", intent, title: "Meilleurs candidats", text: `Voici le classement du moteur de staffing pour un besoin « ${gradeName} »${sector ? ` dans le secteur ${sector.toLowerCase()}` : ""}. Je ne fais que proposer : l’affectation se décide dans le moteur.`,
      figures: [{ label: "Candidats analysés", value: String(pool.length) }, { label: "Compatibles", value: String(ranked.filter((r) => r.compatible).length) + " / " + ranked.length }],
      table: { caption: "Top 5 du matching", columns: [{ key: "n", label: "Candidat" }, { key: "s", label: "Score", align: "end" }, { key: "a", label: "Disponibilité", align: "end" }, { key: "x", label: "Point d’attention" }], rows: ranked.map((r) => { const e = s.employees.find((x) => x.id === r.employeeId)!; return { cells: { n: `${e.firstName} ${e.lastName}`, s: String(r.score), a: fmtPct(r.availability.ratio * 100), x: r.compatible ? (r.warnings[0] ?? r.conflicts[0]?.message ?? "—") : `Non compatible : ${r.blocking.map((b) => b.label).join(", ")}` }, href: `/app/collaborateurs/${e.id}`, tone: r.compatible ? "ok" : "conflict" }; }) },
      assumptions: [`Grade minimum : ${gradeName}`, `Période supposée : du ${start} au ${end}, 100 %`, skillIds.length ? `Compétences obligatoires : ${skillIds.map((id) => s.skills.find((k) => k.id === id)?.name).join(", ")}` : "Aucune compétence obligatoire détectée", sector ? `Secteur : ${sector}` : "Secteur non précisé"],
      source: src(`score pondéré (${Object.values(s.settings.scoringWeights).join("/")}) sur compétences, disponibilité, secteur, grade, certifications, historique ; aucune compétence n’est inventée.`), links: [{ label: "Ouvrir les missions", href: "/app/missions" }, { label: "Voir le planning", href: "/app/planning" }],
    };
  }

  if (intent === "availability_grade") {
    const gradeId = GRADE_WORDS.find(([w]) => hasPhrase(n, w) || hasPhrase(n, w + "s"))?.[1] ?? "g-3";
    const gradeName = s.grades.find((g) => g.id === gradeId)!.name;
    const mi = MONTHS.findIndex((m) => hasPhrase(n, m));
    let month = monthStart(s.now);
    if (mi >= 0) { for (let i = 0; i < 12; i++) { const c = addMonths(monthStart(s.now), i); if (Number(c.slice(5, 7)) - 1 === mi) { month = c; break; } } }
    else if (has(n, "mois prochain")) month = addMonths(monthStart(s.now), 1);
    const from = month < s.now ? s.now : month, to = monthEnd(month);
    const free = availableCountByGrade(s, gradeId, from, to, 50);
    const series = monthlySeries(s, { from: s.now, horizonMonths: 12 }, gradeId).find((m) => m.key === month.slice(0, 7));
    const f = forecastByGrade(s, { from: s.now, horizonMonths: 12 }).find((g) => g.gradeId === gradeId)!;
    return {
      kind: "answer", intent, title: `${gradeName}s disponibles en ${fmtMonth(month)}`, text: `${free} ${gradeName}${free > 1 ? "s" : ""} auront au moins 50 % de capacité libre en ${fmtMonth(month)}.${series && series.balanceFte < -0.1 ? ` Attention : les besoins pondérés dépassent la capacité de ${fmtDec(-series.balanceFte)} ETP ce mois-là (${deficitLabel(gradeName, Math.ceil(-series.balanceFte - 1e-9))}).` : ""}`,
      figures: [{ label: "Personnes ≥ 50 % libres", value: String(free), raw: free }, { label: "Capacité (ETP)", value: series ? fmtDec(series.supplyFte) : "—" }, { label: "Besoins pondérés (ETP)", value: series ? fmtDec(series.demandFte) : "—" }, { label: "Solde (ETP)", value: series ? fmtDec(series.balanceFte) : "—" }],
      source: src(`période ${from} → ${to}, capacité après absences et affectations confirmées, besoins pondérés par la certitude des missions (${s.settings.forecastWeights.CONFIRMEE}/${s.settings.forecastWeights.PROBABLE}/${s.settings.forecastWeights.OPPORTUNITE} %) ; horizon 12 mois : ${f.deficitPersons ? deficitLabel(f.gradeName, f.deficitPersons) : "pas de déficit"}.`),
      links: [{ label: "Voir la capacité", href: `/app/capacite?horizon=12` }],
    };
  }

  if (intent === "who_available") {
    const from = addMonths(monthStart(s.now), has(n, "mois prochain") ? 1 : 0);
    const win = has(n, "mois prochain") ? { from, to: monthEnd(from) } : period;
    const rows = emps.map((e) => ({ e, a: availabilityOf(s, e.id, win.from, win.to) })).filter((x) => x.a.status === "LIBRE" || x.a.status === "PARTIELLE").sort((a, b) => a.a.avgPct - b.a.avgPct).slice(0, 10);
    return { kind: "answer", intent, title: "Collaborateurs disponibles", text: `${rows.length} collaborateur(s) libres ou partiellement chargés du ${win.from} au ${win.to}.`, figures: [{ label: "Disponibles", value: String(rows.length) }], table: { caption: "Disponibilités", columns: [{ key: "n", label: "Collaborateur" }, { key: "g", label: "Grade" }, { key: "c", label: "Charge moyenne", align: "end" }], rows: rows.map((x) => ({ cells: { n: `${x.e.firstName} ${x.e.lastName}`, g: s.grades.find((g) => g.id === x.e.gradeId)?.name ?? "", c: fmtPct(x.a.avgPct) }, href: `/app/collaborateurs/${x.e.id}` })) }, source: src(`charge planifiée moyenne sur ${win.from} → ${win.to}, absences déduites.`), links: [{ label: "Voir le planning", href: "/app/planning?mode=chaleur" }] };
  }

  if (intent === "overloaded_dept") {
    const rows = s.departments.map((d) => { const m = emps.filter((e) => e.departmentId === d.id); return { d, util: utilizationOfGroup(s, m, period.from, period.to).planned, over: m.filter((e) => statusOf(s, e, utilizationOf(s, e, period.from, period.to).planned) === "OVER").length, n: m.length }; }).filter((r) => r.n).sort((a, b) => b.util - a.util);
    const top = rows[0];
    return { kind: "answer", intent, title: "Département le plus chargé", text: `${top.d.name} est le département le plus chargé : ${fmtPct(top.util)} d’utilisation planifiée sur les 4 prochaines semaines${top.over ? `, dont ${top.over} collaborateur(s) en surcharge` : ""}.`, figures: rows.map((r) => ({ label: r.d.name, value: fmtPct(r.util), raw: r.util })), source: src(`utilisation planifiée (affectations confirmées ÷ capacité théorique), ${period.from} → ${period.to}.`), links: [{ label: "Planning par département", href: "/app/planning?lens=departements" }] };
  }

  if (intent === "unstaffed") {
    const list = unstaffedMissions(s);
    return { kind: "answer", intent, title: "Missions sans équipe complète", text: list.length ? `${list.length} mission(s) ont des postes à pourvoir.` : "Toutes les missions de votre périmètre sont staffées.", figures: [{ label: "Missions concernées", value: String(list.length) }, { label: "Postes à pourvoir", value: String(list.reduce((a, x) => a + x.cov.missing, 0)) }], table: list.length ? { caption: "Missions à staffer", columns: [{ key: "m", label: "Mission" }, { key: "p", label: "Postes manquants", align: "end" }, { key: "d", label: "Démarrage" }], rows: list.slice(0, 8).map((x) => ({ cells: { m: x.project.name, p: String(x.cov.missing), d: x.project.startDate }, href: `/app/missions/${x.project.id}?tab=besoins`, tone: x.project.status === "EN_ATTENTE_STAFFING" ? "alert" : undefined })) } : undefined, source: `Basé sur ${s.projects.length} missions — taux de staffing = postes confirmés ÷ postes demandés.`, links: [{ label: "Ouvrir les missions en attente", href: "/app/missions?vue=attente" }] };
  }

  if (intent === "skills_gap") {
    const list = forecastBySkill(s, { from: s.now, horizonMonths: 6 }).filter((k) => k.deficitPersons > 0).slice(0, 6);
    return { kind: "answer", intent, title: "Compétences insuffisantes à 6 mois", text: list.length ? `${list.length} compétence(s) sont en déficit sur 6 mois.` : "Aucune compétence n’est en déficit sur 6 mois.", figures: list.map((k) => ({ label: k.skillName, value: `−${k.deficitPersons} pers.`, hint: `${k.holders} titulaires` })), source: src("besoins pondérés par compétence obligatoire vs capacité des titulaires (niveau ≥ 2) ; non additif entre compétences."), links: [{ label: "Capacité par compétence", href: "/app/capacite?vue=competence&horizon=6" }] };
  }

  if (intent === "utilization") {
    const to = lastClosedWeekEnd(s), from = addDays(to, -27);
    const g = utilizationOfGroup(s, emps, from, to);
    return { kind: "answer", intent, title: "Taux d’utilisation", text: `Sur les 4 dernières semaines, l’utilisation planifiée est de ${fmtPct(g.planned)} : heures affectées confirmées ÷ capacité théorique.`, figures: [{ label: "Planifiée", value: fmtPct(g.planned), raw: g.planned }, { label: "Heures affectées", value: fmtHours(g.assigned) }, { label: "Capacité théorique", value: fmtHours(g.theoretical) }], source: src(`${from} → ${to}, heures affectées confirmées ÷ capacité théorique (${fmtHours(g.theoretical)}).`), links: [{ label: "Tableau de bord", href: "/app/accueil" }] };
  }

  if (intent === "presence") {
    if (!canDo(s, "workmode.view")) return refuse("Votre profil n’a pas accès à la présence des collaborateurs.", intent);
    const p = presenceSummary(s, emps);
    const names = (mode: "ONSITE" | "REMOTE") => emps.filter((e) => presenceOn(s, e, s.now) === mode).map((e) => `${e.firstName} ${e.lastName}`);
    const remote = names("REMOTE");
    return { kind: "answer", intent, title: "Présence aujourd’hui", text: `Aujourd’hui, ${p.onsite} collaborateur(s) sont en présentiel et ${p.remote} à distance${p.absent ? `, ${p.absent} absent(s)` : ""}.`, figures: [{ label: "Présentiel", value: String(p.onsite), raw: p.onsite }, { label: "À distance", value: String(p.remote), raw: p.remote }, { label: "Absents", value: String(p.absent), raw: p.absent }], table: remote.length ? { caption: "À distance aujourd’hui", columns: [{ key: "n", label: "Collaborateur" }], rows: remote.slice(0, 8).map((n) => ({ cells: { n } })) } : undefined, source: src("habitudes hebdomadaires et exceptions déclarées, absences approuvées déduites."), links: [{ label: "Voir le planning", href: "/app/planning" }, { label: "Collaborateurs", href: "/app/collaborateurs?presence=REMOTE" }] };
  }

  if (intent === "risks") {
    const fc = forecastByGrade(s, { from: s.now, horizonMonths: 3 });
    const over = emps.filter((e) => statusOf(s, e, utilizationOf(s, e, period.from, period.to).planned) === "OVER");
    const certs = s.employeeCertifications.filter((c) => c.expiresAt >= s.now && c.expiresAt <= addDays(s.now, 30) && emps.some((e) => e.id === c.employeeId));
    const chips = fc.filter((g) => g.deficitPersons > 0).map((g) => deficitLabel(g.gradeName, g.deficitPersons));
    return { kind: "answer", intent, title: "Risques à venir", text: [chips.length ? `Déficits à 3 mois : ${chips.join(", ")}.` : "Pas de déficit de capacité à 3 mois.", over.length ? `${over.length} collaborateur(s) en surcharge sur 4 semaines.` : "Aucune surcharge.", certs.length ? `${certs.length} certification(s) expirent sous 30 jours.` : ""].filter(Boolean).join(" "), figures: [{ label: "Déficits (grades)", value: String(chips.length) }, { label: "Surcharges", value: String(over.length) }, { label: "Certifications < 30 j", value: String(certs.length) }], source: src("capacité vs besoins pondérés à 3 mois, charge planifiée 4 semaines, certifications du référentiel."), links: [{ label: "Planification de capacité", href: "/app/capacite" }] };
  }
  return unknown();
}

function costAnswer(s: AppState, emps: Employee[]): AiAnswer {
  const rows = s.grades.map((g) => { const m = emps.filter((e) => e.gradeId === g.id); return { g, avg: m.length ? m.reduce((a, e) => a + e.dailyCost, 0) / m.length : 0, n: m.length }; }).filter((r) => r.n);
  return { kind: "answer", intent: "cost", title: "Coût journalier moyen par grade", text: "Coût interne moyen par jour, par grade.", figures: rows.map((r) => ({ label: r.g.name, value: `${new Intl.NumberFormat("fr-FR").format(Math.round(r.avg))} DZD`, hint: `${r.n} pers.` })), source: `Basé sur ${emps.length} collaborateurs — données de coût visibles avec vos droits.`, links: [{ label: "Analytics et rapports", href: "/app/analytics" }] };
}
function unknown(): AiAnswer {
  return { kind: "unknown", intent: "help", title: "Je ne sais pas répondre à cela", text: "Je réponds uniquement à partir des données de la plateforme. Je ne devine pas : voici ce que je sais faire.", figures: [], source: "Aucune donnée interrogée.", links: [], suggestions: SUGGESTIONS };
}
export { fmtDec };
