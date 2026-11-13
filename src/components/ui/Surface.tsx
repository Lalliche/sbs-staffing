"use client";
import { Info, TriangleAlert, CheckCircle2, OctagonX, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { revealReduced, rowIn, staggerParent, staggerStep, spring } from "@/lib/motion-tokens";
import { useReducedMotion } from "motion/react";
import { Button } from "./Button";

export function Card({ children, className, padded = true, as: Tag = "section" }: { children: ReactNode; className?: string; padded?: boolean; as?: "section" | "div" | "article" }) {
  return <Tag className={cn("rounded-lg border border-border bg-bg", padded && "p-5", className)}>{children}</Tag>;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-md font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-shimmer rounded-md bg-[linear-gradient(90deg,var(--color-paper)_25%,var(--color-paper-deep)_50%,var(--color-paper)_75%)] bg-[length:200%_100%]", className)} />;
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <span className="flex size-11 items-center justify-center rounded-full bg-paper text-text-muted">
        <Icon className="size-5" strokeWidth={1.6} />
      </span>
      <div>
        <p className="text-md font-semibold text-ink">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-[28em] text-sm text-text-secondary text-pretty">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const callouts = {
  info: { cls: "bg-info-bg border-info/25 text-info", Icon: Info },
  alert: { cls: "bg-alert-bg border-alert/30 text-alert", Icon: TriangleAlert },
  danger: { cls: "bg-conflict-bg border-conflict/30 text-conflict", Icon: OctagonX },
  success: { cls: "bg-ok-bg border-ok/25 text-ok", Icon: CheckCircle2 },
  neutral: { cls: "bg-paper border-border text-text-secondary", Icon: Info },
} as const;
export function Callout({ tone = "neutral", title, children, className, action }: { tone?: keyof typeof callouts; title?: string; children?: ReactNode; className?: string; action?: ReactNode }) {
  const { cls, Icon } = callouts[tone];
  return (
    <div role={tone === "danger" ? "alert" : undefined} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-pretty">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", tone !== "neutral" ? "opacity-90" : "")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, tone = "primary", className, label }: { value: number; tone?: "primary" | "ok" | "alert" | "conflict"; className?: string; label?: string }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100} className={cn("h-1.5 w-full overflow-hidden rounded-full bg-paper-deep", className)}>
      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, Math.max(0, value)) }} transition={spring.gentle} style={{ transformOrigin: "left" }} className={cn("h-full w-full rounded-full", tone === "primary" ? "bg-primary" : tone === "ok" ? "bg-ok" : tone === "alert" ? "bg-alert" : "bg-conflict")} />
    </div>
  );
}

export function PageHeader({ breadcrumb, title, description, actions }: { breadcrumb?: Array<{ label: string; href?: string }>; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && (
          <nav aria-label="Fil d’Ariane" className="mb-1.5 flex items-center gap-1.5 text-xs text-text-muted">
            {breadcrumb.map((b, i) => (
              <span key={b.label} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden>/</span>}
                {b.href ? (
                  <Link href={b.href} className="transition-colors hover:text-text">
                    {b.label}
                  </Link>
                ) : (
                  <span>{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-semibold tracking-[-0.01em] text-ink text-balance">{title}</h1>
        {description && <p className="mt-1 max-w-[46em] text-base text-text-secondary text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Staggered list container for cards/rows (≤ 40 ms, first view only). */
export function Stagger({ children, className, step = staggerStep.rows }: { children: ReactNode; className?: string; step?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={staggerParent(step)} initial={reduce ? false : "hidden"} animate="visible">
      {children}
    </motion.div>
  );
}
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? revealReduced : rowIn}>
      {children}
    </motion.div>
  );
}

export function LinkButtonRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button href={href} variant="secondary" size="sm">
      {children}
    </Button>
  );
}
