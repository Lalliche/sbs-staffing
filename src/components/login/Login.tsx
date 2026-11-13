"use client";
import { ArrowRight, Lock } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLockup } from "@/components/app/Brand";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/FormInputs";
import { Callout } from "@/components/ui/Surface";
import { Modal } from "@/components/ui/Overlay";
import { login } from "@/content/login";
import { dur, ease } from "@/lib/motion-tokens";
import { useSession } from "@/lib/store/hooks";
import { enterAs, useHydrated } from "@/lib/store/store";
import { PERSONAS } from "@/lib/store/seed/people";
import { ROLE_LABEL } from "@/lib/engine/permissions";
import { LoginGrid } from "./LoginGrid";
import { site } from "@/content/site";

export function Login() {
  const { s } = useSession();
  const hydrated = useHydrated();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [fails, setFails] = useState(0);
  const [forgot, setForgot] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const enter = (userId: string) => {
    setPicked(userId);
    setTimeout(() => {
      enterAs(userId);
      router.push("/app/accueil");
    }, reduce ? 0 : 280);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = s.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.status === "ACTIF");
    if (!pwd) return setErr(login.errPassword);
    if (!u) {
      setFails((f) => f + 1);
      return setErr(login.errUnknown);
    }
    setErr(null);
    enter(u.id);
  };
  const locked = fails >= 5;

  return (
    <main className="relative min-h-svh overflow-hidden bg-canvas">
      <LoginGrid />
      <div className="relative mx-auto flex min-h-svh w-full max-w-[78em] flex-col px-5 py-8 sm:px-8 lg:py-12">
        <motion.header initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.5em" }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0.24 : 0.38, ease: ease.out }} className="flex items-center justify-between">
          <div className="rounded-lg bg-side px-4 py-3"><BrandLockup /></div>
          <span className="text-xs text-text-muted">{site.demoNote}</span>
        </motion.header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <motion.section initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.5em" }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0.24 : 0.38, ease: ease.out, delay: 0.04 }} aria-labelledby="login-title" className="rounded-2xl border border-border bg-bg/90 p-6 shadow-lg backdrop-blur-sm sm:p-8">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">{login.eyebrow}</p>
            <h1 id="login-title" className="mt-2 font-display text-2xl font-semibold italic text-ink text-balance sm:text-[1.9em] sm:leading-tight">{login.title}</h1>
            <p className="mt-3 max-w-[34em] text-base text-text-secondary text-pretty">{login.lead}</p>
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
              <h2 className="text-md font-semibold text-ink">{login.formTitle}</h2>
              <TextInput label={login.email} type="email" value={email} onChange={setEmail} placeholder="prenom.nom@sbs-demo.example" disabled={locked} />
              <TextInput label={login.password} type="password" value={pwd} onChange={setPwd} disabled={locked} />
              {err && !locked && <Callout tone="danger">{err}</Callout>}
              {locked && <Callout tone="alert" title={login.lockedTitle}>{login.lockedBody}</Callout>}
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setForgot(true)} className="text-sm font-medium text-primary underline-offset-2 hover:underline">{login.forgot}</button>
                <Button type="submit" disabled={locked} icon={<Lock className="size-4" />}>{login.submit}</Button>
              </div>
            </form>
          </motion.section>

          <section aria-labelledby="personas-title">
            <h2 id="personas-title" className="text-md font-semibold text-ink">{login.personasTitle}</h2>
            <p className="mt-1 max-w-[34em] text-sm text-text-secondary">{login.personasHint}</p>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {PERSONAS.map((p, i) => {
                const u = s.users.find((x) => x.id === p.id);
                const e = s.employees.find((x) => x.id === u?.employeeId);
                if (!u) return null;
                return (
                  <motion.li key={p.id} initial={reduce ? false : { opacity: 0, y: "0.75em" }} animate={{ opacity: picked && picked !== p.id ? 0.4 : 1, y: 0 }} transition={{ duration: dur.slow, ease: ease.out, delay: reduce ? 0 : 0.52 + i * 0.07 }}>
                    <button type="button" disabled={!hydrated} onClick={() => enter(p.id)} className="group/card relative flex w-full items-center gap-3 overflow-hidden rounded-lg border border-border bg-bg p-3.5 text-start transition-[border-color,transform,box-shadow] duration-150 ease-(--ease-out-strong) hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:scale-[0.98] disabled:opacity-60 motion-reduce:hover:translate-y-0">
                      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-primary transition-transform duration-150 ease-(--ease-out-strong) group-hover/card:scale-x-100 group-focus-visible/card:scale-x-100 motion-reduce:transition-none" />
                      <Avatar person={{ firstName: u.firstName, lastName: u.lastName, departmentId: e?.departmentId }} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-ink">{p.label}</span>
                        <span className="block truncate text-xs text-text-secondary">{u.firstName} {u.lastName} · {ROLE_LABEL[u.role]}</span>
                        <span className="mt-0.5 block truncate text-xs text-text-muted opacity-80 transition-opacity group-hover/card:opacity-100">{p.hint}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-text-muted transition-transform group-hover/card:translate-x-0.5" />
                    </button>
                  </motion.li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
      <Modal open={forgot} onClose={() => setForgot(false)} title={login.forgotTitle} subtitle="Aperçu du produit final" footer={<Button onClick={() => setForgot(false)}>Compris</Button>}>
        {login.forgotBody}
      </Modal>
    </main>
  );
}
