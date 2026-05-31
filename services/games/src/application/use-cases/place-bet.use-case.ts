import {
  MAX_BET_AMOUNT_CENTS,
  MIN_BET_AMOUNT_CENTS,
} from "../game.constants";
import {
  BetAmountOutOfRangeError,
  CurrentRoundNotFoundError,
} from "../game.errors";
import { toCents } from "../cents";
import { GameRepository } from "../ports/game.repository";
import { IdGenerator } from "../ports/id-generator";
import { WalletClient } from "../ports/wallet.client";
import { Bet } from "../../domain/bet";

type PlaceBetInput = {
  playerId: string;
  username: string;
  amountCents: bigint | number | string;
};

type PlaceBetResult = {
  bet: Bet;
  balanceCents: bigint;
};

export class PlaceBetUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly walletClient: WalletClient,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(input: PlaceBetInput): Promise<PlaceBetResult> {
    const amountCents = toCents(input.amountCents);

    if (
      amountCents < MIN_BET_AMOUNT_CENTS ||
      amountCents > MAX_BET_AMOUNT_CENTS
    ) {
      throw new BetAmountOutOfRangeError();
    }

    const round = await this.gameRepository.findCurrentRound();

    if (!round) {
      throw new CurrentRoundNotFoundError();
    }

    const betId = this.idGenerator.generate();
    const bet = round.placeBet({
      id: betId,
      playerId: input.playerId,
      username: input.username,
      amountCents,
    });
    const debitResult = await this.walletClient.debit({
      playerId: input.playerId,
      amountCents,
      referenceId: `round:${round.id}:player:${input.playerId}:bet-debit`,
      reason: "BET_PLACED",
    });

    await this.gameRepository.saveRound(round);

    return {
      bet,
      balanceCents: debitResult.balanceCents,
    };
  }
}
