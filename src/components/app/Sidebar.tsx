"use client";
import { ChevronsLeft } from "lucide-react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { dur, ease, spring } from "@/lib/motion-tokens";
import { useSession } from "@/lib/store/hooks";
import { unreadCount } from "@/lib/store/selectors/notifications";
import { BrandLockup, Monogram } from "./Brand";
import { isSelfView } from "@/lib/store/selectors/core";
import { canSee, resolveNav, type NavItem } from "./nav-config";
import { site } from "@/content/site";

export const SIDEBAR_W = 248;
export const SIDEBAR_COLLAPSED_W = 72;

function Row({ item, collapsed, active, badge, onNavigate }: { item: NavItem; collapsed: boolean; active: boolean; badge?: number; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      data-tour={item.tour}
      className={cn("group/row relative flex h-9 items-center rounded-md text-sm font-medium transition-colors duration-150 focus-visible:shadow-[0_0_0_2px_#9aa6bc]", collapsed ? "justify-center" : "gap-3 px-3", active ? "text-white" : "text-side-muted hover:text-white")}
    >
      {active && <motion.span layoutId="sidebar-active" transition={spring.ui} className="absolute inset-0 rounded-md bg-side-raised" />}
      {active && <motion.span layoutId="sidebar-bar" transition={spring.ui} className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-side-text" />}
      {!active && <span aria-hidden className="absolute inset-0 rounded-md bg-white/0 transition-colors duration-150 group-hover/row:bg-white/[0.05]" />}
      <span className="relative shrink-0">
        <Icon className="size-[1.15em]" strokeWidth={active ? 2 : 1.7} />
        {collapsed && !!badge && <span className="absolute -end-1 -top-1 size-2 rounded-full bg-side-text ring-2 ring-side" />}
      </span>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: dur.fast, ease: ease.out }} className="relative flex-1 truncate">
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
      {!collapsed && !!badge && <span className="relative rounded-full bg-side-text px-1.5 text-xs font-semibold tabular-nums text-side">{badge}</span>}
      {collapsed && (
        <span role="tooltip" className="pointer-events-none absolute start-full top-1/2 z-50 ms-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-side-raised px-2.5 py-1.5 text-xs text-white opacity-0 shadow-lg ring-1 ring-white/10 transition-opacity duration-100 group-hover/row:opacity-100">
          {item.label}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({ collapsed, onToggle, mobile, onNavigate }: { collapsed: boolean; onToggle?: () => void; mobile?: boolean; onNavigate?: () => void }) {
  const { s, me, can } = useSession();
  const path = usePathname();
  if (!me) return null;
  const groups = resolveNav(isSelfView(s)).map((g) => ({ ...g, items: g.items.filter((i) => canSee(i, can)) })).filter((g) => g.items.length);
  const unread = unreadCount(s, me.id);
  const isActive = (href: string) => path === href || path.startsWith(href + "/");
  const c = collapsed && !mobile;
  return (
    <motion.nav
      aria-label="Navigation principale"
      initial={false}
      animate={{ width: mobile ? "100%" : c ? SIDEBAR_COLLAPSED_W : SIDEBAR_W }}
      transition={spring.ui}
      className={cn("relative z-30 flex h-full shrink-0 flex-col bg-side text-white", !mobile && "max-md:hidden")}
    >
      <div className={cn("flex shrink-0 items-center border-b border-side-line", c ? "h-[5.25em] justify-center" : "h-[5.25em] px-4")}>
        <Link href="/app/accueil" aria-label="SBS Staffing — Tableau de bord" onClick={onNavigate} className="flex items-center rounded-sm focus-visible:shadow-[0_0_0_2px_#9aa6bc]">
          {c ? <Monogram size="2.1em" /> : <BrandLockup />}
        </Link>
      </div>
      <LayoutGroup id={mobile ? "sb-m" : "sb"}>
        <div className="scroll-thin flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          {groups.map((g) => (
            <div key={g.label} className="mb-5">
              {!c ? <p className="mb-1.5 px-3 text-2xs font-medium uppercase tracking-[0.12em] text-side-muted/70">{g.label}</p> : <div className="mx-auto mb-2 h-px w-6 bg-side-line" />}
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) => (
                  <li key={it.key}>
                    <Row item={it} collapsed={c} active={isActive(it.href)} badge={it.key === "notifications" ? unread : undefined} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </LayoutGroup>
      <div className="shrink-0 border-t border-side-line p-3">{!c && <p className="px-2 text-2xs leading-snug text-side-muted/80">{site.demoNote}</p>}</div>
      {!mobile && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={c ? "Déplier le menu" : "Réduire le menu"}
          aria-expanded={!c}
          title={c ? "Déplier le menu" : "Réduire le menu"}
          className="absolute -end-3.5 top-[4.4em] z-40 flex size-7 items-center justify-center rounded-full border border-border-strong bg-bg text-ink shadow-md transition-[transform,background-color,color] duration-150 ease-(--ease-out-strong) hover:scale-110 hover:bg-primary hover:text-white active:scale-95"
        >
          <motion.span animate={{ rotate: c ? 180 : 0 }} transition={spring.ui} className="flex">
            <ChevronsLeft className="size-4" />
          </motion.span>
        </button>
      )}
    </motion.nav>
  );
}
