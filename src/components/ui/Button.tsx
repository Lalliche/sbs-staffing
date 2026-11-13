"use client";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { press } from "@/lib/motion-tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium select-none rounded-md " +
  "transition-[background-color,color,border-color,box-shadow,opacity] duration-150 ease-(--ease-out-strong) " +
  "focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-ink",
  secondary: "bg-bg text-text border border-border-strong hover:bg-paper hover:border-primary/50",
  ghost: "text-text-secondary hover:bg-paper hover:text-text",
  danger: "bg-conflict text-white hover:bg-[#7e1631]",
  inverse: "bg-white text-primary hover:bg-paper",
};
const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-base",
  lg: "h-11 px-6 text-md",
};

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", href, loading, icon, iconRight, className, children, disabled, type = "button", ...rest },
  ref,
) {
  const cls = cn(base, variants[variant], sizes[size], className);
  const content = (
    <>
      {loading ? <Loader2 className="size-[1.1em] animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </>
  );
  if (href) {
    const external = /^(https?:|mailto:)/.test(href);
    const hash = href.startsWith("#");
    const Comp = external || hash ? "a" : Link;
    return (
      <Comp href={href} className={cls} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
        {content}
      </Comp>
    );
  }
  return (
    <motion.button ref={ref} type={type} disabled={disabled || loading} className={cls} {...press} {...rest}>
      {content}
    </motion.button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: "sm" | "md"; active?: boolean }>(function IconButton(
  { label, size = "md", active, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-md text-text-secondary transition-[background-color,color,transform] duration-150 ease-(--ease-out-strong)",
        "hover:bg-paper hover:text-text active:scale-95 focus-visible:outline-none disabled:opacity-40",
        size === "sm" ? "size-7" : "size-9",
        active && "bg-paper text-text",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
