import { Building2, CalendarOff, Home, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Presence } from "@/lib/engine/workmode";

/* Présence is a category, not a status: it never uses the ok / alert / conflict colours.
   Shape (icon) + French label + a tint — colour is never the only carrier. */
export const PRESENCE_META: Record<Presence, { label: string; short: string; Icon: LucideIcon; cls: string }> = {
  ONSITE: { label: "Présentiel", short: "Sur site", Icon: Building2, cls: "bg-select text-primary border-primary/25" },
  REMOTE: { label: "À distance", short: "À distance", Icon: Home, cls: "bg-paper text-ink border-border-strong/50" },
  ABSENT: { label: "Absent(e)", short: "Absent", Icon: CalendarOff, cls: "bg-neutral-bg text-neutral border-neutral/20" },
  OFF: { label: "Jour non travaillé", short: "Non travaillé", Icon: Minus, cls: "bg-transparent text-text-muted border-line" },
};

export function PresenceBadge({ presence, short, className }: { presence: Presence; short?: boolean; className?: string }) {
  const m = PRESENCE_META[presence];
  return (
    <span className={cn("inline-flex h-[1.65em] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium", m.cls, className)}>
      <m.Icon className="size-[1.05em] shrink-0" aria-hidden />
      {short ? m.short : m.label}
    </span>
  );
}
