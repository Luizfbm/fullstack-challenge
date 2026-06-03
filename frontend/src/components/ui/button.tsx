import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
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
        cash:
          "border border-emerald-300/50 bg-gradient-to-b from-emerald-300 to-green-600 text-zinc-950 shadow-[0_0_34px_rgba(34,197,94,0.32)] hover:from-emerald-200 hover:to-green-500 focus-visible:outline-emerald-200",
        danger:
          "bg-rose-500 text-white hover:bg-rose-400 focus-visible:outline-rose-300",
        ghost:
          "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50 focus-visible:outline-zinc-500",
        neon:
          "border border-amber-200/35 bg-amber-200/10 text-amber-100 shadow-[0_0_24px_rgba(250,204,21,0.14)] hover:border-amber-200/60 hover:bg-amber-200/20 focus-visible:outline-amber-200",
        primary:
          "bg-emerald-400 text-zinc-950 hover:bg-emerald-300 focus-visible:outline-emerald-300",
        secondary:
          "bg-sky-400 text-zinc-950 hover:bg-sky-300 focus-visible:outline-sky-300",
        temporal:
          "border border-amber-200/70 bg-gradient-to-b from-amber-200 to-yellow-500 text-zinc-950 shadow-[0_0_34px_rgba(250,204,21,0.28)] hover:from-amber-100 hover:to-yellow-400 focus-visible:outline-amber-200",
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
