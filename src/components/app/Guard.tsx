"use client";
import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { Resource } from "@/lib/engine/permissions";
import { useSession } from "@/lib/store/hooks";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Surface";

/** Route guard: 403 state when the persona lacks the permission (spec 3.3). `any` = at least one of. */
export function Guard({ perm, any, res, children }: { perm?: string; any?: string[]; res?: Resource; children: ReactNode }) {
  const { can, me } = useSession();
  const ok = !me ? false : any ? any.some((p) => can(p, res)) : perm ? can(perm, res) : true;
  if (ok) return <>{children}</>;
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Accès non autorisé (403)"
      description="Votre profil n’autorise pas l’accès à cette page. Changez de profil depuis la barre de démonstration, ou revenez au tableau de bord."
      action={<Button href="/app/accueil" variant="secondary">Retour au tableau de bord</Button>}
      className="py-24"
    />
  );
}
