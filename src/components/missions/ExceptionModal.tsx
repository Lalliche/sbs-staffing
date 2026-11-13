"use client";
import { OctagonX, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/FormInputs";
import { Callout } from "@/components/ui/Surface";
import { useSession } from "@/lib/store/hooks";
import type { Result } from "@/lib/store/actions/core";

export const MIN_REASON = 10;
export type Failure = Extract<Result<unknown>, { ok: false }>;

/** Exception flow (spec 7.4): the engine says « non » → a habilitated user may authorise with a written justification, logged in the audit. */
export function ExceptionModal({ open, result, onConfirm, onCancel, title = "Conflit détecté par le moteur de staffing" }: { open: boolean; result: Failure | null; onConfirm: (reason: string) => void; onCancel: () => void; title?: string }) {
  const { can } = useSession();
  const [reason, setReason] = useState("");
  const allowed = can("assignment.exception");
  const short = reason.trim().length < MIN_REASON;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="lg"
      title={title}
      subtitle={allowed ? "Vous pouvez autoriser une exception, avec une justification écrite qui sera journalisée." : "Vous ne pouvez pas autoriser d’exception avec votre profil."}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
          {allowed && <Button variant="danger" disabled={short} icon={<ShieldAlert className="size-4" />} onClick={() => { onConfirm(reason.trim()); setReason(""); }}>Autoriser l’exception</Button>}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {result?.conflicts?.filter((c) => c.severity === "ERROR").map((c, i) => (
            <li key={i} className="flex items-start gap-2.5 rounded-md border border-conflict/30 bg-conflict-bg px-3 py-2 text-sm text-conflict"><OctagonX className="mt-0.5 size-4 shrink-0" aria-hidden /><span><span className="font-semibold">Conflit — </span>{c.message}</span></li>
          ))}
          {result?.blocks?.map((b, i) => (
            <li key={`b${i}`} className="flex items-start gap-2.5 rounded-md border border-conflict/30 bg-conflict-bg px-3 py-2 text-sm text-conflict"><OctagonX className="mt-0.5 size-4 shrink-0" aria-hidden /><span><span className="font-semibold">Non compatible — {b.label} : </span>{b.detail}</span></li>
          ))}
          {!result?.conflicts?.length && !result?.blocks?.length && result && <li><Callout tone="danger">{result.error}</Callout></li>}
        </ul>
        {allowed ? (
          <TextArea label="Justification de l’exception" required rows={4} value={reason} onChange={setReason} placeholder="Expliquez pourquoi cette exception est acceptable (≥ 10 caractères)." hint={`${reason.trim().length}/${MIN_REASON} caractères minimum — la justification est enregistrée dans le journal d’audit.`} />
        ) : (
          <Callout tone="neutral">Seul un profil habilité (Resource Manager, administrateur) peut autoriser une exception. Ajustez la période, le pourcentage ou choisissez un autre collaborateur.</Callout>
        )}
      </div>
    </Modal>
  );
}
