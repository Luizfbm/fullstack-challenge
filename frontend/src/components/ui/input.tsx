import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-50 outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-300 focus:shadow-[0_0_24px_rgba(34,211,238,0.16)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
