"use client";
import { Archive, Building2, FileUp, Mail, Pencil, Phone, RotateCcw, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { act } from "@/lib/store/store";
import { useSession } from "@/lib/store/hooks";
import { useQueryState } from "@/lib/use-query-state";
import { archiveEmployee, restoreEmployee, addEmployeeDocument } from "@/lib/store/actions/people";
import { employeeCertRows, employeeDocuments, employeeLoadStrip, employeeMissions, ficheAccess, ficheSummary, STATUS_LABEL } from "@/lib/store/selectors/people";
import { isSelfView } from "@/lib/store/selectors/core";
import { employeeSkillRows, levelLabel } from "@/lib/store/selectors/skills";
import { canEditPresence, presenceWeeks } from "@/lib/store/selectors/presence";
import { PresenceBadge } from "@/components/presence/PresenceBadge";
import { PresenceWeek } from "@/components/presence/PresenceWeek";
import { addDays } from "@/lib/engine/dates";
import { fmtDZD, fmtDate, fmtHours, fmtPct, fmtRange, relDays } from "@/lib/engine/format";
import { EmployeeForm } from "./People";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusPill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/FormInputs";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/Surface";
import { Modal } from "@/components/ui/Overlay";
import { Tabs } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/Toast";
import { ShieldAlert } from "lucide-react";

const TABS = [["vue", "Vue générale"], ["pro", "Informations professionnelles"], ["competences", "Compétences"], ["certifications", "Certifications"], ["missions", "Missions actuelles"], ["historique", "Historique des missions"], ["planning", "Planning personnel"], ["presence", "Présence"], ["documents", "Documents"]] as const;
type Tab = (typeof TABS)[number][0];
/** Tab labels when a Collaborateur looks at their own profile. */
const SELF_LABEL: Record<Tab, string> = { vue: "Mon profil", pro: "Mon poste", competences: "Mes compétences", certifications: "Mes certifications", missions: "Mes missions", historique: "Mon historique", planning: "Mon planning", presence: "Ma présence", documents: "Mes documents" };

export function Fiche({ id }: { id: string }) {
  const { s, can, me } = useSession();
  const q = useQueryState();
  const toast = useToast();
  const [edit, setEdit] = useState(false);
  const [archive, setArchive] = useState(false);
  const [reason, setReason] = useState("");
  const acc = ficheAccess(s, id);
  if (acc.kind === "missing") return <EmptyState icon={ShieldAlert} title="Collaborateur introuvable" action={<Button href="/app/collaborateurs" variant="secondary">Retour à l’annuaire</Button>} className="py-20" />;
  if (acc.kind === "forbidden") return <EmptyState icon={ShieldAlert} title="Accès non autorisé (403)" description="Vous n’avez accès qu’à votre propre fiche et à votre périmètre." action={<Button href="/app/accueil" variant="secondary">Retour au tableau de bord</Button>} className="py-20" />;
  const e = acc.emp;
  const tab = (q.get("tab") || "vue") as Tab;
  const sum = ficheSummary(s, id)!;
  const grade = s.grades.find((g) => g.id === e.gradeId)?.name;
  const dept = s.departments.find((d) => d.id === e.departmentId)?.name;
  const skills = employeeSkillRows(s, id);
  const certs = employeeCertRows(s, id);
  const miss = employeeMissions(s, id);
  const pWeeks = presenceWeeks(s, s.employees.find((x) => x.id === id)!, 2);
  const todayP = pWeeks.flat().find((d) => d.date === s.now)?.presence;
  const docs = employeeDocuments(s, id);
  const strip = employeeLoadStrip(s, id, s.now, addDays(s.now, 55));
  const archived = e.status === "ARCHIVE";
  const mgr = s.employees.find((x) => x.id === e.managerId);
  const self = isSelfView(s) && me?.employeeId === id; // a Collaborateur on their own page: « Mon profil », no directory around it

  return (
    <>
      <PageHeader breadcrumb={self ? undefined : [{ label: "Collaborateurs", href: "/app/collaborateurs" }, { label: `${e.firstName} ${e.lastName}` }]} title={self ? "Mon profil" : `${e.firstName} ${e.lastName}`} description={self ? `Bonjour ${e.firstName} — voici votre fiche, vos missions et votre présence.` : `${e.jobTitle} · ${grade} · ${dept}`}
        actions={<span className="flex flex-wrap items-center gap-2"><StatusPill tone={archived ? "neutral" : e.status === "ACTIF" ? "ok" : "alert"} label={STATUS_LABEL[e.status]} />{can("employee.create", { employeeId: id }) && <Button variant="secondary" icon={<Pencil className="size-4" />} onClick={() => setEdit(true)}>Modifier</Button>}{can("employee.archive") && (archived ? <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => { const r = act((d) => restoreEmployee(d, id)); toast({ title: r.ok ? "Collaborateur restauré" : "Refusé", body: r.ok ? undefined : r.error }); }}>Restaurer</Button> : <Button variant="secondary" icon={<Archive className="size-4" />} onClick={() => setArchive(true)}>Archiver</Button>)}</span>} />
      <div className="mb-5 flex items-center gap-4">{!self && <Avatar person={e} size="xl" />}<div className="grid flex-1 gap-3 sm:grid-cols-4">{[["Charge du mois (planifiée)", fmtPct(sum.plannedMonthPct)], ["Charge (8 sem. précédentes)", fmtPct(sum.windowPlannedPct)], ["Disponible (4 sem.)", fmtHours(sum.freeHoursNext4Weeks)], ["Missions en cours", String(sum.currentMissions)]].map(([l, v]) => <Card key={l} className="!p-3"><p className="text-xs text-text-muted">{l}</p><p className="text-lg font-semibold tabular-nums text-ink">{v}</p></Card>)}</div></div>
      <Tabs label={self ? "Sections de mon profil" : "Sections de la fiche"} value={tab} onChange={(v) => q.set("tab", v === "vue" ? null : v)} items={TABS.filter(([k]) => k !== "presence" || pWeeks.length > 0).map(([value, label]) => ({ value, label: self ? SELF_LABEL[value] : label, count: value === "certifications" ? certs.filter((c) => c.state !== "VALID").length || undefined : undefined }))} className="mb-5" />

      {tab === "vue" && self && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-4"><Avatar person={e} size="xl" /><div className="min-w-0"><p className="text-xl font-semibold text-ink">{e.firstName} {e.lastName}</p><p className="text-sm text-text-secondary">{e.jobTitle}</p><p className="mt-1 flex flex-wrap gap-1.5"><Badge>{grade}</Badge><Badge>{dept}</Badge>{todayP && <PresenceBadge presence={todayP} />}</p></div></div>
            <p className="text-sm text-text-secondary">{e.bio}</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="flex items-center gap-1.5 text-text-muted"><Mail className="size-3.5" aria-hidden />E-mail</dt><dd className="min-w-0 truncate">{e.email}</dd>
              <dt className="flex items-center gap-1.5 text-text-muted"><Phone className="size-3.5" aria-hidden />Téléphone</dt><dd>{e.phone || "—"}</dd>
              <dt className="flex items-center gap-1.5 text-text-muted"><Building2 className="size-3.5" aria-hidden />Bureau</dt><dd>{s.offices.find((o) => o.id === e.officeId)?.name ?? "—"}</dd>
              <dt className="flex items-center gap-1.5 text-text-muted"><UserRound className="size-3.5" aria-hidden />Mon manager</dt><dd>{mgr ? `${mgr.firstName} ${mgr.lastName}` : "—"}</dd>
              <dt className="text-text-muted ps-5">Langues</dt><dd>{e.languages.join(", ")}</dd>
              <dt className="text-text-muted ps-5">Secteurs</dt><dd className="flex flex-wrap gap-1">{e.sectors.map((x) => <Badge key={x}>{x}</Badge>)}</dd>
            </dl>
          </Card>
          <div className="flex flex-col gap-4">
            {pWeeks.length > 0 && <Card><CardHeader title="Ma présence" description="Cliquez sur un jour pour passer de présentiel à à distance" action={<Button size="sm" variant="secondary" onClick={() => q.set("tab", "presence")}>Voir 2 semaines</Button>} /><PresenceWeek employeeId={id} weeks={pWeeks.slice(0, 1)} today={s.now} editable={canEditPresence(s, id)} /></Card>}
            <Card><CardHeader title="Mes missions en cours" action={<Button size="sm" variant="secondary" onClick={() => q.set("tab", "missions")}>Tout voir</Button>} />
              {miss.current.length === 0 ? <p className="text-sm text-text-muted">Aucune mission en cours.</p> : <ul>{miss.current.slice(0, 4).map((m) => <li key={m.assignmentId}><Link href={`/app/missions/${m.projectId}`} className="flex items-center justify-between gap-3 border-b border-line px-1 py-2.5 text-sm last:border-b-0 hover:bg-canvas"><span className="min-w-0"><span className="block truncate font-medium text-ink">{m.name}</span><span className="block text-xs text-text-muted">{m.clientName} · {fmtRange(m.start, m.end)}</span></span><Badge>{m.allocationPct} %</Badge></Link></li>)}</ul>}
            </Card>
            {sum.expiringCerts + sum.expiredCerts > 0 && <Card><CardHeader title="À surveiller" /><ul className="space-y-2 text-sm">{sum.expiringCerts > 0 && <li><StatusPill tone="alert" label={`${sum.expiringCerts} certification(s) expirent sous 30 jours`} /></li>}{sum.expiredCerts > 0 && <li><StatusPill tone="conflict" label={`${sum.expiredCerts} certification(s) expirée(s)`} /></li>}</ul></Card>}
          </div>
        </div>
      )}
      {tab === "vue" && !self && <div className="grid gap-4 xl:grid-cols-2"><Card><CardHeader title="Profil" /><p className="text-sm text-text-secondary">{e.bio}</p><dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm"><dt className="text-text-muted">E-mail</dt><dd>{e.email}</dd><dt className="text-text-muted">Téléphone</dt><dd>{e.phone || "—"}</dd><dt className="text-text-muted">Langues</dt><dd>{e.languages.join(", ")}</dd><dt className="text-text-muted">Aujourd’hui</dt><dd>{todayP ? <PresenceBadge presence={todayP} /> : "—"}</dd><dt className="text-text-muted">Secteurs</dt><dd className="flex flex-wrap gap-1">{e.sectors.map((x) => <Badge key={x}>{x}</Badge>)}</dd></dl></Card><Card><CardHeader title="Alertes" />{sum.expiringCerts + sum.expiredCerts === 0 ? <p className="text-sm text-text-muted">Aucune alerte.</p> : <ul className="space-y-2 text-sm">{sum.expiringCerts > 0 && <li><StatusPill tone="alert" label={`${sum.expiringCerts} certification(s) expirent sous 30 jours`} /></li>}{sum.expiredCerts > 0 && <li><StatusPill tone="conflict" label={`${sum.expiredCerts} certification(s) expirée(s)`} /></li>}</ul>}</Card></div>}

      {tab === "pro" && <Card><CardHeader title="Informations professionnelles" /><dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm sm:max-w-xl"><dt className="text-text-muted">Matricule</dt><dd className="font-mono">{e.matricule}</dd><dt className="text-text-muted">Poste</dt><dd>{e.jobTitle}</dd><dt className="text-text-muted">Grade</dt><dd>{grade}</dd><dt className="text-text-muted">Département</dt><dd>{dept}</dd><dt className="text-text-muted">Bureau</dt><dd>{s.offices.find((o) => o.id === e.officeId)?.name}</dd><dt className="text-text-muted">Manager</dt><dd>{mgr ? <Link className="hover:underline" href={`/app/collaborateurs/${mgr.id}`}>{mgr.firstName} {mgr.lastName}</Link> : "—"}</dd><dt className="text-text-muted">Contrat</dt><dd>{e.contract}{e.endDate ? ` (jusqu’au ${fmtDate(e.endDate)})` : ""}</dd><dt className="text-text-muted">Heures / semaine</dt><dd>{e.weeklyHours} h{e.weeklyHours < 40 ? " — temps partiel" : ""}</dd><dt className="text-text-muted">Entrée</dt><dd>{fmtDate(e.startDate)}</dd><dt className="text-text-muted">Expérience</dt><dd>{e.yearsExperience} ans</dd>{typeof e.dailyCost === "number" && <><dt className="text-text-muted">Coût journalier</dt><dd>{fmtDZD(e.dailyCost)}</dd></>}{typeof e.dailyRate === "number" && <><dt className="text-text-muted">Tarif journalier</dt><dd>{fmtDZD(e.dailyRate)}</dd></>}</dl>{!("dailyCost" in e) && <p className="mt-4 text-xs text-text-muted">Les coûts et tarifs ne sont pas visibles avec votre profil.</p>}</Card>}

      {tab === "competences" && (
        <Card className="!p-0 overflow-hidden"><table className="w-full text-sm"><caption className="sr-only">Compétences</caption><thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="px-4 py-2 text-start font-medium">Compétence</th><th className="px-3 text-start font-medium">Niveau</th></tr></thead>
          <tbody>{skills.length === 0 && <tr><td colSpan={2}><EmptyState icon={ShieldAlert} title="Aucune compétence déclarée" /></td></tr>}{skills.map((k) => (
            <tr key={k.skillId} className="border-t border-line"><td className="px-4 py-2"><span className="font-medium text-ink">{k.name}</span><span className="block text-xs text-text-muted">{k.categoryName} · niveau attendu {levelLabel(s, k.expectedLevel)}</span></td>
              <td className="px-3"><span className="flex items-center gap-1" aria-label={`Niveau ${k.level} sur 4`}>{[1, 2, 3, 4].map((l) => <span key={l} className={`h-2 w-4 rounded-sm ${l <= k.level ? "bg-primary" : "bg-paper-deep"}`} />)}<span className="ms-2 text-xs">{levelLabel(s, k.level)}</span></span></td></tr>))}</tbody></table></Card>
      )}

      {tab === "certifications" && (certs.length === 0 ? <EmptyState icon={ShieldAlert} title="Aucune certification" /> : <Card className="!p-0 overflow-hidden"><table className="w-full text-sm"><caption className="sr-only">Certifications</caption><thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="px-4 py-2 text-start font-medium">Certification</th><th className="px-3 text-start font-medium">Obtenue</th><th className="px-3 text-start font-medium">Expire</th><th className="px-3 text-start font-medium">État</th></tr></thead><tbody>{certs.map((c) => <tr key={c.certificationId} className="border-t border-line"><td className="px-4 py-2"><span className="font-medium text-ink">{c.name}</span><span className="block text-xs text-text-muted">{c.issuer}</span></td><td className="px-3">{fmtDate(c.obtainedAt)}</td><td className="px-3">{fmtDate(c.expiresAt)}</td><td className="px-3"><StatusPill tone={c.state === "VALID" ? "ok" : c.state === "EXPIRING" ? "alert" : "conflict"} label={c.state === "VALID" ? "Valide" : c.state === "EXPIRING" ? `Expire ${relDays(c.expiresAt, s.now)}` : "Expirée"} /></td></tr>)}</tbody></table></Card>)}

      {(tab === "missions" || tab === "historique") && (() => { const list = tab === "missions" ? miss.current : miss.past; return list.length === 0 ? <EmptyState icon={ShieldAlert} title={tab === "missions" ? "Aucune mission en cours" : "Aucune mission passée"} /> : <Card className="!p-0 overflow-hidden"><table className="w-full text-sm"><caption className="sr-only">Missions</caption><thead className="bg-paper/60 text-xs text-text-secondary"><tr><th className="px-4 py-2 text-start font-medium">Mission</th><th className="px-3 text-start font-medium">Période</th><th className="px-3 text-end font-medium">%</th><th className="px-3 text-end font-medium">Heures</th><th className="px-3 text-start font-medium">Statut</th></tr></thead><tbody>{list.map((m) => <tr key={m.assignmentId} className="border-t border-line"><td className="px-4 py-2"><Link href={`/app/missions/${m.projectId}`} className="font-medium text-ink hover:underline">{m.name}</Link><span className="block text-xs text-text-muted">{m.reference} · {m.clientName}</span></td><td className="px-3">{fmtRange(m.start, m.end)}</td><td className="px-3 text-end tabular-nums">{m.allocationPct}%</td><td className="px-3 text-end tabular-nums">{fmtHours(m.plannedHours)}</td><td className="px-3"><StatusPill tone={m.status === "HARD" ? "ok" : m.status === "SOFT" ? "info" : "neutral"} label={m.status === "HARD" ? "Confirmée" : m.status === "SOFT" ? "Réservation" : "Terminée"} /></td></tr>)}</tbody></table></Card>; })()}

      {tab === "planning" && <Card><CardHeader title="Planning personnel — 8 semaines" description="Charge journalière calculée par le moteur" action={<Button size="sm" variant="secondary" href={`/app/planning?employee=${id}`}>Ouvrir dans le planning</Button>} />
        <div className="flex flex-wrap gap-0.5" role="img" aria-label="Charge par jour">{strip.map((c) => <span key={c.date} title={`${fmtDate(c.date)} — ${c.working ? (c.absent ? "absent(e)" : `${Math.round(c.totalPct)} %`) : "non travaillé"}`} className={`flex h-9 w-5 items-center justify-center rounded-sm text-[0.6em] font-medium tabular-nums ${!c.working ? "bg-[#efece4] bg-[image:var(--hatch-absent)]" : c.absent ? "bg-paper bg-[image:var(--hatch-absent)] ring-1 ring-neutral/40" : c.band === "SURCHARGEE" ? "bg-conflict text-white" : c.band === "PLEINE" ? "bg-av-full text-white" : c.band === "PARTIELLE" ? "bg-av-part text-av-part-text" : "bg-av-free text-av-free-text"}`}>{c.working && !c.absent ? Math.round(c.totalPct) : ""}</span>)}</div>
        <p className="mt-2 text-2xs text-text-muted">Chaque case = un jour (pourcentage de charge). Hachuré : week-end, jour férié ou absence.</p></Card>}

      {tab === "presence" && pWeeks.length > 0 && <Card><CardHeader title={self ? "Ma présence — 2 semaines" : "Présence — 2 semaines"} description={canEditPresence(s, id) ? "Cliquez sur un jour pour passer de présentiel à à distance" : "Présentiel ou à distance, jour par jour"} />
        <PresenceWeek employeeId={id} weeks={pWeeks} today={s.now} editable={canEditPresence(s, id)} />
        <p className="mt-3 text-2xs text-text-muted">Les jours habituels à distance viennent du profil ; une coche indique une exception saisie pour ce jour. Les absences approuvées et les jours non travaillés ne sont pas modifiables.</p></Card>}

      {tab === "documents" && <Card><CardHeader title="Documents" action={can("employee.create", { employeeId: id }) && <Button size="sm" variant="secondary" icon={<FileUp className="size-4" />} onClick={() => { const r = act((d) => addEmployeeDocument(d, id, { name: `Document RH ${docs.length + 1}.pdf`, kind: "Contrat", sizeKb: 140 })); toast({ title: r.ok ? "Document ajouté (simulé)" : "Refusé", body: r.ok ? "Seules les métadonnées sont conservées dans la démonstration." : r.error }); }}>Ajouter</Button>} />{docs.length === 0 ? <p className="text-sm text-text-muted">Aucun document.</p> : <ul>{docs.map((d) => <li key={d.id} className="flex justify-between border-b border-line py-2 text-sm last:border-0"><span className="font-medium text-ink">{d.name}</span><span className="text-xs text-text-muted">{d.kind} · {d.sizeKb} Ko · {fmtDate(d.createdAt)}</span></li>)}</ul>}</Card>}

      {edit && <EmployeeForm id={id} onClose={() => setEdit(false)} onSaved={() => setEdit(false)} />}
      <Modal open={archive} onClose={() => setArchive(false)} title={`Archiver ${e.firstName} ${e.lastName}`} subtitle="Jamais supprimé : l’historique est conservé" footer={<><Button variant="secondary" onClick={() => setArchive(false)}>Annuler</Button><Button variant="danger" disabled={reason.trim().length < 5} onClick={() => { const r = act((d) => archiveEmployee(d, id, reason)); toast({ title: r.ok ? "Collaborateur archivé" : "Refusé", body: r.ok ? `${r.value.openAssignments} affectation(s) ouverte(s) annulée(s).` : r.error, tone: r.ok ? "success" : "warning" }); if (r.ok) setArchive(false); }}>Archiver</Button></>}><TextArea label="Motif" required rows={3} value={reason} onChange={setReason} /></Modal>
    </>
  );
}
