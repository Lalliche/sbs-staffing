"use client";
import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { act } from "@/lib/store/store";
import { markAllRead, markRead } from "@/lib/store/actions/notifications";
import { fmtDateShort, relDays } from "@/lib/engine/format";
import { useSession } from "@/lib/store/hooks";
import { myNotifications, unreadCount } from "@/lib/store/selectors/notifications";
import { IconButton } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";

/** Bell popover (380 px) with deep links (spec 8.12). */
export function NotificationsPopover() {
  const { s, me } = useSession();
  const router = useRouter();
  if (!me) return null;
  const list = myNotifications(s, me.id).slice(0, 8);
  const unread = unreadCount(s, me.id);
  return (
    <Popover
      label="Notifications"
      width="min(380px, 94vw)"
      trigger={({ toggle, ref }) => (
        <span className="relative" data-tour="bell">
          <IconButton ref={ref} label={`Notifications${unread ? ` (${unread} non lues)` : ""}`} onClick={toggle}>
            <Bell className="size-[1.15em]" />
          </IconButton>
          {unread > 0 && <span aria-hidden className="pointer-events-none absolute -end-0.5 -top-0.5 flex min-w-[1.25em] items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold tabular-nums text-white ring-2 ring-bg">{unread}</span>}
        </span>
      )}
    >
      {(close) => (
        <div>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-md font-semibold text-ink">Notifications</p>
            <button type="button" disabled={!unread} onClick={() => act((d) => markAllRead(d))} className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-ink disabled:opacity-40">
              <CheckCheck className="size-3.5" /> Tout marquer comme lu
            </button>
          </div>
          <ul className="max-h-[22em] overflow-y-auto">
            {list.length === 0 && <li className="px-4 py-8 text-center text-sm text-text-muted">Aucune notification.</li>}
            {list.map((n) => (
              <li key={n.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => { act((d) => markRead(d, n.id)); close(); router.push(n.href); }}
                  className={cn("flex w-full gap-3 px-4 py-3 text-start transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:shadow-none", !n.read && "bg-select/50")}
                >
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{n.title}</span>
                    <span className="mt-0.5 block text-xs text-text-secondary">{n.body}</span>
                    <span className="mt-1 block text-2xs text-text-muted">{relDays(n.createdAt, s.now)} · {fmtDateShort(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-border px-4 py-2.5 text-center">
            <Link href="/app/notifications" onClick={close} className="text-sm font-medium text-primary hover:underline">
              Voir toutes les notifications
            </Link>
          </div>
        </div>
      )}
    </Popover>
  );
}
