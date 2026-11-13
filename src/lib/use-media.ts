"use client";
import { useSyncExternalStore } from "react";

export function useMedia(query: string, serverFallback = false) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => serverFallback,
  );
}
export const useCanHover = () => useMedia("(hover: hover) and (pointer: fine)");
export const useIsMobile = () => useMedia("(max-width: 849px)");
