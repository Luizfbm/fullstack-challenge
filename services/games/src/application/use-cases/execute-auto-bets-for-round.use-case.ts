import type { AutoBetSession } from "../auto-bet/auto-bet-session";
import {
  WalletOperationRejectedError,
  WalletOperationTimedOutError,
} from "../game.errors";
import type { AutoBetSessionRepository } from "../ports/auto-bet-session.repository";
import type { IdGenerator } from "../ports/id-generator";
import type { Round } from "../../domain/round";
import type { GameMetrics } from "../../infrastructure/observability/game-metrics";
import type { PlaceBetUseCase } from "./place-bet.use-case";

type GameMetricsPort = Pick<
  GameMetrics,
  | "recordAutoBetFailure"
  | "recordAutoBetPlaced"
  | "recordAutoBetSessionStopped"
>;

type ExecuteAutoBetsForRoundInput = {
  round: Round;
};

export class ExecuteAutoBetsForRoundUseCase {
  constructor(
    private readonly autoBetSessionRepository: AutoBetSessionRepository,
    private readonly placeBetUseCase: Pick<PlaceBetUseCase, "execute">,
    private readonly idGenerator: IdGenerator,
    private readonly gameMetrics?: GameMetricsPort,
  ) {}

  async execute(input: ExecuteAutoBetsForRoundInput): Promise<void> {
    const sessions = await this.autoBetSessionRepository.listActive();

    for (const session of sessions) {
      await this.executeSessionForRound(session, input.round);
    }
  }

  private async executeSessionForRound(
    session: AutoBetSession,
    round: Round,
  ): Promise<void> {
    if (session.startsAfterRoundId === round.id) {
      return;
    }

    const existingExecution =
      await this.autoBetSessionRepository.findExecution(session.id, round.id);

    if (existingExecution) {
      return;
    }

    try {
      const result = await this.placeBetUseCase.execute({
        playerId: session.playerId,
        username: session.username,
        amountCents: session.nextAmountCents,
        autoCashoutMultiplierBp: session.autoCashoutMultiplierBp,
        source: "AUTO_BET",
      });

      await this.autoBetSessionRepository.recordExecution({
        id: this.idGenerator.generate(),
        sessionId: session.id,
        roundId: round.id,
        betId: result.bet.id,
        status: "BET_PLACED",
        reason: null,
      });
      this.recordPlaced();

      const updatedSession =
        await this.autoBetSessionRepository.incrementRoundsPlayed(session.id);

      if (updatedSession.roundsPlayed >= updatedSession.maxRounds) {
        await this.autoBetSessionRepository.stop({
          sessionId: session.id,
          reason: "MAX_ROUNDS_REACHED",
        });
        this.recordStopped("MAX_ROUNDS_REACHED");
      }
    } catch (error) {
      const failureReason = this.failureReason(error);
      await this.autoBetSessionRepository.recordExecution({
        id: this.idGenerator.generate(),
        sessionId: session.id,
        roundId: round.id,
        betId: null,
        status: "FAILED",
        reason: failureReason,
      });
      this.recordFailure(failureReason);
      await this.autoBetSessionRepository.stop({
        sessionId: session.id,
        reason:
          error instanceof WalletOperationRejectedError
            ? "WALLET_REJECTED"
            : "WALLET_UNAVAILABLE",
      });
      this.recordStopped(
        error instanceof WalletOperationRejectedError
          ? "WALLET_REJECTED"
          : "WALLET_UNAVAILABLE",
      );
    }
  }

  private recordPlaced(): void {
    try {
      this.gameMetrics?.recordAutoBetPlaced();
    } catch {
      // Metrics are best-effort and must not alter auto bet behavior.
    }
  }

  private recordFailure(reason: string): void {
    try {
      this.gameMetrics?.recordAutoBetFailure(reason);
    } catch {
      // Metrics are best-effort and must not alter auto bet behavior.
    }
  }

  private recordStopped(reason: string): void {
    try {
      this.gameMetrics?.recordAutoBetSessionStopped(reason);
    } catch {
      // Metrics are best-effort and must not alter auto bet behavior.
    }
  }

  private failureReason(error: unknown): string {
    if (error instanceof WalletOperationRejectedError) {
      return error.code;
    }

    if (error instanceof WalletOperationTimedOutError) {
      return "WALLET_TIMED_OUT";
    }

    return error instanceof Error ? error.message : "AUTO_BET_FAILED";
  }
}
