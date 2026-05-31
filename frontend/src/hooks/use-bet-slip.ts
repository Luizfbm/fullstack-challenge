import { formatCents } from "../services/money";
import { useGameUiStore } from "../stores/game-ui-store";

export function useBetSlip() {
  const betAmountCents = useGameUiStore((state) => state.betAmountCents);
  const setBetAmountCents = useGameUiStore(
    (state) => state.setBetAmountCents,
  );
  const resetBetSlip = useGameUiStore((state) => state.resetBetSlip);

  return {
    betAmountCents,
    betAmountLabel: formatCents(betAmountCents),
    resetBetSlip,
    setBetAmountCents,
  };
}
