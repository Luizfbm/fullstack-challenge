import type { AutoBetSessionRepository } from "../ports/auto-bet-session.repository";

type StopAutoBetSessionInput = {
  playerId: string;
};

export class StopAutoBetSessionUseCase {
  constructor(
    private readonly autoBetSessionRepository: AutoBetSessionRepository,
  ) {}

  async execute(input: StopAutoBetSessionInput) {
    const activeSession =
      await this.autoBetSessionRepository.findActiveByPlayer(input.playerId);

    if (!activeSession) {
      return this.autoBetSessionRepository.findLatestByPlayer(input.playerId);
    }

    return this.autoBetSessionRepository.stop({
      sessionId: activeSession.id,
      reason: "MANUAL",
    });
  }
}
