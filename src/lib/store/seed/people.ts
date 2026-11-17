/* 40 fictional collaborateurs. Names are invented; matricule/e-mail domain are demo placeholders. */
import type { Contract, Employee, EmployeeCertification, EmployeeSkill, SkillLevel, User } from "../types";

const SEC: Record<string, string> = { B: "Banque & assurance", I: "Industrie", E: "Énergie", P: "Secteur public", T: "Télécoms", D: "Distribution", A: "Agroalimentaire", M: "Immobilier" };
const JOB = ["", "Auditeur junior", "Consultant", "Auditeur senior", "Manager", "Associé (Partner)"];
const DEPT_JOB: Record<string, string[]> = {
  "d-aud": ["", "Auditeur junior", "Auditeur", "Auditeur senior", "Manager audit", "Associé audit"],
  "d-ec": ["", "Assistant comptable", "Collaborateur comptable", "Chef de mission comptable", "Manager expertise comptable", "Associé expertise comptable"],
  "d-cjf": ["", "Juriste junior", "Juriste-fiscaliste", "Juriste-fiscaliste senior", "Manager juridique & fiscal", "Associé juridique & fiscal"],
  "d-sc": ["", "Analyste", "Consultant", "Consultant senior", "Manager stratégie", "Associé stratégie"],
  "d-trx": ["", "Analyste transactions", "Consultant transactions", "Consultant senior transactions", "Manager transactions", "Associé transactions"],
};
void JOB;
const COST = [0, 12000, 20000, 32000, 52000, 90000];

/* id, first, last, dept, grade, office, manager, years, hours, sectors, skills "code:lvl,…", contract?, [weekdays] */
type Row = [string, string, string, string, number, "A" | "O", string | null, number, number, string, string, Contract?, number[]?];
const ROWS: Row[] = [
  // ---- Audit
  ["e01", "Samira", "Boudiaf", "d-aud", 5, "A", null, 22, 40, "BA", "audit-fin:4,ifrs:4,risk:3,banq:3,conf:3,pub:3"],
  ["e02", "Thomas", "Dubois", "d-aud", 4, "A", "e01", 13, 40, "BP", "audit-fin:4,ifrs:3,audit-int:3,ctrl-int:3,banq:3,pm:3"],
  ["e03", "Nabil", "Ferhat", "d-aud", 4, "A", "e01", 12, 40, "BIE", "audit-fin:4,audit-int:4,risk:3,ctrl-int:3,si:3,data:2"],
  ["e04", "Claire", "Moreau", "d-aud", 3, "A", "e02", 7, 40, "BA", "audit-fin:4,ifrs:3,banq:3,ctrl-int:3,fin-an:3,data:2"],
  ["e05", "Rania", "Mekki", "d-aud", 3, "A", "e02", 8, 40, "BI", "audit-fin:4,ifrs:3,banq:2,ctrl-int:3,conso:3"],
  ["e06", "Hakim", "Ouali", "d-aud", 3, "A", "e03", 6, 40, "IE", "audit-fin:3,audit-int:3,ifrs:2,ctrl-int:3,si:2,erp:2"],
  ["e07", "Lilia", "Bensaid", "d-aud", 3, "O", "e03", 6, 40, "PB", "audit-fin:3,audit-int:4,ctrl-int:4,si:3,risk:3,data:3"],
  ["e08", "Yanis", "Khelifi", "d-aud", 2, "A", "e02", 3, 40, "B", "audit-fin:2,ifrs:2,ctrl-int:2,compta:3,fin-an:2"],
  ["e09", "Imane", "Zerrouki", "d-aud", 2, "A", "e03", 3, 40, "IE", "audit-fin:2,audit-int:2,ctrl-int:2,data:2,bi:2"],
  ["e10", "Walid", "Hadjadj", "d-aud", 2, "O", "e03", 2, 40, "P", "audit-fin:2,pub:2,compta:2,ctrl-int:2"],
  ["e11", "Lucas", "Bernard", "d-aud", 1, "A", "e02", 1, 40, "B", "audit-fin:1,compta:2,ifrs:1,data:2,bi:2"],
  ["e12", "Meriem", "Tazi", "d-aud", 1, "A", "e02", 1, 40, "BI", "audit-fin:1,compta:2,ctrl-int:1", "CDD"],
  ["e13", "Anis", "Benali", "d-aud", 1, "O", "e03", 0, 40, "I", "compta:1,audit-fin:1,bi:1"],
  // ---- Expertise comptable
  ["e14", "Farid", "Mansouri", "d-ec", 5, "A", null, 20, 40, "ID", "compta:4,ifrs:4,conso:4,fisc-ent:3,treso:3"],
  ["e15", "Leïla", "Aouad", "d-ec", 4, "A", "e14", 12, 40, "IDA", "compta:4,ifrs:3,conso:3,fisc-ent:3,erp:3,social:2"],
  ["e16", "Sofiane", "Djebbar", "d-ec", 3, "A", "e15", 8, 40, "BI", "compta:4,ifrs:4,conso:3,audit-fin:3,banq:3,fin-an:3"],
  ["e17", "Amel", "Rahmani", "d-ec", 3, "A", "e15", 7, 32, "IDA", "compta:4,ifrs:3,conso:3,tva:3,social:3", "CDI", [0, 1, 2, 3]],
  ["e18", "Djamel", "Kaci", "d-ec", 2, "A", "e16", 3, 40, "I", "compta:3,tva:2,erp:2,fin-an:2"],
  ["e19", "Sarah", "Bouzid", "d-ec", 2, "O", "e16", 3, 40, "DA", "compta:3,ifrs:2,conso:2,tva:2"],
  ["e20", "Ilyes", "Merabet", "d-ec", 1, "A", "e17", 1, 40, "I", "compta:2,tva:1,erp:1"],
  ["e21", "Nesrine", "Slimani", "d-ec", 1, "O", "e17", 0, 40, "D", "compta:1,tva:1,social:1"],
  // ---- Conseil juridique & fiscal
  ["e22", "Hocine", "Larbi", "d-cjf", 5, "A", null, 19, 40, "EIB", "fisc-ent:4,fisc-int:4,soc:4,com:3,conf:3"],
  ["e23", "Dalila", "Hamdane", "d-cjf", 4, "A", "e22", 11, 40, "ED", "fisc-ent:4,tva:3,soc:3,com:4,conf:3"],
  ["e24", "Riad", "Saadi", "d-cjf", 3, "A", "e23", 7, 40, "EI", "fisc-ent:3,fisc-int:3,tva:3,com:2,ce:0"],
  ["e25", "Soraya", "Belhadj", "d-cjf", 3, "O", "e23", 6, 40, "DB", "soc:3,com:4,conf:3,fisc-ent:2"],
  ["e26", "Mounir", "Gharbi", "d-cjf", 2, "O", "e24", 3, 40, "I", "fisc-ent:2,tva:2,com:2"],
  ["e27", "Kenza", "Brahimi", "d-cjf", 2, "A", "e25", 2, 24, "D", "soc:2,com:3,conf:2", "CDI", [0, 1, 2]],
  ["e28", "Adel", "Touati", "d-cjf", 1, "A", "e24", 1, 40, "E", "fisc-ent:1,com:1,tva:1"],
  // ---- Stratégie & conseil
  ["e29", "Yacine", "Belkacem", "d-sc", 5, "A", null, 24, 40, "TBP", "strat:4,orga:4,pm:3,etude:3,bp:3"],
  ["e30", "Wafa", "Chikh", "d-sc", 4, "A", "e29", 12, 40, "TD", "strat:4,etude:4,bp:3,pm:4,orga:3,bi:2"],
  ["e31", "Bilal", "Messaoudi", "d-sc", 3, "A", "e30", 7, 40, "TA", "strat:3,etude:3,bp:4,fin-mod:3,bi:3,data:3"],
  ["e32", "Nawel", "Hammoudi", "d-sc", 3, "O", "e30", 6, 40, "DA", "strat:3,etude:4,orga:3,pm:3,bi:2"],
  ["e33", "Samy", "Lounis", "d-sc", 2, "A", "e31", 3, 40, "T", "etude:3,bp:2,bi:3,data:3,fin-mod:2", "CONSULTANT"],
  ["e34", "Hana", "Benyoucef", "d-sc", 1, "A", "e31", 1, 40, "D", "etude:2,bi:2,bp:1"],
  // ---- Transactions
  ["e35", "Mehdi", "Cheriet", "d-trx", 5, "A", null, 21, 40, "BMI", "dd:4,valo:4,fin-mod:4,conso:3,fisc-int:3"],
  ["e36", "Inès", "Boukhalfa", "d-trx", 4, "A", "e35", 11, 40, "MBE", "dd:4,valo:4,fin-mod:3,fin-an:4,conso:3"],
  ["e37", "Rachid", "Oukaci", "d-trx", 3, "A", "e36", 7, 40, "MI", "dd:3,valo:3,fin-mod:3,fin-an:3,ifrs:2"],
  ["e38", "Maya", "Taleb", "d-trx", 2, "O", "e37", 3, 40, "ME", "dd:2,fin-mod:2,fin-an:2,bi:2"],
  ["e39", "Zakaria", "Haddad", "d-trx", 1, "A", "e37", 1, 40, "M", "fin-an:1,dd:1,bi:1"],
  ["e40", "Ghania", "Rezig", "d-trx", 1, "O", "e36", 0, 40, "B", "fin-an:1,valo:1", "STAGE"],
];

const certHeld: [string, string, string][] = [
  // employee, certification, expiresAt
  ["e01", "ce-cac", "2028-06-30"], ["e02", "ce-cac", "2027-09-30"], ["e02", "ce-ifrs", "2027-05-31"], ["e03", "ce-ai", "2028-02-28"], ["e03", "ce-cac", "2027-12-31"],
  ["e04", "ce-ifrs", "2026-12-05"], // expires in 20 days from the demo clock → notification
  ["e05", "ce-ifrs", "2027-10-31"], ["e05", "ce-cac", "2028-03-31"], ["e06", "ce-ai", "2027-04-30"], ["e07", "ce-ai", "2028-09-30"], ["e07", "ce-data", "2027-08-31"],
  ["e14", "ce-ifrs", "2028-01-31"], ["e15", "ce-ifrs", "2027-03-31"], ["e16", "ce-ifrs", "2028-04-30"], ["e17", "ce-ifrs", "2027-02-28"],
  ["e22", "ce-fisc", "2035-01-01"], ["e23", "ce-fisc", "2034-01-01"], ["e24", "ce-fisc", "2033-01-01"], ["e30", "ce-pm", "2028-05-31"], ["e31", "ce-data", "2027-11-30"], ["e08", "ce-ifrs", "2026-12-12"],
  ["e36", "ce-risk", "2027-06-30"], ["e29", "ce-pm", "2027-12-31"], ["e09", "ce-data", "2028-02-29"],
];
/** Usual remote weekdays (0 = Sunday … 4 = Thursday): most people work one day a week from home, some two, some never. */
const REMOTE_PATTERNS: number[][] = [[0], [], [2], [1, 3], [0, 4], [4], [], [1]];
const sectorOf = (c: string) => [...c].map((x) => SEC[x]);

export function buildPeople(): { employees: Employee[]; employeeSkills: EmployeeSkill[]; employeeCertifications: EmployeeCertification[] } {
  const employees: Employee[] = [];
  const employeeSkills: EmployeeSkill[] = [];
  ROWS.forEach(([id, first, last, dept, grade, office, mgr, years, hours, sectors, skills, contract, weekdays], i) => {
    const start = new Date(Date.UTC(2026 - Math.max(years, 0), (i * 5) % 12, 1 + ((i * 7) % 27)));
    const startDate = years === 0 ? "2026-0" + (3 + (i % 5)) + "-01" : start.toISOString().slice(0, 10);
    const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
    employees.push({
      id,
      matricule: `SBS-${String(1000 + i * 7 + 13)}`,
      firstName: first,
      lastName: last,
      email: `${slug(first)}.${slug(last)}@sbs-demo.example`,
      phone: `+213 550 ${String(10 + i).padStart(2, "0")} ${String(20 + ((i * 3) % 70)).padStart(2, "0")} ${String(30 + ((i * 11) % 60)).padStart(2, "0")}`,
      jobTitle: DEPT_JOB[dept][grade],
      gradeId: `g-${grade}`,
      departmentId: dept,
      officeId: office === "A" ? "o-alg" : "o-ora",
      managerId: mgr,
      contract: contract ?? "CDI",
      weeklyHours: hours,
      workingWeekdays: weekdays,
      remoteWeekdays: REMOTE_PATTERNS[i % REMOTE_PATTERNS.length].filter((d) => !weekdays || weekdays.includes(d)),
      startDate,
      endDate: contract === "CDD" ? "2027-03-31" : contract === "STAGE" ? "2027-02-28" : contract === "CONSULTANT" ? "2027-06-30" : undefined,
      status: "ACTIF",
      bio: `${DEPT_JOB[dept][grade]} — ${years} an${years > 1 ? "s" : ""} d’expérience. Profil fictif de démonstration.`,
      yearsExperience: years,
      sectors: sectorOf(sectors),
      languages: grade >= 3 ? ["Français", "Arabe", "Anglais"] : ["Français", "Arabe"],
      diplomas: grade >= 4 ? ["Master en finance et comptabilité", "Diplôme d’expertise"] : ["Licence en sciences de gestion"],
      dailyCost: Math.round((COST[grade] * (0.94 + ((i * 13) % 12) / 100)) / 500) * 500,
      dailyRate: Math.round((COST[grade] * 2.3) / 1000) * 1000,
    });
    skills.split(",").forEach((t) => {
      const [code, lvl] = t.split(":");
      if (code === "ce" || Number(lvl) === 0) return;
      const level = Number(lvl) as SkillLevel;
      const validated = grade >= 3 || i % 3 !== 0;
      employeeSkills.push({
        employeeId: id,
        skillId: `sk-${code}`,
        level,
        selfLevel: Math.min(4, level + (i % 4 === 0 ? 1 : 0)) as SkillLevel,
        validatedById: validated && mgr ? mgr : undefined,
        validatedAt: validated && mgr ? "2026-09-" + String(10 + (i % 15)) : undefined,
        updatedAt: "2026-09-" + String(10 + (i % 15)),
        evidence: level >= 3 ? "Missions réalisées et revue du responsable" : undefined,
        experienceNote: level >= 3 ? `${Math.max(1, level - 1)} missions significatives` : undefined,
      });
    });
  });
  const employeeCertifications: EmployeeCertification[] = certHeld.map(([employeeId, certificationId, expiresAt]) => ({
    employeeId,
    certificationId,
    expiresAt,
    obtainedAt: `${Number(expiresAt.slice(0, 4)) - (certificationId === "ce-ai" ? 4 : 3)}${expiresAt.slice(4)}`,
  }));
  return { employees, employeeSkills, employeeCertifications };
}

/** Personas of the demo bar (spec 3.4). RM / RH / Super Admin are back-office roles without a billable employee record. */
export const users: User[] = [
  { id: "u-karim", firstName: "Karim", lastName: "Saci", email: "karim.saci@sbs-demo.example", role: "SUPER_ADMIN", employeeId: null, status: "ACTIF" },
  { id: "u-yacine", firstName: "Yacine", lastName: "Belkacem", email: "yacine.belkacem@sbs-demo.example", role: "DIRECTION", employeeId: "e29", status: "ACTIF" },
  { id: "u-samira", firstName: "Samira", lastName: "Boudiaf", email: "samira.boudiaf@sbs-demo.example", role: "PARTNER", employeeId: "e01", status: "ACTIF" },
  { id: "u-amine", firstName: "Amine", lastName: "Cherif", email: "amine.cherif@sbs-demo.example", role: "RESOURCE_MANAGER", employeeId: null, status: "ACTIF" },
  { id: "u-thomas", firstName: "Thomas", lastName: "Dubois", email: "thomas.dubois@sbs-demo.example", role: "MANAGER", employeeId: "e02", status: "ACTIF" },
  { id: "u-sophie", firstName: "Sophie", lastName: "Martin", email: "sophie.martin@sbs-demo.example", role: "RH", employeeId: null, status: "ACTIF" },
  { id: "u-claire", firstName: "Claire", lastName: "Moreau", email: "claire.moreau@sbs-demo.example", role: "COLLABORATEUR", employeeId: "e04", status: "ACTIF" },
  { id: "u-lucas", firstName: "Lucas", lastName: "Bernard", email: "lucas.bernard@sbs-demo.example", role: "COLLABORATEUR", employeeId: "e11", status: "ACTIF" },
  // Additional accounts (not on the demo bar)
  { id: "u-nabil", firstName: "Nabil", lastName: "Ferhat", email: "nabil.ferhat@sbs-demo.example", role: "MANAGER", employeeId: "e03", status: "ACTIF" },
  { id: "u-admin", firstName: "Lamia", lastName: "Hadj", email: "lamia.hadj@sbs-demo.example", role: "ADMIN", employeeId: null, status: "ACTIF" },
];
export const PERSONAS = [
  { id: "u-karim", label: "Super Admin", hint: "Technique — rôles, règles, audit" },
  { id: "u-yacine", label: "Direction générale", hint: "Indicateurs consolidés, capacité" },
  { id: "u-samira", label: "Partner · Audit", hint: "Périmètre Audit, approbations" },
  { id: "u-amine", label: "Resource Manager", hint: "Moteur de staffing, planning" },
  { id: "u-thomas", label: "Manager · Audit", hint: "Missions, équipe, demandes" },
  { id: "u-sophie", label: "Ressources humaines", hint: "Collaborateurs, présence, capacité" },
  { id: "u-claire", label: "Collaboratrice · Senior Audit", hint: "Planning, missions, mes affectations" },
  { id: "u-lucas", label: "Collaborateur · Junior", hint: "Planning, missions" },
] as const;
