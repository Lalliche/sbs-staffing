"use client";
import { useMemo } from "react";
import type { Resource } from "../engine/permissions";
import { canDo, myEmployee, sessionUser } from "./selectors/core";
import { useApp } from "./store";

/** Current session: raw state (for selectors), signed-in user, their employee record and a bound `can`. */
export function useSession() {
  const s = useApp();
  return useMemo(() => {
    const me = sessionUser(s);
    return { s, me, emp: myEmployee(s), can: (perm: string, res?: Resource) => canDo(s, perm, res) };
  }, [s]);
}
