import type { LucideIcon } from "lucide-react";
import { Input } from "../ui/input";

type AutoBetNumberFieldProps = {
  disabled: boolean;
  icon: LucideIcon;
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export function AutoBetNumberField({
  disabled,
  icon: Icon,
  id,
  label,
  onChange,
  value,
}: AutoBetNumberFieldProps) {
  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-3">
      <label
        className="flex items-center gap-2 text-xs font-medium text-zinc-400"
        htmlFor={id}
      >
        <Icon className="size-3.5 text-cyan-200" aria-hidden="true" />
        {label}
      </label>
      <Input
        className="mt-2 h-10 border-cyan-300/20 bg-black/45 font-mono"
        disabled={disabled}
        id={id}
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
}
