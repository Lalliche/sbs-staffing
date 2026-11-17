/* Work-mode actions (présentiel / à distance). Every write checks can(), mutates the draft and writes an AuditLog row. */
import { calendarOf, isWorkingDay } from "../../engine/capacity";
import { isValidDate } from "../../engine/dates";
import { fmtDate } from "../../engine/format";
import { nextId } from "../../engine/ids";
import { invalidate } from "../../engine/memo";
import { plannedModeOn } from "../../engine/workmode";
import type { AppState, ISODate, WorkMode } from "../types";
import { audit, deny, empName, fail, notify, ok, userOfEmployee, type Result } from "./core";

const MAX_DAYS = 62;
const DAY_NAMES = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MODE_LABEL: Record<WorkMode, string> = { ONSITE: "présentiel", REMOTE: "à distance" };

/** Set the mode of one person on one or several days. Non-working days are ignored; setting the usual mode clears the override. */
export function setWorkMode(s: AppState, input: { employeeId: string; dates: ISODate[]; mode: WorkMode }): Result<{ changed: number }> {
  const emp = s.employees.find((e) => e.id === input.employeeId);
  if (!emp) return fail("NOT_FOUND", "Collaborateur introuvable.");
  const gate = deny(s, "workmode.edit", { employeeId: emp.id });
  if (gate) return gate;
  if (emp.status === "ARCHIVE") return fail("INVALID", "Ce collaborateur est archivé.");
  if (input.mode !== "ONSITE" && input.mode !== "REMOTE") return fail("INVALID", "Mode de présence inconnu.");
  const dates = [...new Set(input.dates)].filter(isValidDate).sort();
  if (!dates.length) return fail("INVALID", "Choisissez au moins un jour.");
  if (dates.length > MAX_DAYS) return fail("INVALID", `Au plus ${MAX_DAYS} jours à la fois.`);
  const cal = calendarOf(s, emp);
  const days = dates.filter((d) => isWorkingDay(emp, cal, d));
  if (!days.length) return fail("INVALID", "Aucun jour travaillé dans la sélection (week-end, jour férié ou hors contrat).");

  const before = days.map((d) => `${fmtDate(d)} : ${MODE_LABEL[plannedModeOn(s, emp, d)]}`).join(" · ");
  let changed = 0;
  for (const d of days) {
    const current = plannedModeOn(s, emp, d);
    s.workModes = s.workModes.filter((w) => !(w.employeeId === emp.id && w.date === d));
    invalidate(s);
    const usual = plannedModeOn(s, emp, d); // pattern without override
    if (input.mode !== usual) s.workModes.push({ id: nextId(s, "wm"), employeeId: emp.id, date: d, mode: input.mode, setById: s.session.userId ?? undefined });
    if (current !== input.mode) changed++;
    invalidate(s);
  }
  audit(s, {
    action: "workmode.set",
    entity: "Présence",
    entityId: emp.id,
    label: `${empName(s, emp.id)} — ${MODE_LABEL[input.mode]} (${days.length} jour${days.length > 1 ? "s" : ""})`,
    before: { Jours: before },
    after: { Mode: MODE_LABEL[input.mode], Jours: days.map(fmtDate).join(", ") },
  });
  const target = userOfEmployee(s, emp.id);
  notify(s, target?.id, "SYSTEM", "Votre mode de présence a été mis à jour", `${MODE_LABEL[input.mode][0].toUpperCase()}${MODE_LABEL[input.mode].slice(1)} — ${days.map(fmtDate).join(", ")}.`, `/app/collaborateurs/${emp.id}`);
  return ok({ changed });
}

/** Change the usual pattern: the weekdays (0 = Sunday … 6 = Saturday) a person works remotely by default. */
export function setUsualRemoteDays(s: AppState, input: { employeeId: string; weekdays: number[] }): Result<void> {
  const emp = s.employees.find((e) => e.id === input.employeeId);
  if (!emp) return fail("NOT_FOUND", "Collaborateur introuvable.");
  const gate = deny(s, "workmode.edit", { employeeId: emp.id });
  if (gate) return gate;
  const cal = calendarOf(s, emp);
  const weekdays = [...new Set(input.weekdays)].filter((d) => Number.isInteger(d) && cal.workingWeekdays.includes(d)).sort((a, b) => a - b);
  if (weekdays.length >= cal.workingWeekdays.length && cal.workingWeekdays.length > 0) return fail("INVALID", "Gardez au moins un jour en présentiel.");
  const before = emp.remoteWeekdays ?? [];
  emp.remoteWeekdays = weekdays;
  invalidate(s);
  audit(s, {
    action: "workmode.pattern",
    entity: "Présence",
    entityId: emp.id,
    label: `${empName(s, emp.id)} — jours habituels à distance`,
    before: { Jours: before.map((d) => DAY_NAMES[d]).join(", ") || "aucun" },
    after: { Jours: weekdays.map((d) => DAY_NAMES[d]).join(", ") || "aucun" },
  });
  return ok(undefined);
}
