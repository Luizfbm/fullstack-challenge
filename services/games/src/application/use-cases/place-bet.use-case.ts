import { SpanStatusCode, trace } from "@opentelemetry/api";
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
import type { GameMetrics } from "../../infrastructure/observability/game-metrics";

type GameMetricsPort = Pick<
  GameMetrics,
  "recordBetAccepted" | "recordBetRejected"
>;

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

const tracer = trace.getTracer("games");

export class PlaceBetUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly walletClient: WalletClient,
    private readonly idGenerator: IdGenerator,
    private readonly roundEventsPublisher: RoundEventsPublisher,
    private readonly gameMetrics?: GameMetricsPort,
  ) {}

  async execute(input: PlaceBetInput): Promise<PlaceBetResult> {
    return tracer.startActiveSpan("games.place_bet", async (span) => {
      let betWasAccepted = false;

      try {
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
        this.recordBetAccepted(amountCents);
        betWasAccepted = true;
        await this.roundEventsPublisher.publishBetPlaced(bet);

        span.setAttributes({
          "crash.bet.status": "accepted",
          "crash.bet.auto_cashout": autoCashoutMultiplierBp !== null,
        });

        return {
          bet,
          balanceCents: debitResult.balanceCents,
        };
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setStatus({ code: SpanStatusCode.ERROR });

        if (!betWasAccepted) {
          this.recordBetRejected();
        }

        throw error;
      } finally {
        span.end();
      }
    });
  }

  private recordBetAccepted(amountCents: bigint): void {
    try {
      this.gameMetrics?.recordBetAccepted(amountCents);
    } catch {
      // Metrics are best-effort and must not alter bet placement.
    }
  }

  private recordBetRejected(): void {
    try {
      this.gameMetrics?.recordBetRejected();
    } catch {
      // Metrics are best-effort and must not alter bet placement.
    }
  }
}
