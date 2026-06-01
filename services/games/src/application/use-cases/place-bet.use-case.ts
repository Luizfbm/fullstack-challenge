import {
  MAX_BET_AMOUNT_CENTS,
  MIN_BET_AMOUNT_CENTS,
} from "../game.constants";
import {
  BetAmountOutOfRangeError,
  CurrentRoundNotFoundError,
} from "../game.errors";
import { parseAutoCashoutMultiplierBp } from "../auto-cashout";
import { toCents } from "../cents";
import { GameRepository } from "../ports/game.repository";
import { IdGenerator } from "../ports/id-generator";
import { RoundEventsPublisher } from "../ports/round-events.publisher";
import { WalletClient } from "../ports/wallet.client";
import { Bet } from "../../domain/bet";

type PlaceBetInput = {
  playerId: string;
  username: string;
  amountCents: bigint | number | string;
  autoCashoutMultiplierBp?: number | null;
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
    private readonly roundEventsPublisher: RoundEventsPublisher,
  ) {}

  async execute(input: PlaceBetInput): Promise<PlaceBetResult> {
    const amountCents = toCents(input.amountCents);

    if (
      amountCents < MIN_BET_AMOUNT_CENTS ||
      amountCents > MAX_BET_AMOUNT_CENTS
    ) {
      throw new BetAmountOutOfRangeError();
    }

    const autoCashoutMultiplierBp = parseAutoCashoutMultiplierBp(
      input.autoCashoutMultiplierBp,
    );

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
      autoCashoutMultiplierBp,
    });
    const debitResult = await this.walletClient.debit({
      playerId: input.playerId,
      amountCents,
      referenceId: `round:${round.id}:player:${input.playerId}:bet-debit`,
      reason: "BET_PLACED",
    });

    await this.gameRepository.saveRound(round);
    await this.roundEventsPublisher.publishBetPlaced(bet);

    return {
      bet,
      balanceCents: debitResult.balanceCents,
    };
  }
}
