"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { act, syncClock, useHydrated } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { dur, ease, overlayFade } from "@/lib/motion-tokens";
import { Skeleton } from "@/components/ui/Surface";
import { AssistantDrawer } from "@/components/ai/AssistantDrawer";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { DemoBar } from "./DemoBar";
import { CommandPalette } from "./CommandPalette";
import { HelpDrawer, PreviewModal, ProfileDrawer } from "./Drawers";
import { Tour } from "./Tour";
import { ShellContext, type ShellApi } from "./ShellContext";

const LS = "sbs-staffing:ui";
function readUi() {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? "{}") as { collapsed?: boolean; demoHidden?: boolean };
  } catch {
    return {};
  }
}
function writeUi(patch: object) {
  try {
    localStorage.setItem(LS, JSON.stringify({ ...readUi(), ...patch }));
  } catch {
    /* ignore */
  }
}

function ShellSkeleton() {
  return (
    <div className="flex h-svh">
      <div className="hidden w-[15.5em] bg-side md:block" />
      <div className="flex-1 p-8">
        <Skeleton className="h-6 w-60" />
        <Skeleton className="mt-6 h-32 w-full" />
        <div className="mt-6 grid gap-4 md:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { s, me } = useSession();
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const reduce = useReducedMotion();
  const [ui] = useState(readUi);
  const [collapsed, setCollapsed] = useState(!!ui.collapsed);
  const [demoHidden, setDemoHidden] = useState(!!ui.demoHidden);
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [profile, setProfile] = useState(false);
  const [assistant, setAssistant] = useState<{ open: boolean; prompt?: string }>({ open: false });
  const [preview, setPreview] = useState<{ title: string; description: string } | null>(null);
  const [tour, setTour] = useState<{ open: boolean; key: number }>({ open: false, key: 0 });

  // Session gate
  useEffect(() => {
    if (!s.session.userId) router.replace("/");
  }, [s.session.userId, router]);
  // Keep the demo clock coherent (statuses, expired soft bookings)
  useEffect(() => {
    syncClock();
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setDemoHidden((h) => {
          writeUi({ demoHidden: !h });
          return !h;
        });
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const startTour = useCallback(() => {
    router.push("/app/accueil");
    setTimeout(() => setTour((t) => ({ open: true, key: t.key + 1 })), 500);
  }, [router]);

  const wantTour = params.get("tour") === "1";
  useEffect(() => {
    if (wantTour && me) {
      const t = setTimeout(() => setTour((x) => ({ open: true, key: x.key + 1 })), 900);
      router.replace(path);
      return () => clearTimeout(t);
    }
  }, [wantTour, me, router, path]);

  const api = useMemo<ShellApi>(
    () => ({
      openPalette: () => setPalette(true),
      openHelp: () => setHelp(true),
      openAssistant: (prompt) => setAssistant({ open: true, prompt }),
      openProfile: () => setProfile(true),
      startTour,
      preview: (title, description) => setPreview({ title, description }),
    }),
    [startTour],
  );

  if (!me) return <ShellSkeleton />;
  return (
    <ShellContext.Provider value={api}>
      <div className="flex h-svh flex-col">
        <DemoBar collapsed={demoHidden} onToggle={() => setDemoHidden((h) => { writeUi({ demoHidden: !h }); return !h; })} />
        <div className="flex min-h-0 flex-1">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => { writeUi({ collapsed: !c }); return !c; })} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar onMenu={() => setMobileNav(true)} />
            <main id="contenu" className="scroll-thin min-h-0 flex-1 overflow-y-auto">
              <motion.div key={`${me.id}:${path}`} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: ease.out } }} className="mx-auto w-full max-w-[1760px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8">
                {children}
              </motion.div>
            </main>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileNav && (
          <div className="fixed inset-0 z-[80] md:hidden">
            <motion.div {...overlayFade} className="absolute inset-0 bg-ink/50" onClick={() => setMobileNav(false)} />
            <motion.div initial={{ x: "-100%" }} animate={{ x: 0, transition: { duration: 0.28, ease: ease.drawer } }} exit={{ x: "-100%", transition: { duration: dur.base } }} className="absolute inset-y-0 start-0 w-[18em]">
              <Sidebar collapsed={false} mobile onNavigate={() => setMobileNav(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <HelpDrawer open={help} onClose={() => setHelp(false)} />
      <ProfileDrawer open={profile} onClose={() => setProfile(false)} />
      <AssistantDrawer open={assistant.open} onClose={() => setAssistant({ open: false })} initialPrompt={assistant.prompt} />
      <PreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ""} description={preview?.description ?? ""} />
      <Tour key={`${me.role}-${tour.key}`} role={me.role} open={tour.open} onClose={() => { setTour((t) => ({ ...t, open: false })); act((d) => { d.tourSeen[me.id] = true; }); }} />
    </ShellContext.Provider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  if (!hydrated) return <ShellSkeleton />;
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
