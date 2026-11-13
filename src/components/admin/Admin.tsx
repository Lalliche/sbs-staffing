"use client";
import { Download, FileJson, Lock, RotateCcw, ShieldCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { act, enterAs, getState, resetDemo, setScenario } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { addHoliday, addReferential, createUser, removeHoliday, removeReferential, resetRolePermissions, saveSettings, setOfficeWeekdays, setRolePermission, setUserRole, setUserStatus, validateSettings } from "@/lib/store/actions/admin";
import { PERMISSIONS, ROLES, ROLE_LABEL, DEFAULT_ROLE_PERMISSIONS } from "@/lib/engine/permissions";
import { candidatePool, rankCandidates, requirementLike } from "@/lib/engine/matching";
import { fmtDate, fmtDateShort } from "@/lib/engine/format";
import { downloadFile, toCsv } from "@/lib/download";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Combobox, DateInput, NumberInput, Slider } from "@/components/ui/Controls";
import { SearchInput, SelectInput, Switch, TextInput } from "@/components/ui/FormInputs";
import { Callout, Card, CardHeader, PageHeader } from "@/components/ui/Surface";
import { Drawer, Modal } from "@/components/ui/Overlay";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useToast } from "@/components/ui/Toast";
import { Guard } from "@/components/app/Guard";
import { PersonCell } from "@/components/shared/PersonCell";
import { DEFAULT_TEMPLATES, NOTIFICATION_KINDS } from "@/lib/store/notification-templates";
import type { AuditLog, Role, Settings, User } from "@/lib/store/types";
import { NOTIFICATION_KIND_LABEL } from "@/lib/store/selectors/notifications";
import { cloneDeep } from "@/lib/utils-clone";

export const Section = ({ perm, children }: { perm: string; children: ReactNode }) => <Guard perm={perm}>{children}</Guard>;

/* ------------------------------ hub ------------------------------ */
export function AdminHub() {
  const { can } = useSession();
  const cards = [
    ["utilisateurs", "Utilisateurs", "Comptes, rôles et activation", "admin.users"], ["roles", "Rôles et permissions", "Matrice éditable en direct", "admin.roles"], ["referentiels", "Référentiels", "Départements, grades, bureaux, jours fériés", "admin.referentials"],
    ["regles", "Règles de staffing", "Pondérations, critères bloquants, seuils, certitude", "admin.settings"], ["audit", "Journal d’audit", "Toutes les écritures sensibles, avant/après", "admin.audit"], ["donnees", "Données", "Export, import, réinitialisation, e-mails simulés", "admin.data"], ["ia", "Intelligence artificielle", "Connexion fournisseur, mode sans IA", "ai.settings"],
  ] as const;
  return (
    <>
      <PageHeader title="Administration et paramètres" description="Utilisateurs, droits, règles de staffing, référentiels et traçabilité." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.filter((c) => can(c[3])).map(([k, t, d]) => <Link key={k} href={`/app/admin/${k}`} className="rounded-lg border border-border bg-bg p-5 transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-sm"><p className="text-md font-semibold text-ink">{t}</p><p className="mt-1 text-sm text-text-secondary">{d}</p></Link>)}</div>
      <Card className="mt-6"><CardHeader title="Aperçus de sécurité" description="Fonctions du produit final, présentées à titre d’aperçu" /><div className="grid gap-3 sm:grid-cols-3">{[["Politique de mot de passe", "12 caractères minimum, renouvellement tous les 180 jours, historique de 5 mots de passe."], ["Verrouillage des connexions", "Après 5 échecs, compte verrouillé 15 minutes et alerte à l’administrateur."], ["Sessions actives", "Liste des sessions par utilisateur, déconnexion à distance, durée maximale de 12 h."]].map(([t, d]) => <div key={t} className="rounded-md border border-dashed border-border-strong p-3"><Badge tone="info" icon>Aperçu</Badge><p className="mt-2 text-sm font-medium text-ink">{t}</p><p className="text-xs text-text-secondary">{d}</p></div>)}</div></Card>
    </>
  );
}

/* ------------------------------ users ------------------------------ */
export function UsersPage() {
  const { s, me } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({ firstName: "", lastName: "", email: "", role: "COLLABORATEUR" as Role, employeeId: "" });
  const cols: Column<User>[] = [
    { key: "n", header: "Utilisateur", required: true, cell: (u) => <PersonCell person={u} sub={u.email} />, sort: (a, b) => a.lastName.localeCompare(b.lastName), csv: (u) => `${u.firstName} ${u.lastName}` },
    { key: "r", header: "Rôle", cell: (u) => <select aria-label={`Rôle de ${u.firstName} ${u.lastName}`} value={u.role} onChange={(e) => { const r = act((d) => setUserRole(d, u.id, e.target.value as Role)); toast({ title: r.ok ? "Rôle modifié" : "Refusé", body: r.ok ? undefined : r.error, tone: r.ok ? "success" : "warning" }); }} className="rounded border border-border-strong bg-bg px-2 py-1 text-sm">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>, csv: (u) => ROLE_LABEL[u.role] },
    { key: "e", header: "Collaborateur lié", cell: (u) => (u.employeeId ? s.employees.find((e) => e.id === u.employeeId)?.matricule : "—"), csv: (u) => u.employeeId ?? "" },
    { key: "l", header: "Dernière connexion", cell: (u) => (u.lastLoginAt ? fmtDate(u.lastLoginAt) : "—"), csv: (u) => u.lastLoginAt ?? "" },
    { key: "st", header: "Statut", cell: (u) => <StatusPill tone={u.status === "ACTIF" ? "ok" : "neutral"} label={u.status === "ACTIF" ? "Actif" : "Désactivé"} />, csv: (u) => u.status },
  ];
  return (
    <Section perm="admin.users">
      <PageHeader breadcrumb={[{ label: "Administration", href: "/app/admin" }, { label: "Utilisateurs" }]} title="Utilisateurs" description="Comptes et rôles. Un compte se désactive, il ne se supprime jamais." actions={<Button icon={<UserPlus className="size-4" />} onClick={() => setOpen(true)}>Nouvel utilisateur</Button>} />
      <DataTable rows={s.users} columns={cols} getId={(u) => u.id} caption="Utilisateurs" exportName="utilisateurs" empty={<p className="p-6 text-center text-sm text-text-muted">Aucun utilisateur.</p>}
        rowActions={(u) => <span className="flex gap-1"><Button size="sm" variant="ghost" disabled={u.id === me?.id} onClick={() => { enterAs(u.id); toast({ title: `Vue en tant que ${u.firstName}` }); }}>Voir en tant que</Button><Button size="sm" variant="ghost" disabled={u.id === me?.id} onClick={() => { const r = act((d) => setUserStatus(d, u.id, u.status === "ACTIF" ? "DESACTIVE" : "ACTIF")); toast({ title: r.ok ? "Statut modifié" : "Refusé", body: r.ok ? undefined : r.error, tone: r.ok ? "success" : "warning" }); }}>{u.status === "ACTIF" ? "Désactiver" : "Réactiver"}</Button></span>} />
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvel utilisateur" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={() => { const r = act((d) => createUser(d, { ...v, employeeId: v.employeeId || null })); toast({ title: r.ok ? "Utilisateur créé" : "Refusé", body: r.ok ? "Journalisé dans l’audit." : r.error, tone: r.ok ? "success" : "warning" }); if (r.ok) setOpen(false); }}>Créer</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2"><TextInput label="Prénom" required value={v.firstName} onChange={(x) => setV({ ...v, firstName: x })} /><TextInput label="Nom" required value={v.lastName} onChange={(x) => setV({ ...v, lastName: x })} /><div className="sm:col-span-2"><TextInput label="E-mail" required type="email" value={v.email} onChange={(x) => setV({ ...v, email: x })} /></div><SelectInput label="Rôle" value={v.role} onChange={(x) => setV({ ...v, role: x as Role })} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} /><Combobox label="Collaborateur lié" value={v.employeeId} onChange={(x) => setV({ ...v, employeeId: x })} options={[{ value: "", label: "Aucun" }, ...s.employees.filter((e) => e.status !== "ARCHIVE").map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))]} /></div>
      </Modal>
    </Section>
  );
}

/* ------------------------------ roles matrix ------------------------------ */
export function RolesPage() {
  const { s, me } = useSession();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<{ role: Role; perm: string } | null>(null);
  const groups = useMemo(() => PERMISSIONS.filter((p) => (p.label + p.key + p.group).toLowerCase().includes(q.toLowerCase())).reduce<Record<string, typeof PERMISSIONS>>((a, p) => ((a[p.group] ??= []).push(p), a), {}), [q]);
  const toggle = (role: Role, perm: string, on: boolean, force = false) => {
    if (!on && perm.startsWith("admin.") && !force) return setConfirm({ role, perm });
    const r = act((d) => setRolePermission(d, role, perm, on));
    toast({ title: r.ok ? `${ROLE_LABEL[role]} : « ${perm} » ${on ? "activée" : "retirée"}` : "Refusé", body: r.ok ? "Effet immédiat : l’interface de ce rôle change tout de suite." : r.error, tone: r.ok ? "success" : "warning" });
  };
  const exportCsv = () => downloadFile("matrice-permissions.csv", toCsv(["Permission", "Libellé", ...ROLES.map((r) => ROLE_LABEL[r])], PERMISSIONS.map((p) => [p.key, p.label, ...ROLES.map((r) => (s.rolePermissions[r].includes(p.key) ? "Oui" : "Non"))])));
  const diff = (r: Role) => s.rolePermissions[r].filter((p) => !DEFAULT_ROLE_PERMISSIONS[r].includes(p)).length + DEFAULT_ROLE_PERMISSIONS[r].filter((p) => !s.rolePermissions[r].includes(p)).length;
  return (
    <Section perm="admin.roles">
      <PageHeader breadcrumb={[{ label: "Administration", href: "/app/admin" }, { label: "Rôles et permissions" }]} title="Rôles et permissions" description="Chaque action est une permission. Un changement s’applique immédiatement : changez de profil avec la barre de démonstration pour le constater." actions={<span className="flex gap-2"><Button variant="secondary" icon={<Download className="size-4" />} onClick={exportCsv}>Exporter (CSV)</Button><Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => { act((d) => resetRolePermissions(d)); toast({ title: "Valeurs par défaut rétablies" }); }}>Tout réinitialiser</Button></span>} />
      <div className="mb-4 flex flex-wrap items-center gap-3"><SearchInput className="w-[22em]" value={q} onChange={setQ} placeholder="Filtrer les permissions…" /><span className="flex flex-wrap gap-2">{ROLES.map((r) => <Badge key={r} tone={diff(r) ? "alert" : "neutral"}>{ROLE_LABEL[r]} · {s.rolePermissions[r].length}{diff(r) ? ` (${diff(r)} écart${diff(r) > 1 ? "s" : ""})` : ""}</Badge>)}</span></div>
      <Card className="!p-0"><div className="scroll-thin max-h-[calc(100svh-18em)] overflow-auto"><table className="w-full min-w-[60em] text-sm"><caption className="sr-only">Matrice des permissions par rôle</caption>
        <thead className="sticky top-0 z-10 bg-paper"><tr><th className="sticky start-0 z-10 bg-paper px-4 py-2.5 text-start font-medium">Permission</th>{ROLES.map((r) => <th key={r} scope="col" className="px-2 text-center text-xs font-medium"><span className="block">{ROLE_LABEL[r]}</span><Button size="sm" variant="ghost" className="mt-0.5 !h-6 !px-1.5 text-2xs" onClick={() => { act((d) => resetRolePermissions(d, r)); toast({ title: `${ROLE_LABEL[r]} : valeurs par défaut` }); }}>Défaut</Button></th>)}</tr></thead>
        <tbody>{Object.entries(groups).map(([g, list]) => <Fragment key={g}>
          <tr className="bg-paper/60"><th colSpan={ROLES.length + 1} className="px-4 py-1.5 text-start text-xs font-semibold uppercase tracking-[0.08em] text-text-secondary">{g}</th></tr>
          {list.map((p) => <tr key={p.key} className="border-t border-line hover:bg-canvas"><th scope="row" className="sticky start-0 z-[1] bg-bg px-4 py-1.5 text-start font-normal"><span className="block text-ink">{p.label}</span><span className="block font-mono text-2xs text-text-muted">{p.key}</span></th>{ROLES.map((r) => { const on = s.rolePermissions[r].includes(p.key); const locked = r === "SUPER_ADMIN" && (p.key === "admin.roles" || p.key === "admin.view"); return <td key={r} className="px-2 text-center"><span className="inline-flex flex-col items-center gap-0.5"><Switch size="sm" checked={on} disabled={locked} onChange={(v) => toggle(r, p.key, v)} label={`${ROLE_LABEL[r]} — ${p.label}`} />{on !== DEFAULT_ROLE_PERMISSIONS[r].includes(p.key) && <span className="text-2xs text-alert">modifié</span>}</span></td>; })}</tr>)}
        </Fragment>)}</tbody></table></div></Card>
      <p className="mt-2 text-xs text-text-muted">Le Super administrateur conserve toujours « admin.roles ». Chaque bascule est journalisée (avant / après).</p>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title="Retirer une permission d’administration ?" subtitle={confirm ? `${ROLE_LABEL[confirm.role]} — ${confirm.perm}` : undefined} footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Annuler</Button><Button variant="danger" onClick={() => { toggle(confirm!.role, confirm!.perm, false, true); setConfirm(null); }}>Retirer</Button></>}>Les utilisateurs de ce rôle perdront immédiatement l’accès correspondant.</Modal>
      <span hidden>{me?.id}</span>
    </Section>
  );
}

/* ------------------------------ rules + live ranking preview ------------------------------ */
export function RulesPage() {
  const { s } = useSession();
  const toast = useToast();
  const [d, setD] = useState<Settings>(() => cloneDeep(s.settings));
  const dirty = JSON.stringify(d) !== JSON.stringify(s.settings);
  const err = validateSettings(d);
  const req = s.requirements.find((r) => r.id === "rq-04-1");
  const proj = s.projects.find((p) => p.id === req?.projectId);
  const draftState = { ...s, settings: d };
  const preview = req && proj ? rankCandidates(draftState, requirementLike(req, proj), { employeeIds: candidatePool(s, { gradeMin: req.gradeMin, projectLeadId: proj.leadId }) }).slice(0, 6) : [];
  const sum = Object.values(d.scoringWeights).reduce((a, b) => a + b, 0);
  const W: [keyof Settings["scoringWeights"], string][] = [["skills", "Compétences"], ["availability", "Disponibilité"], ["sector", "Expérience sectorielle"], ["grade", "Grade"], ["certifications", "Certifications"], ["history", "Historique pertinent"]];
  const set = (p: Partial<Settings>) => setD((x) => ({ ...x, ...p }));
  return (
    <Section perm="admin.settings">
      <PageHeader breadcrumb={[{ label: "Administration", href: "/app/admin" }, { label: "Règles de staffing" }]} title="Règles de staffing" description="Pondérations du score, critères bloquants, seuils et expirations. Le classement de droite se recalcule en direct sur un brouillon ; rien n’est appliqué avant « Enregistrer »." actions={<span className="flex gap-2"><Button variant="secondary" disabled={!dirty} onClick={() => setD(cloneDeep(s.settings))}>Annuler</Button><Button disabled={!dirty || !!err} onClick={() => { const r = act((x) => saveSettings(x, d)); toast({ title: r.ok ? "Règles enregistrées" : "Refusé", body: r.ok ? "Journalisé avec le détail avant / après." : r.error, tone: r.ok ? "success" : "warning" }); }}>Enregistrer</Button></span>} />
      {err && <Callout tone="danger" className="mb-4">{err}</Callout>}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card><CardHeader title="Pondération du score" description={`Somme = ${sum} — le moteur normalise à 100 (comme dans le calcul)`} />
            <div className="flex flex-col gap-4">{W.map(([k, l]) => <Slider key={k} label={l} value={d.scoringWeights[k]} onChange={(n) => set({ scoringWeights: { ...d.scoringWeights, [k]: n } })} format={(n) => `${n} (${sum ? Math.round((n / sum) * 100) : 0} %)`} />)}</div></Card>
          <Card><CardHeader title="Critères bloquants" description="Un candidat bloqué reste listé mais « Non compatible »" />
            <div className="flex flex-col gap-3">{([["missingMandatorySkill", "Compétence obligatoire manquante"], ["gradeBelowMinimum", "Grade inférieur au minimum"], ["unavailable", "Indisponible (congé ou charge)"]] as const).map(([k, l]) => <label key={k} className="flex items-center justify-between text-sm"><span>{l}</span><Switch checked={d.blocking[k]} onChange={(v) => set({ blocking: { ...d.blocking, [k]: v } })} label={l} /></label>)}<Slider label="Seuil d’indisponibilité (disponibilité minimale)" value={Math.round(d.minAvailabilityRatio * 100)} onChange={(n) => set({ minAvailabilityRatio: n / 100 })} format={(n) => `${n} %`} /></div></Card>
          <Card><CardHeader title="Seuils, certitude et délais" />
            <div className="grid gap-4 sm:grid-cols-2"><NumberInput label="Sous-occupation (en dessous de)" suffix="%" min={0} max={100} value={d.thresholds.underUse} onChange={(n) => set({ thresholds: { ...d.thresholds, underUse: n } })} /><NumberInput label="Surcharge (au-dessus de)" suffix="%" min={50} max={200} value={d.thresholds.overload} onChange={(n) => set({ thresholds: { ...d.thresholds, overload: n } })} />
              {(["CONFIRMEE", "PROBABLE", "OPPORTUNITE"] as const).map((c) => <NumberInput key={c} label={`Pondération « ${c === "CONFIRMEE" ? "Confirmée" : c === "PROBABLE" ? "Probable" : "Opportunité"} »`} suffix="%" min={0} max={100} value={d.forecastWeights[c]} onChange={(n) => set({ forecastWeights: { ...d.forecastWeights, [c]: n } })} />)}
              <NumberInput label="Expiration d’une réservation" suffix="j" min={1} max={60} value={d.softBookingExpiryDays} onChange={(n) => set({ softBookingExpiryDays: n })} /><NumberInput label="Maximum quotidien (timesheets)" suffix="h" min={4} max={16} value={d.maxDailyHours} onChange={(n) => set({ maxDailyHours: n })} /><NumberInput label="Maximum hebdomadaire" suffix="h" min={20} max={80} value={d.maxWeeklyHours} onChange={(n) => set({ maxWeeklyHours: n })} /><NumberInput label="Absence longue (conflit de planning)" suffix="j" min={3} max={60} value={d.longAbsenceDays} onChange={(n) => set({ longAbsenceDays: n })} />
              <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2"><span>Inclure les réservations dans les utilisations affichées</span><Switch checked={d.includeSoftInUtilization} onChange={(v) => set({ includeSoftInUtilization: v })} label="Inclure les réservations" /></label></div></Card>
          <Card><CardHeader title="Objectifs d’utilisation" description="Par grade (le seuil de sous-occupation effectif = 75 % de l’objectif, plafonné par le seuil global)" />
            <div className="grid gap-3 sm:grid-cols-5">{s.grades.map((g) => <NumberInput key={g.id} label={g.name} suffix="%" min={0} max={120} value={d.utilizationTargets.byGrade[g.id] ?? 80} onChange={(n) => set({ utilizationTargets: { ...d.utilizationTargets, byGrade: { ...d.utilizationTargets.byGrade, [g.id]: n } } })} />)}</div></Card>
        </div>
        <Card className="h-fit xl:sticky xl:top-2"><CardHeader title="Aperçu du classement" description={proj ? `${proj.name} — 1 Senior, 60 %` : ""} />
          <ol className="flex flex-col gap-2">{preview.map((m, i) => { const e = s.employees.find((x) => x.id === m.employeeId)!; const cur = rankCandidates(s, requirementLike(req!, proj!), { employeeIds: candidatePool(s, { gradeMin: req!.gradeMin, projectLeadId: proj!.leadId }) }); const was = cur.findIndex((x) => x.employeeId === m.employeeId); return (
            <li key={m.employeeId} className={cn("flex items-center gap-3 rounded-md border px-3 py-2", m.compatible ? "border-border" : "border-conflict/40 bg-conflict-bg/40")}><span className="w-5 text-sm font-semibold tabular-nums text-text-muted">{i + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-ink">{e.firstName} {e.lastName}</span><span className="block text-2xs text-text-muted">{m.compatible ? "Compatible" : m.blocking[0]?.label}</span></span>{was !== i && <Badge tone="info" icon>{was < i ? "↓" : "↑"} était {was + 1}</Badge>}<span className="text-lg font-semibold tabular-nums text-ink">{m.score}</span></li>); })}</ol>
          <p className="mt-3 text-xs text-text-muted">Basé sur les {s.employees.length} collaborateurs de la plateforme et les règles en cours de modification.</p></Card>
      </div>
    </Section>
  );
}

/* ------------------------------ audit log ------------------------------ */
export function AuditPage() {
  const { s } = useSession();
  const q = useQueryState();
  const [open, setOpen] = useState<AuditLog | null>(null);
  const text = q.get("q").toLowerCase();
  const rows = s.audit.filter((a) => (!q.get("entity") || a.entity === q.get("entity")) && (!q.get("actor") || a.actorId === q.get("actor")) && (!q.get("action") || a.action.startsWith(q.get("action"))) && (!q.get("from") || a.ts >= q.get("from")) && (!q.get("to") || a.ts <= q.get("to")) && (!text || `${a.action} ${a.label ?? ""} ${a.entityId} ${a.reason ?? ""}`.toLowerCase().includes(text)));
  const actor = (id: string | null) => (id ? (() => { const u = s.users.find((x) => x.id === id); return u ? `${u.firstName} ${u.lastName}` : id; })() : "Système");
  const entities = [...new Set(s.audit.map((a) => a.entity))];
  const cols: Column<AuditLog>[] = [
    { key: "ts", header: "Date", cell: (a) => <span className="tabular-nums">{fmtDateShort(a.ts)}</span>, sort: (a, b) => a.seq - b.seq, csv: (a) => a.ts },
    { key: "actor", header: "Acteur", cell: (a) => actor(a.actorId), csv: (a) => actor(a.actorId) },
    { key: "action", header: "Action", cell: (a) => <span className="font-mono text-xs">{a.action}</span>, csv: (a) => a.action },
    { key: "entity", header: "Entité", cell: (a) => a.entity, hideBelow: "md", csv: (a) => a.entity },
    { key: "label", header: "Libellé", required: true, cell: (a) => <span><span className="text-ink">{a.label ?? a.entityId}</span>{a.reason && <span className="mt-0.5 block rounded bg-alert-bg px-1.5 py-0.5 text-2xs text-alert">Motif : {a.reason}</span>}</span>, csv: (a) => a.label },
    { key: "reason", header: "Motif", cell: (a) => a.reason ?? "", defaultHidden: true, csv: (a) => a.reason },
  ];
  return (
    <Section perm="admin.audit">
      <PageHeader breadcrumb={[{ label: "Administration", href: "/app/admin" }, { label: "Journal d’audit" }]} title="Journal d’audit" description="Affectations, exceptions, validations, changements de rôles, imports. Journal en ajout seul : aucune ligne ne se modifie ni ne se supprime." />
      <DataTable rows={rows} columns={cols} getId={(a) => a.id} caption="Journal d’audit" exportName="journal-audit" pageSize={50} onRowClick={(a) => setOpen(a)} defaultSort={{ key: "ts", dir: "desc" }}
        toolbar={<><SearchInput className="w-[16em]" value={q.get("q")} onChange={(v) => q.set("q", v || null)} placeholder="Rechercher…" /><SelectInput label="" value={q.get("actor")} onChange={(v) => q.set("actor", v || null)} options={[{ value: "", label: "Tous les acteurs" }, ...s.users.map((u) => ({ value: u.id, label: `${u.firstName} ${u.lastName}` }))]} /><SelectInput label="" value={q.get("entity")} onChange={(v) => q.set("entity", v || null)} options={[{ value: "", label: "Toutes les entités" }, ...entities.map((e) => ({ value: e, label: e }))]} /><SelectInput label="" value={q.get("action")} onChange={(v) => q.set("action", v || null)} options={[{ value: "", label: "Toutes les actions" }, ...["assignment.exception", "assignment", "leave", "role", "settings", "timesheet", "request", "import", "employee"].map((a) => ({ value: a, label: a }))]} /><DateInput label="" value={q.get("from")} onChange={(v) => q.set("from", v || null)} className="w-40" /><DateInput label="" value={q.get("to")} onChange={(v) => q.set("to", v || null)} className="w-40" /></>}
        empty={<p className="p-8 text-center text-sm text-text-muted">Aucune ligne pour ces filtres.</p>} />
      <Drawer open={!!open} onClose={() => setOpen(null)} title="Détail de l’événement" subtitle={open ? `${open.action} — ${fmtDate(open.ts)}` : undefined}>
        {open && <div className="flex flex-col gap-4 text-sm"><dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5"><dt className="text-text-muted">Acteur</dt><dd>{actor(open.actorId)}</dd><dt className="text-text-muted">Entité</dt><dd>{open.entity} · <span className="font-mono text-xs">{open.entityId}</span></dd><dt className="text-text-muted">Libellé</dt><dd>{open.label}</dd>{open.reason && <><dt className="text-text-muted">Motif écrit</dt><dd className="rounded bg-alert-bg px-2 py-1 text-alert">{open.reason}</dd></>}</dl>
          <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-xs font-medium text-text-secondary">Avant</p><pre className="overflow-auto rounded-md bg-conflict-bg/50 p-3 text-xs">{open.before ? JSON.stringify(open.before, null, 2) : "—"}</pre></div><div><p className="mb-1 text-xs font-medium text-text-secondary">Après</p><pre className="overflow-auto rounded-md bg-ok-bg/60 p-3 text-xs">{open.after ? JSON.stringify(open.after, null, 2) : "—"}</pre></div></div></div>}
      </Drawer>
    </Section>
  );
}

/* ------------------------------ referentials ------------------------------ */
export function ReferentialsPage() {
  const { s } = useSession();
  const q = useQueryState();
  const toast = useToast();
  const tab = q.get("onglet") || "departements";
  const [name, setName] = useState("");
  const [hd, setHd] = useState({ date: s.now, name: "", office: "" });
  const kinds: Record<string, { kind: "department" | "grade" | "office" | "category" | "certification"; items: { id: string; name: string; sub?: string }[] }> = {
    departements: { kind: "department", items: s.departments.map((d) => ({ id: d.id, name: d.name, sub: d.code })) }, grades: { kind: "grade", items: [...s.grades].sort((a, b) => a.rank - b.rank).map((g) => ({ id: g.id, name: g.name, sub: `rang ${g.rank}` })) }, bureaux: { kind: "office", items: s.offices.map((o) => ({ id: o.id, name: o.name, sub: o.workingWeekdays.length + " j/sem." })) }, categories: { kind: "category", items: s.skillCategories.map((c) => ({ id: c.id, name: c.name })) }, certifications: { kind: "certification", items: s.certifications.map((c) => ({ id: c.id, name: c.name, sub: `${c.validityMonths} mois` })) },
  };
  const cur = kinds[tab];
  const DAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  return (
    <Section perm="admin.referentials">
      <PageHeader breadcrumb={[{ label: "Administration", href: "/app/admin" }, { label: "Référentiels" }]} title="Référentiels" description="Les référentiels s’enrichissent et s’archivent : un élément utilisé ne se supprime pas." />
      <Tabs label="Référentiels" value={tab} onChange={(v) => q.set("onglet", v)} items={[{ value: "departements", label: "Départements" }, { value: "grades", label: "Grades" }, { value: "bureaux", label: "Bureaux" }, { value: "categories", label: "Catégories de compétences" }, { value: "certifications", label: "Certifications" }, { value: "feries", label: "Jours fériés" }]} className="mb-5" />
      {cur ? (
        <Card><div className="mb-4 flex gap-2"><div className="w-72"><TextInput label="" value={name} onChange={setName} placeholder="Nouveau libellé…" /></div><Button onClick={() => { const r = act((d) => addReferential(d, cur.kind, name)); toast({ title: r.ok ? "Ajouté" : "Refusé", body: r.ok ? undefined : r.error, tone: r.ok ? "success" : "warning" }); if (r.ok) setName(""); }}>Ajouter</Button></div>
          <ul>{cur.items.map((i) => <li key={i.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0"><span><span className="font-medium text-ink">{i.name}</span> {i.sub && <span className="ms-2 text-xs text-text-muted">{i.sub}</span>}{cur.kind === "office" && <span className="ms-3 inline-flex gap-1">{DAYS.map((dn, di) => { const o = s.offices.find((x) => x.id === i.id)!; const on = o.workingWeekdays.includes(di); return <button key={dn} type="button" aria-pressed={on} onClick={() => { const r = act((d) => setOfficeWeekdays(d, i.id, on ? o.workingWeekdays.filter((x) => x !== di) : [...o.workingWeekdays, di])); if (!r.ok) toast({ title: "Refusé", body: r.error, tone: "warning" }); }} className={cn("rounded px-1.5 py-0.5 text-2xs", on ? "bg-primary text-white" : "bg-paper text-text-muted")}>{dn}</button>; })}</span>}</span><Button size="sm" variant="ghost" onClick={() => { const r = act((d) => removeReferential(d, cur.kind, i.id)); toast({ title: r.ok ? "Supprimé" : "Impossible", body: r.ok ? undefined : r.error, tone: r.ok ? "success" : "warning" }); }}>Supprimer</Button></li>)}</ul></Card>
      ) : (
        <Card><div className="mb-4 flex flex-wrap items-end gap-3"><DateInput label="Date" value={hd.date} onChange={(v) => setHd({ ...hd, date: v })} /><div className="w-64"><TextInput label="Libellé" value={hd.name} onChange={(v) => setHd({ ...hd, name: v })} /></div><SelectInput label="Bureau" value={hd.office} onChange={(v) => setHd({ ...hd, office: v })} options={[{ value: "", label: "Tous" }, ...s.offices.map((o) => ({ value: o.id, label: o.city }))]} /><Button onClick={() => { const r = act((d) => addHoliday(d, hd.date, hd.name, hd.office || null)); toast({ title: r.ok ? "Jour férié ajouté" : "Refusé", body: r.ok ? "Les capacités sont recalculées." : r.error, tone: r.ok ? "success" : "warning" }); }}>Ajouter</Button></div>
          <ul>{[...s.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => <li key={h.id} className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0"><span><span className="tabular-nums">{fmtDate(h.date)}</span> — {h.name} <span className="text-xs text-text-muted">· {h.officeId ? s.offices.find((o) => o.id === h.officeId)?.city : "tous les bureaux"}</span></span><Button size="sm" variant="ghost" onClick={() => { act((d) => removeHoliday(d, h.id)); toast({ title: "Jour férié retiré" }); }}>Retirer</Button></li>)}</ul></Card>
      )}
    </Section>
  );
}

/* ------------------------------ data + AI settings ------------------------------ */
export function DataPage() {
  const { s } = useSession();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const tables: [string, unknown[], string[]][] = [["collaborateurs", s.employees, ["matricule", "firstName", "lastName", "email", "jobTitle", "gradeId", "departmentId", "contract", "weeklyHours", "status"]], ["missions", s.projects, ["reference", "otp", "name", "departmentId", "startDate", "endDate", "status", "certainty"]], ["affectations", s.assignments, ["employeeId", "projectId", "startDate", "endDate", "allocationPct", "status"]], ["conges", s.leaves, ["employeeId", "type", "startDate", "endDate", "status"]]];
  return (
    <Section perm="admin.data">
      <PageHeader breadcrumb={[{ label: "Administration", href: "/app/admin" }, { label: "Données" }]} title="Données" description="Export, sauvegarde et réinitialisation des données de démonstration." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader title="Exporter" />
          <div className="flex flex-wrap gap-2"><Button variant="secondary" icon={<FileJson className="size-4" />} onClick={() => { const st = getState(); downloadFile("sbs-staffing-sauvegarde.json", JSON.stringify(st, null, 1), "application/json"); toast({ title: "Sauvegarde JSON exportée" }); }}>Sauvegarde complète (JSON)</Button>{tables.map(([n, rows, cols]) => <Button key={n} variant="secondary" icon={<Download className="size-4" />} onClick={() => downloadFile(`${n}.csv`, toCsv(cols, (rows as Record<string, unknown>[]).map((r) => cols.map((c) => r[c] as string))))}>{n}.csv</Button>)}</div>
          <p className="mt-3 text-xs text-text-muted">Les champs sensibles (coûts, tarifs) ne sont pas inclus dans les exports CSV.</p></Card>
        <Card><CardHeader title="Scénarios et réinitialisation" /><div className="flex flex-wrap gap-2">{[1, 2, 3, 4].map((n) => <Button key={n} variant={s.scenario === n ? "primary" : "secondary"} onClick={() => { setScenario(n as 1 | 2 | 3 | 4); toast({ title: `Scénario ${n} chargé` }); }}>Scénario {n}</Button>)}</div><div className="mt-4"><Button variant="danger" icon={<RotateCcw className="size-4" />} onClick={() => setConfirm(true)}>Réinitialiser les données de démonstration</Button></div></Card>
        <Card className="xl:col-span-2"><CardHeader title="E-mails simulés" description="Aucun e-mail réel n’est envoyé : chaque envoi est consigné ici" /><ul className="max-h-72 overflow-auto">{s.emailLog.slice(0, 40).map((m) => <li key={m.id} className="flex justify-between border-b border-line py-1.5 text-sm last:border-0"><span>{m.subject}</span><span className="text-xs text-text-muted">à {s.users.find((u) => u.id === m.toUserId)?.email} · {fmtDateShort(m.ts)}</span></li>)}{s.emailLog.length === 0 && <li className="py-4 text-sm text-text-muted">Aucun e-mail simulé.</li>}</ul></Card>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Réinitialiser la démonstration ?" subtitle={`Le scénario ${s.scenario} sera rechargé`} footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Annuler</Button><Button variant="danger" onClick={() => { resetDemo(); setConfirm(false); toast({ title: "Données réinitialisées" }); }}>Réinitialiser</Button></>}>Tout ce qui a été créé pendant la démonstration sera effacé.</Modal>
    </Section>
  );
}
export function AiSettingsPage() {
  const { s } = useSession();
  const toast = useToast();
  const [provider, setProvider] = useState(s.settings.ai.provider);
  const [key, setKey] = useState("");
  const [on, setOn] = useState(s.settings.ai.enabled);
  const tpls = NOTIFICATION_KINDS.map((kind) => ({ kind, subject: DEFAULT_TEMPLATES[kind].subject }));
  return (
    <Section perm="ai.settings">
      <PageHeader breadcrumb={[{ label: "Administration", href: "/app/admin" }, { label: "Intelligence artificielle" }]} title="Intelligence artificielle" description="SBS Staffing Intelligence fonctionne par requêtes déterministes sur vos données. La connexion à un fournisseur est optionnelle." />
      <Callout tone="success" title="Fonctionne sans IA" className="mb-4">Les fonctions de base (matching, planning, capacité, timesheets) ne dépendent d’aucun service externe. L’assistant répond à partir de calculs sur les données de la plateforme et cite sa source ; il n’affecte jamais personne seul.</Callout>
      <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader title="Connexion au fournisseur" description="Aperçu — aucune clé n’est transmise dans la démonstration" /><div className="flex flex-col gap-3"><SelectInput label="Fournisseur" value={provider} onChange={setProvider} options={[{ value: "", label: "Aucun (mode déterministe)" }, { value: "anthropic", label: "Fournisseur A" }, { value: "other", label: "Fournisseur B" }]} /><TextInput label="Clé d’API" type="password" value={key} onChange={setKey} placeholder={s.settings.ai.apiKeyMasked || "sk-••••••••••••"} hint="Stockée masquée ; jamais affichée ni exportée." /><label className="flex items-center justify-between text-sm"><span>Activer l’enrichissement par modèle de langage</span><Switch checked={on} onChange={setOn} label="Activer" /></label><div className="flex gap-2"><Button onClick={() => { act((d) => { d.settings.ai = { provider, enabled: on, apiKeyMasked: key ? `••••${key.slice(-4)}` : d.settings.ai.apiKeyMasked }; }); setKey(""); toast({ title: "Paramètres enregistrés" }); }}>Enregistrer</Button><Button variant="secondary" onClick={() => toast({ title: "Test de connexion", body: "Aperçu : la démonstration ne contacte aucun service externe.", tone: "info" })}>Tester la connexion</Button></div></div></Card>
      <Card><CardHeader title="Modèles de notification" description="Aperçu — prototype" /><ul className="max-h-80 overflow-auto text-sm">{tpls.map((t) => <li key={t.kind} className="border-b border-line py-2 last:border-0"><p className="font-medium text-ink">{NOTIFICATION_KIND_LABEL[t.kind]}</p><p className="text-xs text-text-secondary">{t.subject}</p></li>)}</ul></Card></div>
      <Lock className="hidden" /><ShieldCheck className="hidden" />
    </Section>
  );
}
