"use client";
import { CalendarPlus, ClipboardList, CornerDownLeft, FilePlus2, Search, Sparkles, UserRound, Users, Network } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import { overlayFade, popIn } from "@/lib/motion-tokens";
import { useSession } from "@/lib/store/hooks";
import { visibleEmployees, visibleProjects, visibleRequests } from "@/lib/store/selectors/core";
import { Avatar } from "@/components/ui/Avatar";
import { canSee, NAV } from "./nav-config";
import { useShell } from "./ShellContext";

interface Cmd {
  id: string;
  group: "Actions" | "Pages" | "Personnes" | "Missions" | "Demandes" | "Compétences";
  label: string;
  hint?: string;
  icon: ReactNode;
  run: () => void;
}

/** Global search ⌘K: people, missions, requests, skills, pages and actions — limited to what the viewer may see (spec 8.17). */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { s, me, can } = useSession();
  const router = useRouter();
  const shell = useShell();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const cmds = useMemo<Cmd[]>(() => {
    if (!me) return [];
    const go = (href: string) => () => router.push(href);
    const list: Cmd[] = [];
    if (can("ai.use")) list.push({ id: "a-ai", group: "Actions", label: "Demander à SBS Staffing Intelligence", icon: <Sparkles className="size-4" />, run: () => shell.openAssistant() });
    if (can("project.create")) list.push({ id: "a-mission", group: "Actions", label: "Créer une mission", icon: <FilePlus2 className="size-4" />, run: go("/app/missions?nouveau=1") });
    if (can("request.create")) list.push({ id: "a-req", group: "Actions", label: "Créer une demande de staffing", icon: <ClipboardList className="size-4" />, run: go("/app/demandes?nouveau=1") });
    if (can("leave.request")) list.push({ id: "a-leave", group: "Actions", label: "Poser un congé", icon: <CalendarPlus className="size-4" />, run: go("/app/disponibilites?nouveau=1") });
    NAV.forEach((g) => g.items.filter((i) => canSee(i, can)).forEach((i) => list.push({ id: `p-${i.key}`, group: "Pages", label: i.label, hint: g.label, icon: <i.icon className="size-4" />, run: go(i.href) })));
    visibleEmployees(s).forEach((e) => list.push({ id: `e-${e.id}`, group: "Personnes", label: `${e.firstName} ${e.lastName}`, hint: e.jobTitle, icon: <Avatar person={e} size="xs" />, run: go(`/app/collaborateurs/${e.id}`) }));
    visibleProjects(s).forEach((p) => list.push({ id: `m-${p.id}`, group: "Missions", label: p.name, hint: p.reference, icon: <ClipboardList className="size-4" />, run: go(`/app/missions/${p.id}`) }));
    visibleRequests(s).forEach((r) => list.push({ id: `r-${r.id}`, group: "Demandes", label: r.reference, hint: s.projects.find((p) => p.id === r.projectId)?.name, icon: <Users className="size-4" />, run: go(`/app/demandes/${r.id}`) }));
    if (can("skill.view")) s.skills.forEach((k) => list.push({ id: `k-${k.id}`, group: "Compétences", label: k.name, hint: s.skillCategories.find((c) => c.id === k.categoryId)?.name, icon: <Network className="size-4" />, run: go(`/app/competences?q=${encodeURIComponent(k.name)}`) }));
    return list;
  }, [s, me, can, router, shell]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t ? cmds.filter((c) => (c.label + " " + (c.hint ?? "")).toLowerCase().includes(t)) : cmds.filter((c) => c.group === "Actions" || c.group === "Pages");
    return base.slice(0, 40);
  }, [cmds, q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      if (e.key === "Enter") { e.preventDefault(); const c = results[idx]; if (c) { onClose(); c.run(); } }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, results, idx, onClose]);

  if (typeof document === "undefined") return null;
  const groups = results.reduce<Record<string, Cmd[]>>((a, c) => ((a[c.group] ??= []).push(c), a), {});
  let n = -1;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div {...overlayFade} className="absolute inset-0 bg-ink/45" onClick={onClose} aria-hidden />
          <motion.div {...popIn} role="dialog" aria-modal="true" aria-label="Recherche globale" className="relative w-full max-w-[38em] overflow-hidden rounded-xl bg-bg shadow-xl">
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 text-text-muted" />
              <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Personnes, missions, demandes, compétences, pages…" aria-label="Rechercher" role="combobox" aria-expanded aria-controls="cmd-list" className="h-12 flex-1 bg-transparent text-md text-ink placeholder:text-text-muted focus-visible:shadow-none focus-visible:outline-none" />
              <kbd className="rounded border border-border px-1.5 text-xs text-text-muted">Échap</kbd>
            </div>
            <ul id="cmd-list" role="listbox" className="scroll-thin max-h-[26em] overflow-y-auto py-1">
              {results.length === 0 && <li className="px-4 py-8 text-center text-sm text-text-muted">Aucun résultat pour « {q} ».</li>}
              {Object.entries(groups).map(([g, items]) => (
                <li key={g} role="presentation">
                  <p className="px-4 pb-1 pt-2.5 text-2xs font-medium uppercase tracking-[0.1em] text-text-muted">{g}</p>
                  <ul role="group">
                    {items.map((c) => {
                      n++;
                      const my = n;
                      return (
                        <li key={c.id} role="option" aria-selected={my === idx}>
                          <button type="button" onMouseMove={() => setIdx(my)} onClick={() => { onClose(); c.run(); }} className={cn("flex w-full items-center gap-3 px-4 py-2 text-start text-base focus-visible:shadow-none", my === idx ? "bg-select text-ink" : "text-text")}>
                            <span className="flex size-6 items-center justify-center text-text-muted">{c.icon}</span>
                            <span className="min-w-0 flex-1 truncate">{c.label}</span>
                            {c.hint && <span className="max-w-[40%] truncate text-xs text-text-muted">{c.hint}</span>}
                            {my === idx && <CornerDownLeft className="size-3.5 text-text-muted" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
export { UserRound };
