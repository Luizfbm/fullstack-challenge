import { RotateCcw } from "lucide-react";
import { useBetSlip } from "../../hooks/use-bet-slip";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

export function BetControlsPanel() {
  const { betAmountCents, betAmountLabel, resetBetSlip, setBetAmountCents } =
    useBetSlip();

  return (
    <section className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-100">Aposta</h2>
        <Button
          aria-label="Resetar aposta"
          onClick={resetBetSlip}
          size="icon"
          type="button"
          variant="ghost"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
        </Button>
      </div>

      <label className="block text-xs font-medium text-zinc-500" htmlFor="bet">
        Valor em centavos
      </label>
      <Input
        className="mt-2"
        id="bet"
        inputMode="numeric"
        onChange={(event) => setBetAmountCents(event.target.value)}
        value={betAmountCents}
      />

      <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300">
        {betAmountLabel}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Button disabled type="button">
          Apostar
        </Button>
        <Button disabled type="button" variant="secondary">
          Cash Out
        </Button>
      </div>
    </section>
  );
}
