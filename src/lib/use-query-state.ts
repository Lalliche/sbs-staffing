"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

/** Filter state lives in the URL (spec 5.5). */
export function useQueryState() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const get = (k: string) => params.get(k) ?? "";
  const setMany = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
      const qs = next.toString();
      router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    },
    [params, router, path],
  );
  return { get, set: (k: string, v: string | null) => setMany({ [k]: v }), setMany, params };
}
