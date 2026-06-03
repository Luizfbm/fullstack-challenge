import { Gauge, Sparkles } from "lucide-react";
import { formatCents } from "../../services/money";
import { Button } from "../ui/button";
import { getPrimaryActionLabel } from "./bet-controls-model";
import type { BetMode } from "./bet-mode-toggle";

type BetActionButtonsProps = {
  activeAutoBetSession: boolean;
  betMode: BetMode;
  canCashOut: boolean;
  canPlaceBet: boolean;
  canStartAutoBet: boolean;
  cashOutIsPending: boolean;
  onCashOut: () => void;
  onPlaceBet: () => void;
  onStartAutoBet: () => void;
  onStopAutoBet: () => void;
  placeBetIsPending: boolean;
  potentialPayout: bigint | null;
  startAutoBetIsPending: boolean;
  stopAutoBetIsPending: boolean;
};

export function BetActionButtons({
  activeAutoBetSession,
  betMode,
  canCashOut,
  canPlaceBet,
  canStartAutoBet,
  cashOutIsPending,
  onCashOut,
  onPlaceBet,
  onStartAutoBet,
  onStopAutoBet,
  placeBetIsPending,
  potentialPayout,
  startAutoBetIsPending,
  stopAutoBetIsPending,
}: BetActionButtonsProps) {
  return (
    <div className="mt-3 grid grid-cols-1 gap-2">
      <Button
        className="min-h-11 w-full min-w-0 whitespace-nowrap px-3 leading-none"
        disabled={
          betMode === "auto"
            ? activeAutoBetSession
              ? stopAutoBetIsPending
              : !canStartAutoBet
            : !canPlaceBet
        }
        onClick={() => {
          if (activeAutoBetSession) {
            onStopAutoBet();
            return;
          }

          if (betMode === "auto") {
            onStartAutoBet();
            return;
          }

          onPlaceBet();
        }}
        type="button"
        variant="temporal"
      >
        <Sparkles className="size-4 shrink-0" aria-hidden="true" />
        {getPrimaryActionLabel({
          activeAutoBetSession,
          betMode,
          placeBetIsPending,
          startAutoBetIsPending,
          stopAutoBetIsPending,
        })}
      </Button>
      <Button
        className="min-h-11 w-full min-w-0 whitespace-nowrap px-3 leading-none"
        disabled={!canCashOut}
        onClick={onCashOut}
        type="button"
        variant="cash"
      >
        <Gauge className="size-4 shrink-0" aria-hidden="true" />
        {cashOutIsPending
          ? "Sacando"
          : potentialPayout
            ? `Cash Out ${formatCents(potentialPayout)}`
            : "Cash Out"}
      </Button>
    </div>
  );
}
