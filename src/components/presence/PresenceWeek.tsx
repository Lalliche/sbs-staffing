"use client";
import { Check } from "lucide-react";
import { act } from "@/lib/store/store";
import { setWorkMode } from "@/lib/store/actions/workmode";
import { fmtDateShort, fmtWeekday } from "@/lib/engine/format";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import type { Presence } from "@/lib/engine/workmode";
import type { WorkMode } from "@/lib/store/types";
import { PRESENCE_META } from "./PresenceBadge";

type Day = { date: string; presence: Presence; override: boolean };

/** Day-by-day presence chips. When the viewer may edit, each working day toggles présentiel ↔ à distance (one audited action per click). */
export function PresenceWeek({ employeeId, weeks, today, editable }: { employeeId: string; weeks: Day[][]; today: string; editable: boolean }) {
  const toast = useToast();
  const toggle = (d: Day) => {
    if (!editable || (d.presence !== "ONSITE" && d.presence !== "REMOTE")) return;
    const mode: WorkMode = d.presence === "ONSITE" ? "REMOTE" : "ONSITE";
    const r = act((s) => setWorkMode(s, { employeeId, dates: [d.date], mode }));
    toast({ title: r.ok ? `${fmtDateShort(d.date)} : ${PRESENCE_META[mode].label.toLowerCase()}` : "Refusé", body: r.ok ? undefined : r.error, tone: r.ok ? "success" : "warning" });
  };
  return (
    <div className="space-y-2">
      {weeks.map((w, i) => (
        <div key={i} className="grid grid-cols-7 gap-1.5">
          {w.map((d) => {
            const m = PRESENCE_META[d.presence];
            const canToggle = editable && (d.presence === "ONSITE" || d.presence === "REMOTE");
            const label = `${fmtWeekday(d.date)} ${fmtDateShort(d.date)} — ${m.label}${d.override ? " (exception)" : ""}`;
            return (
              <button
                key={d.date}
                type="button"
                disabled={!canToggle}
                onClick={() => toggle(d)}
                aria-label={canToggle ? `${label}. Changer le mode.` : label}
                className={cn(
                  "flex min-h-[4.2em] flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 text-center text-2xs transition-colors",
                  m.cls,
                  d.date === today && "ring-2 ring-focus ring-offset-1",
                  canToggle ? "cursor-pointer hover:border-primary" : "cursor-default",
                  d.presence === "OFF" && "opacity-60",
                )}
              >
                <span className="font-medium capitalize">{fmtWeekday(d.date)}</span>
                <span className="tabular-nums text-text-muted">{fmtDateShort(d.date)}</span>
                <m.Icon className="size-3.5" aria-hidden />
                <span className="flex items-center gap-0.5 font-medium">{m.short}{d.override && <Check className="size-2.5" aria-label="exception" />}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
