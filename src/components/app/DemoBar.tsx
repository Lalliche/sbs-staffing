"use client";
import { Check, ChevronDown, Clock, FastForward, Layers, PanelTopClose, PanelTopOpen, RotateCcw, Route, Sparkles, UserRound } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";
import { act, enterAs, resetDemo, setScenario, travel } from "@/lib/store/store";
import { simulateRequest } from "@/lib/store/actions/demo";
import { fmtDate } from "@/lib/engine/format";
import { ROLE_LABEL } from "@/lib/engine/permissions";
import { SCENARIO_LABEL } from "@/lib/store/seed";
import { PERSONAS } from "@/lib/store/seed/people";
import { useSession } from "@/lib/store/hooks";
import type { Scenario } from "@/lib/store/types";
import { Popover } from "@/components/ui/Popover";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { canSee, NAV } from "./nav-config";
import { useShell } from "./ShellContext";
import { can as canFn } from "@/lib/engine/permissions";

const Btn = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function Btn({ children, className, ...p }, ref) {
  return (
    <button ref={ref} type="button" {...p} className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2.5 text-xs font-medium text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:shadow-[0_0_0_2px_rgb(255_255_255/0.6)]", className)}>
      {children}
    </button>
  );
});
const Opt = ({ active, children, onClick }: { active?: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm text-text hover:bg-paper focus-visible:bg-paper focus-visible:shadow-none">
    <span className="flex size-4 items-center justify-center">{active && <Check className="size-4" />}</span>
    {children}
  </button>
);

/** 40 px demo layer, separate from the product UI (spec 4). Ctrl+Shift+D toggles it. */
export function DemoBar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { s, me } = useSession();
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const shell = useShell();
  const [confirm, setConfirm] = useState(false);

  if (collapsed)
    return (
      <button type="button" onClick={onToggle} aria-label="Afficher la barre de démonstration (Ctrl+Maj+D)" className="no-print fixed start-3 top-2 z-[85] flex items-center gap-1.5 rounded-full bg-side px-3 py-1 text-xs font-medium text-white shadow-lg ring-1 ring-white/15 hover:bg-side-raised">
        <PanelTopOpen className="size-3.5" /> Démo
      </button>
    );

  const switchTo = (id: string) => {
    enterAs(id);
    const u = s.users.find((x) => x.id === id)!;
    const can = (p: string) => canFn(s, u, p);
    const allowed = NAV.some((g) => g.items.some((i) => canSee(i, can) && (path === i.href || path.startsWith(i.href + "/"))));
    if (!allowed) router.push("/app/accueil");
  };

  return (
    <div role="region" aria-label="Barre de démonstration" className="no-print relative z-[60] flex h-10 shrink-0 items-center gap-1 overflow-x-auto bg-ink px-3 text-white [&::-webkit-scrollbar]:hidden">
      <span className="me-2 hidden items-center gap-2 text-2xs font-semibold uppercase tracking-[0.14em] text-white/45 lg:flex">Démo</span>
      <Popover
        label="Voir en tant que"
        align="start"
        width="23em"
        trigger={({ toggle, ref }) => (
          <Btn ref={ref} onClick={toggle} data-tour="persona">
            <UserRound className="size-3.5" /> Voir en tant que <span className="font-semibold text-white">{me ? `${me.firstName}` : "—"}</span> <ChevronDown className="size-3 opacity-60" />
          </Btn>
        )}
      >
        {(close) => (
          <div className="py-1">
            {PERSONAS.map((p) => {
              const u = s.users.find((x) => x.id === p.id)!;
              const e = s.employees.find((x) => x.id === u.employeeId);
              return (
                <button key={p.id} type="button" onClick={() => { switchTo(p.id); close(); }} className="flex w-full items-center gap-3 px-3 py-2 text-start hover:bg-paper focus-visible:bg-paper focus-visible:shadow-none">
                  <Avatar person={{ firstName: u.firstName, lastName: u.lastName, departmentId: e?.departmentId }} size="sm" />
                  <span className="flex-1 text-sm leading-tight">
                    <span className="block font-medium text-ink">{u.firstName} {u.lastName}</span>
                    <span className="block text-xs text-text-muted">{p.label} · {p.hint}</span>
                  </span>
                  {me?.id === p.id && <Check className="size-4 text-ink" />}
                </button>
              );
            })}
          </div>
        )}
      </Popover>
      <Popover
        label="Scénario"
        align="start"
        width="23em"
        trigger={({ toggle, ref }) => (
          <Btn ref={ref} onClick={toggle} data-tour="scenario">
            <Layers className="size-3.5" /> Scénario <span className="hidden font-semibold text-white xl:inline">{SCENARIO_LABEL[s.scenario]}</span> <ChevronDown className="size-3 opacity-60" />
          </Btn>
        )}
      >
        {(close) => (
          <div className="py-1">
            {([1, 2, 3, 4] as Scenario[]).map((n) => (
              <Opt key={n} active={s.scenario === n} onClick={() => { setScenario(n); close(); router.push("/app/accueil"); toast({ title: `Scénario ${n} chargé`, body: SCENARIO_LABEL[n], tone: "info" }); }}>
                <span><span className="me-1.5 tabular-nums text-text-muted">{["①", "②", "③", "④"][n - 1]}</span>{SCENARIO_LABEL[n]}</span>
              </Opt>
            ))}
          </div>
        )}
      </Popover>
      <Popover
        label="Avancer le temps"
        align="start"
        width="21em"
        trigger={({ toggle, ref }) => (
          <Btn ref={ref} onClick={toggle} data-tour="time">
            <Clock className="size-3.5" /> <span className="tabular-nums">{fmtDate(s.now)}</span> <FastForward className="size-3 opacity-70" />
          </Btn>
        )}
      >
        {(close) => (
          <div className="py-1">
            <p className="px-3 pb-1 pt-2 text-xs font-medium text-text-muted">Avancer le temps</p>
            {[{ label: "+1 jour", v: 1 }, { label: "+1 semaine", v: 7 }, { label: "+1 mois", v: 30 }].map((o) => (
              <Opt key={o.label} onClick={() => {
                const sum = travel(o.v);
                close();
                toast({ title: "Le temps avance", body: `${o.label}${sum.expiredSoft ? ` · ${sum.expiredSoft} réservation(s) expirée(s)` : ""}${sum.certificationsExpiring ? ` · ${sum.certificationsExpiring} certification(s) bientôt expirée(s)` : ""}`, tone: "info" });
              }}>{o.label}</Opt>
            ))}
            <p className="border-t border-border px-3 py-2 text-xs text-text-muted">Certifications bientôt expirées, réservations qui expirent, début et fin de missions se déclenchent.</p>
          </div>
        )}
      </Popover>
      <Btn onClick={() => { const r = act((d) => simulateRequest(d)); toast({ title: "Demande simulée", body: r.ok ? String(r.value) : r.error }); }} data-tour="simulate">
        <Sparkles className="size-3.5" /> Simuler une demande
      </Btn>
      <Btn onClick={shell.startTour} data-tour="tour-btn"><Route className="size-3.5" /> Visite guidée</Btn>
      <Btn onClick={() => setConfirm(true)}><RotateCcw className="size-3.5" /> Réinitialiser</Btn>
      <span className="flex-1" />
      {me && <span className="hidden text-xs text-white/45 xl:inline">{ROLE_LABEL[me.role]}</span>}
      <Btn onClick={onToggle} aria-label="Réduire la barre de démonstration (Ctrl+Maj+D)" title="Ctrl+Maj+D"><PanelTopClose className="size-3.5" /></Btn>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Réinitialiser la démonstration ?" subtitle={`Le scénario « ${SCENARIO_LABEL[s.scenario]} » sera rechargé.`} footer={<><Button variant="ghost" onClick={() => setConfirm(false)}>Annuler</Button><Button variant="danger" onClick={() => { resetDemo(); setConfirm(false); router.push("/app/accueil"); toast({ title: "Démonstration réinitialisée" }); }}>Réinitialiser</Button></>}>
        Les affectations, demandes, présences et réglages créés pendant la démonstration seront effacés.
      </Modal>
    </div>
  );
}
