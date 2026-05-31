import { beforeEach, describe, expect, it } from "vitest";
import { useGameUiStore } from "./game-ui-store";

describe("useGameUiStore", () => {
  beforeEach(() => {
    useGameUiStore.setState({
      betAmountCents: "1000",
      selectedRoundId: null,
    });
  });

  it("normalizes bet amount as integer cents", () => {
    useGameUiStore.getState().setBetAmountCents("R$ 0012,34");

    expect(useGameUiStore.getState().betAmountCents).toBe("1234");
  });

  it("tracks selected round and resets the bet slip", () => {
    useGameUiStore.getState().selectRound("round-1");
    useGameUiStore.getState().setBetAmountCents("2500");
    useGameUiStore.getState().resetBetSlip();

    expect(useGameUiStore.getState().selectedRoundId).toBe("round-1");
    expect(useGameUiStore.getState().betAmountCents).toBe("1000");
  });
});
