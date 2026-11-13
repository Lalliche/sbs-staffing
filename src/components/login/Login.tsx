"use client";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLockup } from "@/components/app/Brand";
import { Avatar } from "@/components/ui/Avatar";
import { login } from "@/content/login";
import { site } from "@/content/site";
import { dur, ease } from "@/lib/motion-tokens";
import { useSession } from "@/lib/store/hooks";
import { enterAs, useHydrated } from "@/lib/store/store";
import { PERSONAS } from "@/lib/store/seed/people";
import { ROLE_LABEL } from "@/lib/engine/permissions";
import { LoginBackdrop } from "./LoginBackdrop";

/** Persona entry: the eight demo profiles. No credentials form — the profile IS the sign-in. */
export function Login() {
  const { s } = useSession();
  const hydrated = useHydrated();
  const router = useRouter();
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);

  const enter = (userId: string) => {
    setPicked(userId);
    setTimeout(() => {
      enterAs(userId);
      router.push("/app/accueil");
    }, reduce ? 0 : 280);
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-canvas">
      <LoginBackdrop />
      <div className="relative mx-auto flex min-h-svh w-full max-w-[72em] flex-col px-5 py-8 sm:px-8 lg:py-12">
        <motion.header initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.5em" }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0.24 : 0.38, ease: ease.out }} className="flex items-center justify-between">
          <div className="rounded-lg bg-side px-4 py-3 shadow-sm"><BrandLockup /></div>
          <span className="text-xs text-text-muted">{site.demoNote}</span>
        </motion.header>

        <div className="flex flex-1 flex-col justify-center gap-10 py-12">
          <motion.section initial={reduce ? { opacity: 0 } : { opacity: 0, y: "0.5em" }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0.24 : 0.38, ease: ease.out, delay: 0.04 }} aria-labelledby="login-title" className="max-w-[40em]">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">{login.eyebrow}</p>
            <h1 id="login-title" className="mt-2 font-display text-2xl font-semibold italic text-ink text-balance sm:text-[2.1em] sm:leading-tight">{login.title}</h1>
            <p className="mt-3 text-base text-text-secondary text-pretty">{login.lead}</p>
          </motion.section>

          <section aria-labelledby="personas-title">
            <h2 id="personas-title" className="text-md font-semibold text-ink">{login.personasTitle}</h2>
            <p className="mt-1 max-w-[40em] text-sm text-text-secondary">{login.personasHint}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PERSONAS.map((p, i) => {
                const u = s.users.find((x) => x.id === p.id);
                const e = s.employees.find((x) => x.id === u?.employeeId);
                if (!u) return null;
                return (
                  <motion.li key={p.id} initial={reduce ? false : { opacity: 0, y: "0.75em" }} animate={{ opacity: picked && picked !== p.id ? 0.4 : 1, y: 0 }} transition={{ duration: dur.slow, ease: ease.out, delay: reduce ? 0 : 0.3 + i * 0.06 }}>
                    <button type="button" disabled={!hydrated} onClick={() => enter(p.id)} className="group/card relative flex h-full w-full items-center gap-3 overflow-hidden rounded-lg border border-border bg-bg p-4 text-start shadow-sm transition-[border-color,transform,box-shadow] duration-150 ease-(--ease-out-strong) hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:scale-[0.98] disabled:opacity-60 motion-reduce:hover:translate-y-0">
                      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-primary transition-transform duration-150 ease-(--ease-out-strong) group-hover/card:scale-x-100 group-focus-visible/card:scale-x-100 motion-reduce:transition-none" />
                      <Avatar person={{ firstName: u.firstName, lastName: u.lastName, departmentId: e?.departmentId }} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-semibold text-ink">{p.label}</span>
                        <span className="block truncate text-xs text-text-secondary">{u.firstName} {u.lastName} · {ROLE_LABEL[u.role]}</span>
                        <span className="mt-0.5 block truncate text-xs text-text-muted">{p.hint}</span>
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
    </main>
  );
}
