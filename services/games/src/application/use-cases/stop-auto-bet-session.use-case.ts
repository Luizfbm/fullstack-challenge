import type { AutoBetSessionRepository } from "../ports/auto-bet-session.repository";
import type { GameMetrics } from "../../infrastructure/observability/game-metrics";

type GameMetricsPort = Pick<GameMetrics, "recordAutoBetSessionStopped">;

type StopAutoBetSessionInput = {
  playerId: string;
};

export class StopAutoBetSessionUseCase {
  constructor(
    private readonly autoBetSessionRepository: AutoBetSessionRepository,
    private readonly gameMetrics?: GameMetricsPort,
  ) {}

  async execute(input: StopAutoBetSessionInput) {
    const activeSession =
      await this.autoBetSessionRepository.findActiveByPlayer(input.playerId);

    if (!activeSession) {
      return this.autoBetSessionRepository.findLatestByPlayer(input.playerId);
    }

    const session = await this.autoBetSessionRepository.stop({
      sessionId: activeSession.id,
      reason: "MANUAL",
    });

    this.recordStopped("MANUAL");

    return session;
  }

  private recordStopped(reason: string): void {
    try {
      this.gameMetrics?.recordAutoBetSessionStopped(reason);
    } catch {
      // Metrics are best-effort and must not alter auto bet behavior.
    }
  }
}
