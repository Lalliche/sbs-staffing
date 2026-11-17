"use client";
import { Card } from "@/components/ui/Surface";
import { PersonCell } from "@/components/shared/PersonCell";
import { fmtDateShort, fmtWeekday } from "@/lib/engine/format";
import { presenceWeeks } from "@/lib/store/selectors/presence";
import type { AppState, Employee } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { PRESENCE_META } from "./PresenceBadge";

/** Read-only week of presence for a group of people (a mission team). */
export function TeamPresence({ s, people }: { s: AppState; people: Employee[] }) {
  const rows = people.map((e) => ({ e, week: presenceWeeks(s, e, 1)[0] ?? [] }));
  const days = rows[0]?.week ?? [];
  return (
    <Card className="!p-0 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Présence de l’équipe sur la semaine en cours</caption>
        <thead className="bg-paper/60 text-xs text-text-secondary">
          <tr>
            <th className="px-4 py-2 text-start font-medium">Collaborateur</th>
            {days.map((d) => <th key={d.date} className={cn("px-2 py-2 text-center font-medium", d.date === s.now && "text-ink")}><span className="capitalize">{fmtWeekday(d.date)}</span><span className="block text-2xs font-normal text-text-muted">{fmtDateShort(d.date)}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ e, week }) => (
            <tr key={e.id} className="border-t border-line">
              <td className="px-4 py-2"><PersonCell person={e} href={`/app/collaborateurs/${e.id}`} /></td>
              {week.map((d) => {
                const m = PRESENCE_META[d.presence];
                return <td key={d.date} className="px-1 py-1.5 text-center"><span title={m.label} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium", m.cls, d.presence === "OFF" && "opacity-50")}><m.Icon className="size-3" aria-hidden /><span className="sr-only">{m.label}</span><span aria-hidden>{d.presence === "OFF" ? "—" : m.short}</span></span></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
