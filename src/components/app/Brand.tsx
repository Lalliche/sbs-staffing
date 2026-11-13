import Image from "next/image";
import logoLight from "@/assets/sbs-logo-light.png";
import logoDark from "@/assets/sbs-logo.png";
import { cn } from "@/lib/utils";

/** Monogram « Trame »: three parallel 45° strokes of decreasing length; the longest is the SBS ribbon red (identity zone only). */
export function Monogram({ className, onDark = true, size = "2em" }: { className?: string; onDark?: boolean; size?: string }) {
  const c = onDark ? "var(--color-side-text)" : "var(--color-ink)";
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" strokeWidth={2.5} className={className}>
      <path d="M4 20 20 4" stroke="var(--color-ribbon)" />
      <path d="M4 13 13 4" stroke={c} />
      <path d="M11 20 20 11" stroke={c} />
    </svg>
  );
}

/** Official SBS logo (untouched PNG) + 3px ribbon + product name in Bodoni (design-system §7). */
export function BrandLockup({ onDark = true, className }: { onDark?: boolean; className?: string }) {
  return (
    <div className={cn("inline-flex flex-col items-start", className)}>
      <Image src={onDark ? logoLight : logoDark} alt="SBS" className="h-9 w-auto" sizes="120px" priority />
      <span aria-hidden className="mt-1.5 h-[3px] w-full bg-ribbon" />
      <span className={cn("mt-1 font-display text-xl font-semibold italic leading-none", onDark ? "text-side-text" : "text-ink")}>Staffing</span>
    </div>
  );
}
