"use client";
import { CircleHelp, LogOut, Menu, Search, Sparkles, UserCircle2, Route } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { enterAs } from "@/lib/store/store";
import { ROLE_LABEL } from "@/lib/engine/permissions";
import { useSession } from "@/lib/store/hooks";
import { isSelfView } from "@/lib/store/selectors/core";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { MenuItem, Popover } from "@/components/ui/Popover";
import { CRUMBS } from "./nav-config";
import { NotificationsPopover } from "./NotificationsPopover";
import { useShell } from "./ShellContext";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { s, me, emp, can } = useSession();
  const path = usePathname();
  const router = useRouter();
  const shell = useShell();
  if (!me) return null;
  const selfView = isSelfView(s);
  const segs = path.split("/").filter(Boolean).slice(1).filter((sg) => !(selfView && sg === emp?.id)); // « Mon profil » is one crumb, not two
  const crumbs = segs.map((sg, i) => {
    const href = "/" + ["app", ...segs.slice(0, i + 1)].join("/");
    let label = selfView && sg === "collaborateurs" ? "Mon profil" : CRUMBS[sg];
    if (!label) label = s.projects.find((m) => m.id === sg)?.name ?? (s.employees.find((e) => e.id === sg) ? `${s.employees.find((e) => e.id === sg)!.firstName} ${s.employees.find((e) => e.id === sg)!.lastName}` : s.requests.find((r) => r.id === sg)?.reference ?? sg);
    return { label, href: i < segs.length - 1 ? href : undefined };
  });
  return (
    <header className="no-print flex h-[3.25em] shrink-0 items-center gap-3 border-b border-border bg-bg px-4 md:px-6">
      <IconButton label="Ouvrir le menu" onClick={onMenu} className="md:hidden"><Menu className="size-5" /></IconButton>
      <nav aria-label="Fil d’Ariane" className="hidden min-w-0 items-center gap-1.5 text-sm text-text-muted sm:flex">
        <Link href="/app/accueil" className="transition-colors hover:text-text">SBS Staffing</Link>
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            <span aria-hidden>/</span>
            {c.href ? <Link href={c.href} className="truncate transition-colors hover:text-text">{c.label}</Link> : <span className="truncate font-medium text-text">{c.label}</span>}
          </span>
        ))}
      </nav>
      <span className="flex-1" />
      <button type="button" onClick={shell.openPalette} data-tour="search" className="hidden h-9 w-[17em] items-center gap-2.5 rounded-md border border-border-strong bg-canvas px-3 text-sm text-text-muted transition-colors hover:border-primary/60 hover:bg-bg md:flex">
        <Search className="size-4" /> <span className="flex-1 text-start">Rechercher…</span>
        <kbd className="rounded border border-border bg-bg px-1.5 text-xs">⌘K</kbd>
      </button>
      <IconButton label="Rechercher" onClick={shell.openPalette} className="md:hidden"><Search className="size-5" /></IconButton>
      {can("ai.use") && (
        <span data-tour="assistant">
          <Button variant="secondary" size="sm" onClick={() => shell.openAssistant()} icon={<Sparkles className="size-4" />}>
            <span className="max-lg:hidden">Intelligence</span>
          </Button>
        </span>
      )}
      <NotificationsPopover />
      <IconButton label="Aide" onClick={shell.openHelp}><CircleHelp className="size-[1.15em]" /></IconButton>
      <Popover
        label="Menu utilisateur"
        width="17em"
        trigger={({ toggle, ref }) => (
          <button ref={ref} type="button" onClick={toggle} aria-label="Menu utilisateur" className="rounded-full">
            <Avatar person={{ firstName: me.firstName, lastName: me.lastName, departmentId: emp?.departmentId }} size="md" />
          </button>
        )}
      >
        {(close) => (
          <div role="menu">
            <div className="border-b border-border px-3 py-3">
              <p className="text-base font-semibold text-ink">{me.firstName} {me.lastName}</p>
              <p className="text-xs text-text-muted">{ROLE_LABEL[me.role]}</p>
            </div>
            <div className="py-1">
              <MenuItem icon={<UserCircle2 />} onClick={() => { close(); shell.openProfile(); }}>Mon profil</MenuItem>
              <MenuItem icon={<CircleHelp />} onClick={() => { close(); router.push("/app/aide"); }}>Aide et raccourcis</MenuItem>
              <MenuItem icon={<Route />} onClick={() => { close(); shell.startTour(); }}>Relancer la visite guidée</MenuItem>
            </div>
            <div className="border-t border-border py-1">
              <MenuItem icon={<LogOut />} onClick={() => { close(); enterAs(null); router.push("/"); }}>Se déconnecter</MenuItem>
            </div>
          </div>
        )}
      </Popover>
    </header>
  );
}
