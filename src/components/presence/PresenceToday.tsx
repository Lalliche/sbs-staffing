"use client";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/Surface";
import { fmtDate } from "@/lib/engine/format";
import type { PresenceCount } from "@/lib/engine/workmode";
import { PRESENCE_META } from "./PresenceBadge";

/** « Aujourd'hui » card: who is on site, remote or absent. Figures come from the presence selector — nothing is computed here. */
export function PresenceToday({ summary, now, title = "Présence aujourd’hui", href = "/app/collaborateurs" }: { summary: PresenceCount & { total: number; allowed: boolean }; now: string; title?: string; href?: string }) {
  if (!summary.allowed) return null;
  const rows: { key: "ONSITE" | "REMOTE" | "ABSENT"; n: number; q: string }[] = [
    { key: "ONSITE", n: summary.onsite, q: "ONSITE" },
    { key: "REMOTE", n: summary.remote, q: "REMOTE" },
    { key: "ABSENT", n: summary.absent, q: "ABSENT" },
  ];
  const working = Math.max(1, summary.onsite + summary.remote + summary.absent);
  return (
    <Card>
      <CardHeader title={title} description={fmtDate(now)} />
      <div className="flex h-2 overflow-hidden rounded-full bg-paper" role="img" aria-label={`Sur site ${summary.onsite}, à distance ${summary.remote}, absents ${summary.absent}`}>
        <span className="bg-primary" style={{ width: `${(summary.onsite / working) * 100}%` }} />
        <span className="bg-ramp-5" style={{ width: `${(summary.remote / working) * 100}%` }} />
        <span className="bg-border-strong/50" style={{ width: `${(summary.absent / working) * 100}%` }} />
      </div>
      <ul className="mt-3">
        {rows.map(({ key, n, q }) => {
          const m = PRESENCE_META[key];
          return (
            <li key={key}>
              <Link href={`${href}?presence=${q}`} className="flex items-center justify-between gap-3 border-b border-line px-1 py-2 text-sm last:border-b-0 hover:bg-canvas">
                <span className="flex items-center gap-2 text-text-secondary"><m.Icon className="size-4" aria-hidden />{m.label}</span>
                <span className="font-semibold tabular-nums text-ink">{n}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {summary.off > 0 && <p className="mt-2 text-2xs text-text-muted">{summary.off} personne(s) ne travaillent pas ce jour.</p>}
    </Card>
  );
}
