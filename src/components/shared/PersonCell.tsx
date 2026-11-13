"use client";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

/** Avatar + name (+ optional sub line). Links to the fiche when `href` is given. */
export function PersonCell({ person, sub, href, size = "sm", className }: { person: { firstName: string; lastName: string; departmentId?: string }; sub?: string; href?: string; size?: "xs" | "sm" | "md"; className?: string }) {
  const inner = (
    <>
      <Avatar person={person} size={size} />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-medium text-ink">{person.firstName} {person.lastName}</span>
        {sub && <span className="block truncate text-xs text-text-muted">{sub}</span>}
      </span>
    </>
  );
  const cls = cn("inline-flex min-w-0 items-center gap-2.5", className);
  return href ? <Link href={href} className={cn(cls, "hover:underline")}>{inner}</Link> : <span className={cls}>{inner}</span>;
}
