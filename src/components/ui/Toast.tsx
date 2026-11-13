"use client";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dur, ease, spring } from "@/lib/motion-tokens";

interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: "success" | "info" | "warning";
  undo?: () => void;
}
type ToastFn = (t: { title: string; body?: string; tone?: ToastItem["tone"]; undo?: () => void }) => void;
const Ctx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const push = useCallback<ToastFn>(
    (t) => {
      const id = ++idRef.current;
      setItems((l) => [...l.slice(-2), { id, title: t.title, body: t.body, tone: t.tone ?? "success", undo: t.undo }]);
      setTimeout(() => dismiss(id), t.undo ? 6000 : 5000);
    },
    [dismiss],
  );
  const value = useMemo(() => push, [push]);
  const Icon = { success: CheckCircle2, info: Info, warning: TriangleAlert };
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-end gap-2 px-4">
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const I = Icon[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: spring.toast }}
                exit={{ opacity: 0, x: 24, transition: { duration: dur.fast, ease: ease.in } }}
                className="pointer-events-auto flex w-[min(24em,100%)] items-start gap-3 rounded-lg bg-ink p-3.5 text-white shadow-lg"
              >
                <I className={cn("mt-0.5 size-[1.1em] shrink-0", t.tone === "success" ? "text-[#6FD0A0]" : t.tone === "warning" ? "text-[#F2B659]" : "text-white/70")} />
                <div className="min-w-0 flex-1 text-sm leading-snug">
                  <p className="font-medium">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-white/65">{t.body}</p>}
                </div>
                {t.undo && (
                  <button
                    type="button"
                    onClick={() => {
                      t.undo?.();
                      dismiss(t.id);
                    }}
                    className="shrink-0 text-sm font-semibold text-white underline-offset-2 hover:underline focus-visible:shadow-none"
                  >
                    Annuler
                  </button>
                )}
                <button type="button" aria-label="Fermer la notification" onClick={() => dismiss(t.id)} className="shrink-0 text-white/50 transition-colors hover:text-white focus-visible:shadow-none">
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
