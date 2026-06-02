import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  MULTIPLIER_GROWTH_RATE_BP_PER_SECOND,
} from "../game.constants";
import {
  CurrentRoundNotFoundError,
  WalletCreditFailedError,
} from "../game.errors";
import { Clock } from "../ports/clock";
import { GameRepository } from "../ports/game.repository";
import { RoundEventsPublisher } from "../ports/round-events.publisher";
import { WalletClient } from "../ports/wallet.client";
import { CashoutCreditService } from "../services/cashout-credit.service";
import { Bet } from "../../domain/bet";
import { InvalidRoundStateError } from "../../domain/game.errors";
import { calculateCurrentMultiplierBp } from "../../domain/multiplier";
import type { GameMetrics } from "../../infrastructure/observability/game-metrics";
import type { ApplyAutoBetResultUseCase } from "./apply-auto-bet-result.use-case";

type GameMetricsPort = Pick<GameMetrics, "recordCashout">;

type CashOutInput = {
  playerId: string;
};

type CashOutResult = {
  bet: Bet;
  balanceCents: bigint;
};

const tracer = trace.getTracer("games");

export class CashOutUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly walletClient: WalletClient,
    private readonly clock: Clock,
    private readonly roundEventsPublisher: RoundEventsPublisher,
    private readonly gameMetrics?: GameMetricsPort,
    private readonly cashoutCreditService = new CashoutCreditService(
      gameRepository,
      walletClient,
    ),
    private readonly applyAutoBetResultUseCase?: Pick<
      ApplyAutoBetResultUseCase,
      "execute"
    >,
  ) {}

  async execute(input: CashOutInput): Promise<CashOutResult> {
    return tracer.startActiveSpan("games.cashout", async (span) => {
      try {
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
          MULTIPLIER_GROWTH_RATE_BP_PER_SECOND,
        );
        const bet = round.cashOut(input.playerId, multiplierBp);
        const payoutCents = bet.payoutCents;

        if (payoutCents === null) {
          throw new InvalidRoundStateError("Cashout payout was not calculated");
        }

        try {
          const creditResult = await this.cashoutCreditService.creditCashout(
            round,
            bet,
          );

          round.completeCashOut(input.playerId);
          await this.gameRepository.saveRound(round);
          await this.applyAutoBetResultUseCase?.execute({
            betId: bet.id,
            amountCents: bet.amountCents,
            payoutCents,
            resultStatus: "CASHED_OUT",
          });
          this.recordCashout("manual", payoutCents);
          await this.roundEventsPublisher.publishBetCashedOut(bet);

          span.setAttributes({
            "crash.cashout.mode": "manual",
            "crash.cashout.status": "completed",
          });

          return {
            bet,
            balanceCents: creditResult.balanceCents,
          };
        } catch (error) {
          if (error instanceof WalletCreditFailedError) {
            throw error;
          }

          throw new WalletCreditFailedError(error);
        }
      } catch (error) {
        span.recordException(error instanceof Error ? error : String(error));
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  private recordCashout(mode: "manual" | "auto", payoutCents: bigint): void {
    try {
      this.gameMetrics?.recordCashout(mode, payoutCents);
    } catch {
      // Metrics are best-effort and must not alter cashout behavior.
    }
  }

}
