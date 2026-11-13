"use client";
import { Bell, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { markAllRead, markRead, setNotificationPref } from "@/lib/store/actions/notifications";
import { myNotifications, NOTIFICATION_KIND_LABEL } from "@/lib/store/selectors/notifications";
import { fmtDate, relDays } from "@/lib/engine/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/FormInputs";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/Surface";
import { Tabs } from "@/components/ui/Tabs";
import type { NotificationKind } from "@/lib/store/types";

export function NotificationsPage() {
  const { s, me } = useSession();
  const q = useQueryState();
  const router = useRouter();
  if (!me) return null;
  const all = myNotifications(s, me.id);
  const kinds = [...new Set(all.map((n) => n.kind))];
  const tab = q.get("tab") || "toutes";
  const list = all.filter((n) => (tab === "toutes" ? true : tab === "non-lues" ? !n.read : n.kind === tab));
  const prefs = s.notificationPrefs[me.id] ?? {};
  const mails = s.emailLog.filter((m) => m.toUserId === me.id);
  const KINDS = Object.keys(NOTIFICATION_KIND_LABEL).filter((k) => k !== "SYSTEM") as NotificationKind[];
  return (
    <>
      <PageHeader title="Notifications" description="Demandes, affectations, conflits, congés, timesheets, certifications : historique et préférences." actions={<Button variant="secondary" disabled={!all.some((n) => !n.read)} onClick={() => act((d) => markAllRead(d))}>Tout marquer comme lu</Button>} />
      <Tabs label="Filtrer" value={tab} onChange={(v) => q.set("tab", v === "toutes" ? null : v)} className="mb-4" items={[{ value: "toutes", label: "Toutes", count: all.length }, { value: "non-lues", label: "Non lues", count: all.filter((n) => !n.read).length }, ...kinds.map((k) => ({ value: k, label: NOTIFICATION_KIND_LABEL[k], count: all.filter((n) => n.kind === k).length }))]} />
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card className="!p-0">{list.length === 0 ? <EmptyState icon={Bell} title="Aucune notification" description={tab === "non-lues" ? "Tout est à jour." : "Rien dans cette catégorie."} /> : <ul>{list.map((n) => (
          <li key={n.id} className="flex items-start gap-3 border-b border-line px-4 py-3 last:border-0"><span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent ring-1 ring-border-strong" : "bg-primary")} />
            <button type="button" onClick={() => { act((d) => markRead(d, n.id)); router.push(n.href); }} className="min-w-0 flex-1 text-start"><span className="block text-sm font-medium text-ink">{n.title}</span><span className="block text-xs text-text-secondary">{n.body}</span><span className="mt-1 flex items-center gap-2 text-2xs text-text-muted">{relDays(n.createdAt, s.now)} · {fmtDate(n.createdAt)}<Badge>{NOTIFICATION_KIND_LABEL[n.kind]}</Badge>{n.email && <Badge tone="info" icon>E-mail simulé</Badge>}</span></button>
            <Button size="sm" variant="ghost" onClick={() => act((d) => markRead(d, n.id, !n.read))}>{n.read ? "Marquer non lue" : "Marquer lue"}</Button></li>))}</ul>}</Card>
        <div className="flex flex-col gap-4">
          <Card><CardHeader title="Préférences" description="Dans l’application et par e-mail (simulé)" />
            <table className="w-full text-sm"><caption className="sr-only">Préférences de notification</caption><thead className="text-xs text-text-muted"><tr><th className="py-1 text-start font-medium">Type</th><th className="text-center font-medium">App</th><th className="text-center font-medium">E-mail</th></tr></thead><tbody>{KINDS.map((k) => <tr key={k} className="border-t border-line"><td className="py-1.5">{NOTIFICATION_KIND_LABEL[k]}</td>{(["inApp", "email"] as const).map((ch) => <td key={ch} className="text-center"><Switch size="sm" checked={prefs[k]?.[ch] ?? (ch === "inApp")} onChange={(v) => act((d) => setNotificationPref(d, k, ch, v))} label={`${NOTIFICATION_KIND_LABEL[k]} — ${ch === "inApp" ? "application" : "e-mail"}`} /></td>)}</tr>)}</tbody></table></Card>
          <Card><CardHeader title="Journal des e-mails" description="Envois simulés" />{mails.length === 0 ? <p className="text-sm text-text-muted">Aucun e-mail simulé.</p> : <ul>{mails.slice(0, 8).map((m) => <li key={m.id} className="flex items-start gap-2 border-b border-line py-2 text-sm last:border-0"><Mail className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden /><span>{m.subject}<span className="block text-2xs text-text-muted">à {me.email} · {fmtDate(m.ts)} · E-mail simulé</span></span></li>)}</ul>}</Card>
        </div>
      </div>
    </>
  );
}
