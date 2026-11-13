/* Audit log (spec 6 AuditLog, 8.16). Append-only: nothing in the code base ever removes or edits a row. */
import type { AppState, AuditLog } from "../store/types";
import { nextId } from "./ids";
import { invalidate } from "./memo";

export interface AuditInput {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  label?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
}

/** Keep only fields that changed (both sides), so the diff view is readable. */
export function diffFields(before: Record<string, unknown> | undefined, after: Record<string, unknown> | undefined) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const k of keys) {
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) {
      if (before && k in before) b[k] = before[k];
      if (after && k in after) a[k] = after[k];
    }
  }
  return { before: Object.keys(b).length ? b : undefined, after: Object.keys(a).length ? a : undefined };
}

export function writeAudit(state: Pick<AppState, "audit" | "auditSeq" | "now" | "idSeq">, input: AuditInput): AuditLog {
  const { before, after } = input.before || input.after ? diffFields(input.before, input.after) : { before: undefined, after: undefined };
  const row: AuditLog = {
    id: nextId(state, "au"),
    ts: state.now,
    seq: ++state.auditSeq,
    actorId: input.actorId,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId,
    label: input.label,
    before,
    after,
    reason: input.reason,
  };
  state.audit.unshift(row);
  invalidate(state); // every audited write mutates the plan: cached derived data is stale
  return row;
}
