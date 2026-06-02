import type { AutoBetSessionRepository } from "../ports/auto-bet-session.repository";

type GetMyAutoBetSessionInput = {
  playerId: string;
};

export class GetMyAutoBetSessionUseCase {
  constructor(
    private readonly autoBetSessionRepository: AutoBetSessionRepository,
  ) {}

  async execute(input: GetMyAutoBetSessionInput) {
    return (
      (await this.autoBetSessionRepository.findActiveByPlayer(input.playerId)) ??
      this.autoBetSessionRepository.findLatestByPlayer(input.playerId)
    );
  }
}
