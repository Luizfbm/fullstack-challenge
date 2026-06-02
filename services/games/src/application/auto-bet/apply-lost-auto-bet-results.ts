import type { Bet } from "../../domain/bet";
import type { ApplyAutoBetResultUseCase } from "../use-cases/apply-auto-bet-result.use-case";

export async function applyLostAutoBetResults(
  applyAutoBetResultUseCase: Pick<ApplyAutoBetResultUseCase, "execute"> | undefined,
  bets: Bet[],
): Promise<void> {
  for (const bet of bets) {
    if (bet.status !== "LOST") {
      continue;
    }

    await applyAutoBetResultUseCase?.execute({
      betId: bet.id,
      amountCents: bet.amountCents,
      payoutCents: null,
      resultStatus: "LOST",
    });
  }
}
