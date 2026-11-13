"use client";
import { MotionConfig } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { hydrate } from "@/lib/store/store";
import { ToastProvider } from "@/components/ui/Toast";

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    hydrate();
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
