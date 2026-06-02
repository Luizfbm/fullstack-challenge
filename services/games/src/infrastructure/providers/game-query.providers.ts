import type { Provider } from "@nestjs/common";
import { CLOCK, type Clock } from "../../application/ports/clock";
import {
  GAME_REPOSITORY,
  type GameRepository,
} from "../../application/ports/game.repository";
import { ListLeaderboardUseCase } from "../../application/use-cases/list-leaderboard.use-case";
import { ListMyBetsUseCase } from "../../application/use-cases/list-my-bets.use-case";
import { ListRoundHistoryUseCase } from "../../application/use-cases/list-round-history.use-case";
import { VerifyRoundUseCase } from "../../application/use-cases/verify-round.use-case";

export const gameQueryProviders: Provider[] = [
  {
    provide: ListRoundHistoryUseCase,
    useFactory: (
      gameRepository: GameRepository,
    ): ListRoundHistoryUseCase => new ListRoundHistoryUseCase(gameRepository),
    inject: [GAME_REPOSITORY],
  },
  {
    provide: VerifyRoundUseCase,
    useFactory: (gameRepository: GameRepository): VerifyRoundUseCase =>
      new VerifyRoundUseCase(gameRepository),
    inject: [GAME_REPOSITORY],
  },
  {
    provide: ListMyBetsUseCase,
    useFactory: (gameRepository: GameRepository): ListMyBetsUseCase =>
      new ListMyBetsUseCase(gameRepository),
    inject: [GAME_REPOSITORY],
  },
  {
    provide: ListLeaderboardUseCase,
    useFactory: (
      gameRepository: GameRepository,
      clock: Clock,
    ): ListLeaderboardUseCase =>
      new ListLeaderboardUseCase(gameRepository, clock),
    inject: [GAME_REPOSITORY, CLOCK],
  },
];
