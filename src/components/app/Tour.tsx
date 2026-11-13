"use client";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { dur, ease, spring } from "@/lib/motion-tokens";
import type { Role } from "@/lib/store/types";
import { Button } from "@/components/ui/Button";

interface Step {
  target: string;
  title: string;
  body: string;
}
const COMMON: Step[] = [
  { target: "persona", title: "Changer de profil", body: "Passez d’un profil à l’autre en un clic : navigation, boutons et données changent immédiatement selon les droits." },
  { target: "search", title: "Recherche globale", body: "⌘K ouvre la palette : personnes, missions, demandes, compétences, pages et actions rapides." },
  { target: "bell", title: "Notifications", body: "Chaque notification mène à l’objet exact : demande, conflit, congé, timesheet." },
];
const STAFFING: Step[] = [
  { target: "nav-accueil", title: "Votre poste de pilotage", body: "File des demandes, conflits de planning et missions sans équipe, calculés en direct." },
  { target: "nav-missions", title: "Missions et besoins", body: "Ouvrez une mission en attente de staffing puis « Trouver des candidats » : scores détaillés, critères bloquants, comparaison." },
  { target: "nav-planning", title: "Planning", body: "Glissez ou redimensionnez un bloc : le moteur valide et propose une exception justifiée si besoin." },
  { target: "nav-demandes", title: "Demandes de staffing", body: "La file des managers : analyse, proposition, validation, satisfaction automatique." },
  { target: "nav-capacite", title: "Capacité", body: "Besoins pondérés par la certitude contre capacité disponible, avec les déficits par grade." },
  { target: "assistant", title: "SBS Staffing Intelligence", body: "Posez une question : chaque chiffre vient d’une requête sur les données et cite sa source." },
];
const STEPS: Record<Role, Step[]> = {
  SUPER_ADMIN: [
    { target: "nav-admin", title: "Administration", body: "Rôles et permissions éditables en direct, règles de staffing, référentiels, journal d’audit." },
    { target: "nav-accueil", title: "Vue d’ensemble", body: "Indicateurs de la plateforme et journal des dernières actions sensibles." },
    ...COMMON,
    { target: "scenario", title: "Scénarios", body: "Rechargez un jeu de données : démarrage, activité normale, pic de charge, fin d’année." },
  ],
  ADMIN: [{ target: "nav-admin", title: "Administration", body: "Utilisateurs, référentiels, règles de staffing et journal d’audit." }, { target: "nav-accueil", title: "Tableau de bord", body: "Indicateurs consolidés de la plateforme." }, ...COMMON],
  DIRECTION: [
    { target: "nav-accueil", title: "Tableau de bord exécutif", body: "Utilisation planifiée et réelle séparées, facturabilité, missions à staffer, demandes urgentes — filtrables." },
    { target: "nav-capacite", title: "Capacité sur 6 mois", body: "Le déficit par grade et par compétence, et le scénario « et si » : ajoutez une mission probable et voyez l’impact." },
    { target: "nav-analytics", title: "Analytics et rapports", body: "Rapports filtrables, exportables en CSV/Excel et en PDF imprimable." },
    { target: "assistant", title: "Poser une question", body: "« Combien de Seniors seront disponibles en janvier ? » — réponse issue des données, avec sa source." },
    ...COMMON,
  ],
  PARTNER: [
    { target: "nav-accueil", title: "Votre périmètre", body: "Missions et équipes de votre département." },
    { target: "nav-demandes", title: "Approbations", body: "Propositions de staffing en attente de votre validation." },
    { target: "nav-capacite", title: "Capacité", body: "Déficits à venir pour votre département." },
    ...COMMON,
  ],
  RESOURCE_MANAGER: STAFFING.concat(COMMON.slice(0, 2)),
  MANAGER: [
    { target: "nav-accueil", title: "Votre équipe", body: "Charge de l’équipe, timesheets à valider, congés à approuver." },
    { target: "nav-missions", title: "Vos missions", body: "Créez une mission avec ses besoins (1 Manager, 2 Seniors, 3 Juniors) puis une demande de staffing." },
    { target: "nav-demandes", title: "Demandes de staffing", body: "Suivez l’avancement de vos demandes dans la file du Resource Manager." },
    { target: "nav-timesheets", title: "Validation des timesheets", body: "Valider, rejeter ou demander une correction, avec les anomalies détectées." },
    { target: "nav-conges", title: "Congés", body: "Approuver une demande recalcule immédiatement les disponibilités." },
    ...COMMON,
  ],
  RH: [
    { target: "nav-collab", title: "Collaborateurs", body: "Fiches, import guidé avec contrôle des erreurs, archivage sans suppression." },
    { target: "nav-conges", title: "Congés et absences", body: "Calendrier global, demandes à approuver, jours fériés." },
    { target: "nav-accueil", title: "Tableau de bord RH", body: "Certifications bientôt expirées, congés en attente, archives." },
    ...COMMON,
  ],
  COLLABORATEUR: [
    { target: "nav-accueil", title: "Ma semaine", body: "Mes affectations, mon statut de timesheet et mes demandes de congé." },
    { target: "nav-timesheets", title: "Mes timesheets", body: "Saisissez vos heures par mission, enregistrez en brouillon puis soumettez." },
    { target: "nav-marketplace", title: "Marketplace", body: "Opportunités ouvertes : postulez. Une candidature ne crée jamais d’affectation." },
    { target: "nav-conges", title: "Mes congés", body: "Posez une demande ; votre manager est notifié." },
    ...COMMON,
  ],
};

export function Tour({ role, open, onClose }: { role: Role; open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const steps = useMemo(() => STEPS[role], [role]);
  const step = steps[i];

  useEffect(() => {
    if (!open || !step) return;
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el && el.offsetParent !== null) {
        el.scrollIntoView({ block: "nearest" });
        setRect(el.getBoundingClientRect());
      } else setRect(null);
    };
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [open, step]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => Math.min(steps.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [open, onClose, steps.length]);

  if (typeof document === "undefined") return null;
  const pad = 6;
  const pos = rect
    ? { top: Math.max(12, Math.min(window.innerHeight - 230, rect.bottom + 14)), left: Math.min(window.innerWidth - 350, Math.max(12, rect.left)) }
    : { top: window.innerHeight / 2 - 90, left: window.innerWidth / 2 - 160 };
  return createPortal(
    <AnimatePresence>
      {open && step && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: dur.base }} className="fixed inset-0 z-[110]" role="dialog" aria-label="Visite guidée">
          <div className="absolute inset-0" onClick={onClose} />
          {rect && <motion.div layout transition={spring.ui} className="pointer-events-none fixed rounded-lg ring-2 ring-focus" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgb(15 20 36 / 0.55)" }} />}
          {!rect && <div className="pointer-events-none absolute inset-0 bg-ink/55" />}
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: dur.slow, ease: ease.out }} className="fixed w-[min(21em,92vw)] rounded-xl bg-bg p-5 shadow-xl" style={pos}>
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-primary">Étape {i + 1} / {steps.length}</p>
            <h3 className="mt-1.5 text-md font-semibold text-ink">{step.title}</h3>
            <p className="mt-1 text-base text-text-secondary text-pretty">{step.body}</p>
            <div className="mt-4 flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={onClose}>Passer</Button>
              <span className="flex gap-2">
                {i > 0 && <Button variant="secondary" size="sm" onClick={() => setI(i - 1)}>Précédent</Button>}
                <Button size="sm" onClick={() => (i === steps.length - 1 ? onClose() : setI(i + 1))}>{i === steps.length - 1 ? "Terminer" : "Suivant"}</Button>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
