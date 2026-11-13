"use client";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { dur, ease, overlayFade, popIn } from "@/lib/motion-tokens";
import { Button } from "./Button";
import { IconButton } from "./Button";

const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input:not([type=hidden]),select,[tabindex]:not([tabindex="-1"])';

function useOverlayBehavior(open: boolean, onRequestClose: () => void, panel: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onRequestClose();
      }
      if (e.key === "Tab" && panel.current) {
        const els = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, onRequestClose, panel]);
}

function GuardBar({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  return (
    <div role="alertdialog" aria-label="Modifications non enregistrées" className="flex items-center justify-between gap-3 border-t border-alert/25 bg-alert-bg px-5 py-3 text-sm text-alert">
      <span>Des modifications ne sont pas enregistrées. Abandonner ?</span>
      <span className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onStay}>
          Rester
        </Button>
        <Button size="sm" variant="danger" onClick={onLeave}>
          Abandonner
        </Button>
      </span>
    </div>
  );
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  dirty?: boolean;
  tone?: "default" | "danger";
}

export function Modal({ open, onClose, title, subtitle, children, footer, dirty, size = "md" }: OverlayProps & { size?: "md" | "lg" }) {
  const mounted = useMounted();
  const panel = useRef<HTMLDivElement>(null);
  const [guard, setGuard] = useState(false);
  const request = useCallback(() => (dirty ? setGuard(true) : onClose()), [dirty, onClose]);
  useOverlayBehavior(open, request, panel);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setGuard(false);
  }
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <motion.div {...overlayFade} className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={request} aria-hidden />
          <motion.div ref={panel} {...popIn} role="dialog" aria-modal="true" aria-label={title} className={cn("relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-xl bg-bg shadow-xl", size === "md" ? "max-w-[30em]" : "max-w-[42em]")}>
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-md font-semibold text-ink">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
              </div>
              <IconButton label="Fermer" size="sm" onClick={request}>
                <X className="size-4" />
              </IconButton>
            </header>
            <div className="scroll-thin overflow-y-auto px-5 py-4 text-base text-text-secondary">{children}</div>
            {guard && <GuardBar onStay={() => setGuard(false)} onLeave={onClose} />}
            {footer && <footer className="flex items-center justify-end gap-2 border-t border-border bg-canvas/60 px-5 py-3">{footer}</footer>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, dirty, width = "36em" }: OverlayProps & { width?: string }) {
  const mounted = useMounted();
  const panel = useRef<HTMLDivElement>(null);
  const [guard, setGuard] = useState(false);
  const request = useCallback(() => (dirty ? setGuard(true) : onClose()), [dirty, onClose]);
  useOverlayBehavior(open, request, panel);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setGuard(false);
  }
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div {...overlayFade} className="absolute inset-0 bg-ink/40" onClick={request} aria-hidden />
          <motion.aside
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: "100%" }}
            animate={{ x: 0, transition: { duration: 0.42, ease: ease.drawer } }}
            exit={{ x: "100%", transition: { duration: dur.base, ease: ease.in } }}
            style={{ width: `min(${width}, 100vw)` }}
            className="absolute inset-y-0 end-0 flex flex-col bg-bg shadow-xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
              <div>
                <h2 className="text-md font-semibold text-ink">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
              </div>
              <IconButton label="Fermer" size="sm" onClick={request}>
                <X className="size-4" />
              </IconButton>
            </header>
            <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
            {guard && <GuardBar onStay={() => setGuard(false)} onLeave={onClose} />}
            {footer && <footer className="flex items-center justify-between gap-2 border-t border-border bg-canvas/60 px-6 py-3">{footer}</footer>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
