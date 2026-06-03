import { Coins, Repeat } from "lucide-react";
import { cn } from "../../lib/utils";

export type BetMode = "manual" | "auto";

type BetModeToggleProps = {
  disabled?: boolean;
  onChange: (mode: BetMode) => void;
  value: BetMode;
};

export function BetModeToggle({
  disabled = false,
  onChange,
  value,
}: BetModeToggleProps) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 rounded-md border border-white/10 bg-black/35 p-1.5">
      <ModeButton
        disabled={disabled}
        icon={Coins}
        label="Manual"
        onClick={() => onChange("manual")}
        selected={value === "manual"}
      />
      <ModeButton
        disabled={disabled}
        icon={Repeat}
        label="Auto"
        onClick={() => onChange("auto")}
        selected={value === "auto"}
      />
    </div>
  );
}

type ModeButtonProps = {
  disabled: boolean;
  icon: typeof Coins;
  label: string;
  onClick: () => void;
  selected: boolean;
};

function ModeButton({
  disabled,
  icon: Icon,
  label,
  onClick,
  selected,
}: ModeButtonProps) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "flex h-9 min-w-0 items-center justify-center gap-2 rounded-md px-2 text-sm font-semibold whitespace-nowrap transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border border-cyan-200/40 bg-cyan-200/15 text-cyan-100"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </button>
  );
}
