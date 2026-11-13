import { CircleAlert, CircleCheck, CircleDashed, CircleDot, Info, OctagonX, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* Status system (docs/design-system.md §2): colour is NEVER the only carrier — icon + French label always. */
export type Tone = "neutral" | "primary" | "ok" | "alert" | "conflict" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-neutral-bg text-neutral border-neutral/20",
  primary: "bg-select text-primary border-primary/20",
  ok: "bg-ok-bg text-ok border-ok/25",
  alert: "bg-alert-bg text-alert border-alert/30",
  conflict: "bg-conflict-bg text-conflict border-conflict/35 border-double border-2 px-[0.35em]",
  info: "bg-info-bg text-info border-info/25",
};
const dots: Record<Tone, string> = { neutral: "bg-neutral", primary: "bg-primary", ok: "bg-ok", alert: "bg-alert", conflict: "bg-conflict", info: "bg-info" };
export const STATUS_ICON: Record<Tone, LucideIcon> = { neutral: CircleDashed, primary: CircleDot, ok: CircleCheck, alert: TriangleAlert, conflict: OctagonX, info: Info };

export function Badge({ tone = "neutral", children, className, dot, icon }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean; icon?: boolean }) {
  const Icon = STATUS_ICON[tone];
  return (
    <span className={cn("inline-flex h-[1.65em] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium", tones[tone], className)}>
      {icon ? <Icon className="size-[1.05em] shrink-0" aria-hidden /> : dot ? <span className={cn("size-1.5 rounded-full", dots[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Status pill: shape (icon) + label + colour. Use for every status shown in a table or header. */
export function StatusPill({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <Badge tone={tone} icon className={className}>
      {label}
    </Badge>
  );
}
export { CircleAlert };
