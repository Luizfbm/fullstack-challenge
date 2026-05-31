import { create } from "zustand";
import { normalizeCentsInput } from "../services/money";

const DEFAULT_BET_AMOUNT_CENTS = "1000";

export type GameUiState = {
  betAmountCents: string;
  selectedRoundId: string | null;
  setBetAmountCents: (value: string) => void;
  selectRound: (roundId: string | null) => void;
  resetBetSlip: () => void;
};

export const useGameUiStore = create<GameUiState>((set) => ({
  betAmountCents: DEFAULT_BET_AMOUNT_CENTS,
  selectedRoundId: null,
  setBetAmountCents: (value) =>
    set({ betAmountCents: normalizeCentsInput(value) }),
  selectRound: (roundId) => set({ selectedRoundId: roundId }),
  resetBetSlip: () => set({ betAmountCents: DEFAULT_BET_AMOUNT_CENTS }),
}));
