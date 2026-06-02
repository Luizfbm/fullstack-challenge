import { SpanStatusCode, trace } from "@opentelemetry/api";
import {
  MAX_BET_AMOUNT_CENTS,
  MIN_BET_AMOUNT_CENTS,
} from "../game.constants";
import {
  BetAmountOutOfRangeError,
  CurrentRoundNotFoundError,
  ManualBetBlockedByAutoBetError,
  WalletOperationRejectedError,
} from "../game.errors";
import { parseAutoCashoutMultiplierBp } from "../auto-cashout";
import { toCents } from "../cents";
import { GameRepository } from "../ports/game.repository";
import { IdGenerator } from "../ports/id-generator";
import { RoundEventsPublisher } from "../ports/round-events.publisher";
import { WalletClient } from "../ports/wallet.client";
import type { AutoBetSessionRepository } from "../ports/auto-bet-session.repository";
import type { WalletOutboxRepository } from "../ports/wallet-outbox.repository";
import { Bet } from "../../domain/bet";
import type { WalletOutboxDispatcher } from "../../infrastructure/messaging/wallet-outbox-dispatcher";
import type { GameMetrics } from "../../infrastructure/observability/game-metrics";

type GameMetricsPort = Pick<
  GameMetrics,
  "recordBetAccepted" | "recordBetRejected"
>;

export type PlaceBetSource = "MANUAL" | "AUTO_BET";

type PlaceBetInput = {
  playerId: string;
  username: string;
  amountCents: bigint | number | string;
  autoCashoutMultiplierBp?: number | null;
  source?: PlaceBetSource;
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
    private readonly walletOutboxRepository?: WalletOutboxRepository,
    private readonly walletOutboxDispatcher?: Pick<
      WalletOutboxDispatcher,
      "dispatchMessage"
    >,
    private readonly autoBetSessionRepository?: Pick<
      AutoBetSessionRepository,
      "findActiveByPlayer"
    >,
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

        if ((input.source ?? "MANUAL") === "MANUAL") {
          const activeAutoBetSession =
            await this.autoBetSessionRepository?.findActiveByPlayer(
              input.playerId,
            );

          if (activeAutoBetSession) {
            throw new ManualBetBlockedByAutoBetError();
          }
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
          autoCashoutMultiplierBp,
        });
        const debitInput = {
          playerId: input.playerId,
          amountCents,
          referenceId: `round:${round.id}:player:${input.playerId}:bet-debit`,
          reason: "BET_PLACED" as const,
        };
        const debitResult =
          this.walletOutboxRepository && this.walletOutboxDispatcher
            ? await this.dispatchDebitThroughOutbox({
                roundId: round.id,
                betId,
                username: input.username,
                ...debitInput,
              })
            : await this.walletClient.debit(debitInput);

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

  private async dispatchDebitThroughOutbox(input: {
    amountCents: bigint;
    betId: string;
    playerId: string;
    reason: "BET_PLACED";
    referenceId: string;
    roundId: string;
    username: string;
  }): Promise<{ applied: boolean; balanceCents: bigint }> {
    if (!this.walletOutboxRepository || !this.walletOutboxDispatcher) {
      throw new Error("Wallet outbox dependencies are not configured");
    }

    const message = await this.walletOutboxRepository.enqueue({
      id: this.idGenerator.generate(),
      type: "WALLET_DEBIT",
      status: "IN_FLIGHT",
      roundId: input.roundId,
      betId: input.betId,
      playerId: input.playerId,
      username: input.username,
      amountCents: input.amountCents,
      referenceId: input.referenceId,
      reason: input.reason,
    });

    await this.walletOutboxDispatcher.dispatchMessage(message);

    const stored = await this.walletOutboxRepository.findById(message.id);

    if (stored?.status !== "SUCCEEDED" || stored.responseBalanceCents === null) {
      throw new WalletOperationRejectedError(
        stored?.errorCode ?? "WALLET_DEBIT_FAILED",
        stored?.errorMessage ?? "Wallet debit failed",
      );
    }

    return {
      applied: stored.responseApplied ?? true,
      balanceCents: stored.responseBalanceCents,
    };
  }
}
