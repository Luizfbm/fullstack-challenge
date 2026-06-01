import { Clock } from "../ports/clock";
import {
  GameRepository,
  LeaderboardEntry,
  LeaderboardPeriod,
} from "../ports/game.repository";

type ListLeaderboardUseCaseInput = {
  period: LeaderboardPeriod;
  limit: number;
};

const PERIOD_MS: Record<LeaderboardPeriod, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export class ListLeaderboardUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute(input: ListLeaderboardUseCaseInput): Promise<LeaderboardEntry[]> {
    const now = this.clock.now();
    const since = new Date(now.getTime() - PERIOD_MS[input.period]);

    return this.gameRepository.listLeaderboard({
      limit: input.limit,
      since,
    });
  }
}
