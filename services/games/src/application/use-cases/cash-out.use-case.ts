import {
  MULTIPLIER_GROWTH_BP_PER_SECOND,
} from "../game.constants";
import {
  CurrentRoundNotFoundError,
  WalletCreditFailedError,
} from "../game.errors";
import { Clock } from "../ports/clock";
import { GameRepository } from "../ports/game.repository";
import { WalletClient } from "../ports/wallet.client";
import { Bet } from "../../domain/bet";
import { InvalidRoundStateError } from "../../domain/game.errors";
import { calculateCurrentMultiplierBp } from "../../domain/multiplier";

type CashOutInput = {
  playerId: string;
};

type CashOutResult = {
  bet: Bet;
  balanceCents: bigint;
};

export class CashOutUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly walletClient: WalletClient,
    private readonly clock: Clock,
  ) {}

  async execute(input: CashOutInput): Promise<CashOutResult> {
    const round = await this.gameRepository.findCurrentRound();

    if (!round) {
      throw new CurrentRoundNotFoundError();
    }

    if (!round.startedAt) {
      throw new InvalidRoundStateError("Running round has no start time");
    }

    const multiplierBp = calculateCurrentMultiplierBp(
      round.startedAt,
      this.clock.now(),
      MULTIPLIER_GROWTH_BP_PER_SECOND,
    );
    const bet = round.cashOut(input.playerId, multiplierBp);
    const payoutCents = bet.payoutCents;

    if (payoutCents === null) {
      throw new InvalidRoundStateError("Cashout payout was not calculated");
    }

    await this.gameRepository.saveRound(round);

    try {
      const creditResult = await this.walletClient.credit({
        playerId: input.playerId,
        amountCents: payoutCents,
        referenceId: `round:${round.id}:player:${input.playerId}:cashout-credit`,
        reason: "CASHOUT_PAYOUT",
      });

      round.completeCashOut(input.playerId);
      await this.gameRepository.saveRound(round);

      return {
        bet,
        balanceCents: creditResult.balanceCents,
      };
    } catch (error) {
      throw new WalletCreditFailedError(error);
    }
  }
}
