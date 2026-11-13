"use client";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { popIn } from "@/lib/motion-tokens";

const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/** Portal popover anchored to its trigger. `children` receives `close`. */
export function Popover({
  trigger,
  children,
  align = "end",
  width,
  className,
  label,
}: {
  trigger: (p: { open: boolean; toggle: () => void; ref: React.RefObject<HTMLButtonElement | null> }) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  width?: string;
  className?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const ref = useRef<HTMLButtonElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left, right: window.innerWidth - r.right });
    setOpen((o) => !o);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panel.current?.contains(e.target as Node) || ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.focus();
      }
    };
    const onScroll = (e: Event) => {
      if (panel.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  return (
    <>
      {trigger({ open, toggle, ref })}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && pos && (
              <motion.div
                ref={panel}
                {...popIn}
                role="dialog"
                aria-label={label}
                style={{ position: "fixed", top: pos.top, ...(align === "end" ? { right: pos.right } : { left: pos.left }), width }}
                className={cn("z-[90] max-h-[70vh] overflow-auto rounded-lg border border-border bg-bg shadow-lg scroll-thin", className)}
              >
                {children(close)}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

export function MenuItem({ icon, children, onClick, danger, disabled }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick} className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-start text-base transition-colors duration-100 hover:bg-paper focus-visible:bg-paper focus-visible:shadow-none disabled:opacity-40", danger ? "text-conflict" : "text-text")}>
      {icon && <span className="text-text-muted [&_svg]:size-4">{icon}</span>}
      {children}
    </button>
  );
}
