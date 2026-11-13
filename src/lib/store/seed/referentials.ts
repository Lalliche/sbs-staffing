/* Referentials of the demo (fictional). Everything here is generic: no real client, person or certification body. */
import type { Certification, Client, Department, Grade, Holiday, Office, Skill, SkillCategory } from "../types";

export const SECTORS = ["Banque & assurance", "Industrie", "Énergie", "Secteur public", "Télécoms", "Distribution", "Agroalimentaire", "Immobilier"] as const;

export const departments: Department[] = [
  { id: "d-aud", name: "Audit", code: "AUD" },
  { id: "d-ec", name: "Expertise comptable", code: "EC" },
  { id: "d-cjf", name: "Conseil juridique & fiscal", code: "CJF" },
  { id: "d-sc", name: "Stratégie & conseil", code: "SC" },
  { id: "d-trx", name: "Transactions", code: "TRX" },
];
export const offices: Office[] = [
  { id: "o-alg", name: "Bureau d’Alger", city: "Alger", workingWeekdays: [0, 1, 2, 3, 4] },
  { id: "o-ora", name: "Bureau d’Oran", city: "Oran", workingWeekdays: [0, 1, 2, 3, 4] },
];
export const grades: Grade[] = [
  { id: "g-1", name: "Junior", rank: 1 },
  { id: "g-2", name: "Consultant", rank: 2 },
  { id: "g-3", name: "Senior", rank: 3 },
  { id: "g-4", name: "Manager", rank: 4 },
  { id: "g-5", name: "Partner", rank: 5 },
];
export const skillCategories: SkillCategory[] = [
  { id: "c-aud", name: "Audit" },
  { id: "c-fin", name: "Finance" },
  { id: "c-cpt", name: "Comptabilité" },
  { id: "c-fisc", name: "Fiscalité" },
  { id: "c-str", name: "Conseil en stratégie" },
  { id: "c-risk", name: "Risk Management" },
  { id: "c-trx", name: "Transaction Services" },
  { id: "c-rh", name: "RH" },
  { id: "c-tech", name: "Technologie" },
  { id: "c-data", name: "Data Analytics" },
  { id: "c-jur", name: "Juridique" },
];
export const certifications: Certification[] = [
  { id: "ce-ifrs", name: "Certificat IFRS — niveau avancé", issuer: "Organisme de certification (fictif)", validityMonths: 36 },
  { id: "ce-ai", name: "Certificat d’audit interne", issuer: "Institut professionnel (fictif)", validityMonths: 48 },
  { id: "ce-risk", name: "Certificat en gestion des risques", issuer: "Institut professionnel (fictif)", validityMonths: 36 },
  { id: "ce-data", name: "Certificat d’analyse de données", issuer: "Organisme de certification (fictif)", validityMonths: 36 },
  { id: "ce-pm", name: "Certificat en gestion de projet", issuer: "Organisme de certification (fictif)", validityMonths: 48 },
  { id: "ce-fisc", name: "Diplôme de fiscalité approfondie", issuer: "École supérieure (fictive)", validityMonths: 120 },
  { id: "ce-cac", name: "Habilitation d’audit légal", issuer: "Instance professionnelle (fictive)", validityMonths: 60 },
];

type SK = [id: string, name: string, cat: string, expected: 1 | 2 | 3 | 4, certs: string[], desc: string];
const SKILLS: SK[] = [
  ["sk-audit-fin", "Audit financier", "c-aud", 3, ["ce-cac"], "Planification, exécution et revue d’un audit légal des comptes."],
  ["sk-audit-int", "Audit interne", "c-aud", 3, ["ce-ai"], "Cartographie des processus, programmes de travail, restitution au comité d’audit."],
  ["sk-ctrl-int", "Contrôle interne", "c-aud", 2, [], "Évaluation et test des dispositifs de contrôle interne."],
  ["sk-pub", "Audit du secteur public", "c-aud", 3, [], "Spécificités de la comptabilité et du contrôle des établissements publics."],
  ["sk-fin-an", "Analyse financière", "c-fin", 2, [], "Lecture des états financiers, ratios, équilibres."],
  ["sk-fin-mod", "Modélisation financière", "c-fin", 3, [], "Modèles de prévision, scénarios, sensibilités."],
  ["sk-treso", "Gestion de trésorerie", "c-fin", 2, [], "Plans de trésorerie, financement court terme."],
  ["sk-compta", "Comptabilité générale", "c-cpt", 2, [], "Tenue, révision et clôture des comptes."],
  ["sk-ifrs", "Normes IFRS", "c-cpt", 3, ["ce-ifrs"], "Application des normes internationales d’information financière."],
  ["sk-conso", "Consolidation", "c-cpt", 3, [], "Périmètre, retraitements, éliminations, comptes consolidés."],
  ["sk-fisc-ent", "Fiscalité des entreprises", "c-fisc", 3, ["ce-fisc"], "Impôt sur les bénéfices, régimes fiscaux, contrôle fiscal."],
  ["sk-fisc-int", "Fiscalité internationale", "c-fisc", 3, [], "Conventions, prix de transfert, établissement stable."],
  ["sk-tva", "TVA et fiscalité indirecte", "c-fisc", 2, [], "Taxe sur la valeur ajoutée, droits et taxes."],
  ["sk-strat", "Stratégie d’entreprise", "c-str", 3, [], "Diagnostic stratégique, options, feuille de route."],
  ["sk-etude", "Étude de marché", "c-str", 2, [], "Sizing, benchmark concurrentiel, entretiens."],
  ["sk-bp", "Business plan", "c-str", 2, [], "Plans d’affaires et dossiers de financement."],
  ["sk-pm", "Gestion de projet", "c-str", 2, ["ce-pm"], "Planification, pilotage, reporting de projet."],
  ["sk-risk", "Gestion des risques", "c-risk", 3, ["ce-risk"], "Identification, évaluation et traitement des risques."],
  ["sk-conf", "Conformité réglementaire", "c-risk", 3, [], "Dispositifs de conformité, veille, plans d’action."],
  ["sk-banq", "Réglementation bancaire", "c-risk", 3, [], "Cadre prudentiel, reporting réglementaire des banques."],
  ["sk-dd", "Due diligence financière", "c-trx", 3, [], "Revue des comptes, qualité des résultats, dette nette."],
  ["sk-valo", "Évaluation d’entreprise", "c-trx", 3, [], "Méthodes DCF, multiples, rapport d’évaluation."],
  ["sk-orga", "Organisation et conduite du changement", "c-rh", 2, [], "Diagnostic organisationnel, accompagnement du changement."],
  ["sk-social", "Paie et droit social", "c-rh", 2, [], "Paie, charges sociales, obligations déclaratives."],
  ["sk-si", "Audit des systèmes d’information", "c-tech", 3, [], "Revue des contrôles généraux informatiques."],
  ["sk-erp", "ERP et finance", "c-tech", 2, [], "Paramétrage et revue des modules financiers d’un ERP."],
  ["sk-data", "Analyse de données", "c-data", 2, ["ce-data"], "Extraction, contrôle et analyse de volumes de données."],
  ["sk-bi", "Visualisation et BI", "c-data", 2, [], "Tableaux de bord et restitution visuelle."],
  ["sk-soc", "Droit des sociétés", "c-jur", 3, [], "Constitution, gouvernance, opérations sur le capital."],
  ["sk-com", "Droit commercial et contrats", "c-jur", 3, [], "Rédaction et revue de contrats commerciaux."],
];
export const skills: Skill[] = SKILLS.map(([id, name, categoryId, expectedLevel, certificationIds, description]) => ({ id, name, categoryId, description, expectedLevel, certificationIds, active: true }));

export const clients: Client[] = [
  { id: "cl-a", name: "Groupe bancaire A", sector: "Banque & assurance", city: "Alger" },
  { id: "cl-b", name: "Banque régionale B", sector: "Banque & assurance", city: "Oran" },
  { id: "cl-c", name: "Assureur C", sector: "Banque & assurance", city: "Alger" },
  { id: "cl-d", name: "Industriel D", sector: "Industrie", city: "Sétif" },
  { id: "cl-e", name: "Groupe énergétique E", sector: "Énergie", city: "Hassi Messaoud" },
  { id: "cl-f", name: "Opérateur télécoms F", sector: "Télécoms", city: "Alger" },
  { id: "cl-g", name: "Distributeur G", sector: "Distribution", city: "Alger" },
  { id: "cl-h", name: "Établissement public H", sector: "Secteur public", city: "Alger" },
  { id: "cl-i", name: "Groupe agroalimentaire I", sector: "Agroalimentaire", city: "Béjaïa" },
  { id: "cl-j", name: "Promoteur immobilier J", sector: "Immobilier", city: "Oran" },
];

/** Indicative public-holiday dates (fictional calendar for the demo — to be replaced by SBS's own). */
export const holidays: Holiday[] = [
  ["2026-11-01", "Anniversaire du 1er novembre (indicatif)"],
  ["2027-01-01", "Jour de l’an"],
  ["2027-01-12", "Yennayer (indicatif)"],
  ["2027-03-09", "Aïd el-Fitr — 1er jour (indicatif)"],
  ["2027-03-10", "Aïd el-Fitr — 2e jour (indicatif)"],
  ["2027-05-01", "Fête du travail"],
  ["2027-05-16", "Aïd el-Adha — 1er jour (indicatif)"],
  ["2027-05-17", "Aïd el-Adha — 2e jour (indicatif)"],
  ["2027-06-06", "Nouvel an hégirien (indicatif)"],
  ["2027-07-05", "Fête de l’indépendance"],
].map(([date, name], i) => ({ id: `h-${i + 1}`, date, name, officeId: null }));
