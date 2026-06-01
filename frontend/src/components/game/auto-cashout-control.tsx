import { cn } from "../../lib/utils";
import type { AutoCashoutParseResult } from "../../services/auto-cashout";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const AUTO_CASHOUT_PRESETS = ["1.50", "2.00", "3.00"];

type AutoCashoutControlProps = {
  enabled: boolean;
  parseResult: AutoCashoutParseResult;
  target: string;
  onEnabledChange: (enabled: boolean) => void;
  onTargetChange: (target: string) => void;
};

export function AutoCashoutControl({
  enabled,
  parseResult,
  target,
  onEnabledChange,
  onTargetChange,
}: AutoCashoutControlProps) {
  return (
    <div className="mt-3 rounded-md border border-cyan-300/15 bg-cyan-300/10 p-3">
      <button
        aria-pressed={enabled}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-3 text-left text-sm font-semibold transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200",
          enabled ? "text-cyan-100" : "text-zinc-300",
        )}
        onClick={() => onEnabledChange(!enabled)}
        type="button"
      >
        <span>Auto cashout</span>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-mono text-xs",
            enabled
              ? "border-cyan-200/50 bg-cyan-200/15 text-cyan-100"
              : "border-white/10 bg-black/35 text-zinc-500",
          )}
        >
          {enabled ? "ON" : "OFF"}
        </span>
      </button>
      <p className="mt-1 text-xs text-zinc-500">Limite: 1.01x a 1000.00x</p>

      {enabled ? (
        <div className="mt-3 space-y-3">
          <label
            className="block text-xs font-medium text-zinc-400"
            htmlFor="auto-cashout-target"
          >
            Multiplicador alvo
          </label>
          <Input
            className="h-10 border-cyan-300/25 bg-black/45 font-mono"
            id="auto-cashout-target"
            inputMode="decimal"
            onChange={(event) => onTargetChange(event.target.value)}
            value={target}
          />
          <div className="grid grid-cols-3 gap-2">
            {AUTO_CASHOUT_PRESETS.map((preset) => (
              <Button
                className="px-2 font-mono text-xs"
                key={preset}
                onClick={() => onTargetChange(preset)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {preset}x
              </Button>
            ))}
          </div>
          {!parseResult.valid ? (
            <p className="text-xs text-rose-200">
              Escolha um alvo entre 1.01x e 1000.00x.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
