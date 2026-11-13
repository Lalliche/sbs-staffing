import { cn } from "@/lib/utils";
import { deptColor, initials } from "@/lib/ui-domain";

const sizes = { xs: "size-5 text-[0.6em]", sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-12 text-md", xl: "size-16 text-lg" } as const;
type P = { firstName: string; lastName: string; departmentId?: string };

/** Initials on a tint of the department colour (identity only — never a status). */
export function Avatar({ person, size = "md", className, ring }: { person: P; size?: keyof typeof sizes; className?: string; ring?: boolean }) {
  const c = person.departmentId ? deptColor(person.departmentId) : "var(--color-s7)";
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide", sizes[size], ring && "ring-2 ring-white", className)}
      style={{ background: `color-mix(in srgb, ${c} 16%, white)`, color: `color-mix(in srgb, ${c} 80%, black)` }}
    >
      {initials(person)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = "sm" }: { people: (P & { id: string })[]; max?: number; size?: keyof typeof sizes }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((u, i) => (
        <span key={u.id} className={i ? "-ms-2" : ""}>
          <Avatar person={u} size={size} ring />
        </span>
      ))}
      {rest > 0 && <span className={cn("-ms-2 inline-flex items-center justify-center rounded-full bg-paper-deep font-medium text-text-secondary ring-2 ring-white", sizes[size])}>+{rest}</span>}
    </span>
  );
}
