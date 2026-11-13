"use client";
import { Keyboard } from "lucide-react";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { useSession } from "@/lib/store/hooks";
import { ROLE_LABEL } from "@/lib/engine/permissions";
import { fmtDate } from "@/lib/engine/format";
import { PERMISSIONS } from "@/lib/engine/permissions";

const SHORTCUTS: [string, string][] = [
  ["⌘ K  /  Ctrl K", "Recherche globale et actions rapides"],
  ["Ctrl Maj D", "Afficher / masquer la barre de démonstration"],
  ["Échap", "Fermer la couche ouverte (fenêtre, tiroir, menu)"],
  ["Tab / Maj Tab", "Naviguer entre les contrôles"],
  ["Entrée", "Ouvrir la ligne ou le bloc sélectionné"],
  ["M puis flèches", "Planning : déplacer le bloc sélectionné (Entrée valide, Échap annule)"],
  ["R puis flèches", "Planning : redimensionner le bloc sélectionné"],
  ["← →", "Visite guidée : étape précédente / suivante"],
];

export function HelpDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} onClose={onClose} title="Aide et raccourcis" subtitle="SBS Staffing — version de démonstration">
      <div className="flex flex-col gap-6 text-base text-text-secondary">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"><Keyboard className="size-4" /> Raccourcis clavier</h3>
          <dl className="divide-y divide-line rounded-lg border border-border">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k} className="flex items-start justify-between gap-4 px-3 py-2">
                <dt><kbd className="rounded border border-border-strong bg-paper px-1.5 py-0.5 text-xs">{k}</kbd></dt>
                <dd className="text-end text-sm">{d}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Comment lire les statuts</h3>
          <p className="text-sm">Vert : normal · Orange : attention · Rouge : conflit ou urgence. La couleur n’est jamais seule : chaque statut porte une icône et un libellé. Un bloc hachuré est une réservation (soft), un bloc plein une affectation confirmée.</p>
        </section>
        <section>
          <h3 className="mb-2 text-sm font-semibold text-ink">Données de démonstration</h3>
          <p className="text-sm">Tous les noms, clients et chiffres sont fictifs. Les e-mails sont simulés (journal des e-mails) et l’intelligence artificielle fonctionne par requêtes sur les données, sans service externe.</p>
        </section>
      </div>
    </Drawer>
  );
}

export function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s, me, emp } = useSession();
  if (!me) return null;
  const grade = s.grades.find((g) => g.id === emp?.gradeId);
  const dept = s.departments.find((d) => d.id === emp?.departmentId);
  return (
    <Drawer open={open} onClose={onClose} title="Mon profil" footer={<Button variant="secondary" onClick={onClose}>Fermer</Button>}>
      <div className="flex items-center gap-4">
        <Avatar person={{ firstName: me.firstName, lastName: me.lastName, departmentId: emp?.departmentId }} size="xl" />
        <div>
          <p className="text-lg font-semibold text-ink">{me.firstName} {me.lastName}</p>
          <p className="text-sm text-text-secondary">{ROLE_LABEL[me.role]}</p>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-text-muted">E-mail</dt><dd>{me.email}</dd>
        {emp && (<><dt className="text-text-muted">Poste</dt><dd>{emp.jobTitle}</dd><dt className="text-text-muted">Grade</dt><dd>{grade?.name}</dd><dt className="text-text-muted">Département</dt><dd>{dept?.name}</dd><dt className="text-text-muted">Matricule</dt><dd className="font-mono">{emp.matricule}</dd></>)}
        <dt className="text-text-muted">Dernière connexion</dt><dd>{me.lastLoginAt ? fmtDate(me.lastLoginAt) : "—"}</dd>
        <dt className="text-text-muted">Permissions</dt><dd>{s.rolePermissions[me.role].length} sur {PERMISSIONS.length}</dd>
      </dl>
    </Drawer>
  );
}

/** « Aperçu » overlay for behaviour that exists in the final product but not in the prototype (spec 0.3). */
export function PreviewModal({ open, onClose, title, description }: { open: boolean; onClose: () => void; title: string; description: string }) {
  return (
    <Modal open={open} onClose={onClose} title={`Aperçu — ${title}`} subtitle="Fonction du produit final, non simulée dans cette version" footer={<Button onClick={onClose}>Compris</Button>}>
      <p className="text-pretty">{description}</p>
    </Modal>
  );
}
