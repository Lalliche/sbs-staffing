"use client";
import Link from "next/link";
import { useSession } from "@/lib/store/hooks";
import { CRITERION_LABEL } from "@/lib/engine/matching";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Card, CardHeader, PageHeader } from "@/components/ui/Surface";
import { useShell } from "@/components/app/ShellContext";
import { Button } from "@/components/ui/Button";

const GLOSSARY: [string, string][] = [
  ["Collaborateur", "Tout salarié de SBS."], ["Grade", "Junior · Consultant · Senior · Manager · Partner."], ["Mission", "Engagement pour un client, identifié par sa référence et son numéro OTP."], ["Besoin de staffing", "Un poste à pourvoir : grade, quantité, compétences, période, % d’allocation."],
  ["Soft booking", "Réservation provisoire (hachurée) : expire après un délai, non comptée dans la capacité confirmée."], ["Hard booking", "Affectation confirmée (pleine) : comptée dans la capacité et l’utilisation."], ["Capacité théorique", "Σ des jours ouvrés (hors week-ends, jours fériés) × heures journalières."], ["Utilisation planifiée", "Heures affectées confirmées ÷ capacité théorique."],
  ["Utilisation réelle", "Heures de timesheets VALIDÉS ÷ capacité théorique."], ["Facturabilité", "Heures facturables validées ÷ capacité théorique."], ["Certitude", "Confirmée · Probable · Opportunité : pondère les besoins futurs (100 / 60 / 25 % par défaut)."],
];
const SCRIPTS = [
  ["A", "Resource Manager", "Tableau de bord → mission en attente → « Trouver des candidats » → réserver 2, affecter 1 → glisser un bloc dans le planning → exception justifiée → journal d’audit.", "RESOURCE_MANAGER", "/app/accueil"],
  ["B", "Manager", "Créer une mission (1 Manager, 2 Seniors, 3 Juniors) → créer une demande de staffing → la voir dans la file du Resource Manager → approuver un congé.", "MANAGER", "/app/missions?nouveau=1"],
  ["C", "Collaborateur", "Ma semaine → remplir et soumettre une timesheet → postuler sur la marketplace → poser un congé.", "COLLABORATEUR", "/app/timesheets"],
  ["D", "Direction", "Tableau de bord exécutif avec filtres → capacité à 6 mois (déficit de 2 Seniors) → « et si » → poser la question à l’assistant → export PDF.", "DIRECTION", "/app/capacite?horizon=6"],
  ["E", "RH", "Importer des collaborateurs (ligne en erreur) → archiver un départ → visibilité des évaluations confidentielles.", "RH", "/app/collaborateurs"],
  ["F", "Super Admin", "Modifier les permissions d’un rôle en direct → changer les pondérations du score → le classement change.", "SUPER_ADMIN", "/app/admin/roles"],
] as const;

export function HelpPage() {
  const { s } = useSession();
  const shell = useShell();
  const w = s.settings.scoringWeights;
  return (
    <>
      <PageHeader title="Aide" description="Raccourcis, vocabulaire, calcul du score et scénarios de démonstration." actions={<Button onClick={shell.startTour}>Relancer la visite guidée</Button>} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader title="Calcul du score de matching" description="Lu dans les règles en vigueur" />
          <ul className="space-y-1.5 text-sm">{(Object.keys(w) as (keyof typeof w)[]).map((k) => <li key={k} className="flex justify-between"><span>{CRITERION_LABEL[k]}</span><span className="tabular-nums font-medium">{w[k]}</span></li>)}</ul>
          <p className="mt-3 text-sm text-text-secondary">Les critères bloquants — compétence obligatoire manquante, grade sous le minimum, indisponibilité — sont séparés du score : un candidat bloqué est signalé « Non compatible », jamais présenté comme parfait. Le moteur n’invente jamais une compétence ou une expérience.</p></Card>
        <Card><CardHeader title="Lire les statuts" /><div className="flex flex-wrap gap-2"><StatusPill tone="ok" label="Normal" /><StatusPill tone="alert" label="Attention" /><StatusPill tone="conflict" label="Conflit" /><StatusPill tone="info" label="Information" /><StatusPill tone="neutral" label="Brouillon" /></div>
          <p className="mt-3 text-sm text-text-secondary">La couleur n’est jamais seule : chaque statut a une forme (cercle, triangle, octogone) et un libellé. Dans le planning : bloc plein = confirmé ; hachuré en tirets = réservation ; cadre rouge avec octogone = conflit.</p><p className="mt-3 flex flex-wrap gap-2 text-xs"><Badge>⌘K — recherche</Badge><Badge>Ctrl Maj D — barre de démo</Badge><Badge>M / R — déplacer / redimensionner</Badge><Badge>Échap — fermer</Badge></p></Card>
        <Card className="xl:col-span-2"><CardHeader title="Scénarios de démonstration" description="Changez de profil avec la barre du haut, puis suivez le scénario" />
          <ul className="grid gap-3 md:grid-cols-2">{SCRIPTS.map(([k, t, d, , href]) => <li key={k} className="rounded-md border border-border p-3"><p className="text-sm font-semibold text-ink">Scénario {k} — {t}</p><p className="mt-1 text-xs text-text-secondary">{d}</p><Link href={href} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Commencer →</Link></li>)}</ul></Card>
        <Card className="xl:col-span-2"><CardHeader title="Vocabulaire" /><dl className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">{GLOSSARY.map(([t, d]) => <div key={t}><dt className="font-medium text-ink">{t}</dt><dd className="text-text-secondary">{d}</dd></div>)}</dl></Card>
      </div>
      <p className="mt-6 text-xs text-text-muted">Version de démonstration — données fictives. Aucune donnée réelle, aucun e-mail réel.</p>
    </>
  );
}
