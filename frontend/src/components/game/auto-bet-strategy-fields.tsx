import { Layers2, TrendingUp } from "lucide-react";
import { cn } from "../../lib/utils";
import type { AutoBetStrategy } from "../../services/game-api";
import { AutoBetNumberField } from "./auto-bet-number-field";

type AutoBetStrategyFieldsProps = {
  disabled?: boolean;
  martingaleMaxSteps: string;
  martingaleMultiplier: string;
  onMartingaleMaxStepsChange: (value: string) => void;
  onMartingaleMultiplierChange: (value: string) => void;
  onStrategyChange: (strategy: AutoBetStrategy) => void;
  strategy: AutoBetStrategy;
};

export function AutoBetStrategyFields({
  disabled = false,
  martingaleMaxSteps,
  martingaleMultiplier,
  onMartingaleMaxStepsChange,
  onMartingaleMultiplierChange,
  onStrategyChange,
  strategy,
}: AutoBetStrategyFieldsProps) {
  return (
    <div className="mt-3 rounded-md border border-white/10 bg-black/25 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-md border border-white/10 bg-black/35 p-1">
        <StrategyButton
          disabled={disabled}
          label="Valor fixo"
          onClick={() => onStrategyChange("FIXED")}
          selected={strategy === "FIXED"}
        />
        <StrategyButton
          disabled={disabled}
          label="Martingale"
          onClick={() => onStrategyChange("MARTINGALE")}
          selected={strategy === "MARTINGALE"}
        />
      </div>

      {strategy === "MARTINGALE" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberField
            disabled={disabled}
            icon={TrendingUp}
            id="auto-bet-martingale-multiplier"
            label="Multiplicador Martingale"
            onChange={onMartingaleMultiplierChange}
            value={martingaleMultiplier}
          />
          <NumberField
            disabled={disabled}
            icon={Layers2}
            id="auto-bet-martingale-max-steps"
            label="Passos Martingale"
            onChange={onMartingaleMaxStepsChange}
            value={martingaleMaxSteps}
          />
        </div>
      ) : null}
    </div>
  );
}

type StrategyButtonProps = {
  disabled: boolean;
  label: string;
  onClick: () => void;
  selected: boolean;
};

function StrategyButton({
  disabled,
  label,
  onClick,
  selected,
}: StrategyButtonProps) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "h-9 rounded-md text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200 disabled:cursor-not-allowed disabled:opacity-60",
        selected
          ? "border border-cyan-200/40 bg-cyan-200/15 text-cyan-100"
          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

const NumberField = AutoBetNumberField;
