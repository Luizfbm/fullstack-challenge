import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    defaultVariants: {
      size: "md",
      variant: "primary",
    },
    variants: {
      size: {
        icon: "size-9",
        md: "h-10 px-4",
        sm: "h-8 px-3",
      },
      variant: {
        danger:
          "bg-rose-500 text-white hover:bg-rose-400 focus-visible:outline-rose-300",
        ghost:
          "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 focus-visible:outline-zinc-500",
        neon:
          "border border-cyan-300/30 bg-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.22)] hover:border-cyan-200/60 hover:bg-cyan-300/20 focus-visible:outline-cyan-200",
        primary:
          "bg-emerald-400 text-zinc-950 hover:bg-emerald-300 focus-visible:outline-emerald-300",
        secondary:
          "bg-sky-400 text-zinc-950 hover:bg-sky-300 focus-visible:outline-sky-300",
        temporal:
          "border border-amber-300/50 bg-gradient-to-b from-amber-300 to-orange-500 text-zinc-950 shadow-[0_0_34px_rgba(245,158,11,0.32)] hover:from-amber-200 hover:to-orange-400 focus-visible:outline-amber-200",
      },
    },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, size, variant, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ className, size, variant }))}
      {...props}
    />
  );
}
