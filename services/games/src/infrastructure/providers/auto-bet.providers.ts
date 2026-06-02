import type { Provider } from "@nestjs/common";
import {
  AUTO_BET_SESSION_REPOSITORY,
  type AutoBetSessionRepository,
} from "../../application/ports/auto-bet-session.repository";
import {
  GAME_REPOSITORY,
  type GameRepository,
} from "../../application/ports/game.repository";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../application/ports/id-generator";
import { ApplyAutoBetResultUseCase } from "../../application/use-cases/apply-auto-bet-result.use-case";
import { ExecuteAutoBetsForRoundUseCase } from "../../application/use-cases/execute-auto-bets-for-round.use-case";
import { GetMyAutoBetSessionUseCase } from "../../application/use-cases/get-my-auto-bet-session.use-case";
import { PlaceBetUseCase } from "../../application/use-cases/place-bet.use-case";
import { StartAutoBetSessionUseCase } from "../../application/use-cases/start-auto-bet-session.use-case";
import { StopAutoBetSessionUseCase } from "../../application/use-cases/stop-auto-bet-session.use-case";
import { GameMetrics } from "../observability/game-metrics";

export const autoBetProviders: Provider[] = [
  {
    provide: StartAutoBetSessionUseCase,
    useFactory: (
      gameRepository: GameRepository,
      autoBetSessionRepository: AutoBetSessionRepository,
      idGenerator: IdGenerator,
      gameMetrics: GameMetrics,
    ): StartAutoBetSessionUseCase =>
      new StartAutoBetSessionUseCase(
        gameRepository,
        autoBetSessionRepository,
        idGenerator,
        gameMetrics,
      ),
    inject: [
      GAME_REPOSITORY,
      AUTO_BET_SESSION_REPOSITORY,
      ID_GENERATOR,
      GameMetrics,
    ],
  },
  {
    provide: GetMyAutoBetSessionUseCase,
    useFactory: (
      autoBetSessionRepository: AutoBetSessionRepository,
    ): GetMyAutoBetSessionUseCase =>
      new GetMyAutoBetSessionUseCase(autoBetSessionRepository),
    inject: [AUTO_BET_SESSION_REPOSITORY],
  },
  {
    provide: StopAutoBetSessionUseCase,
    useFactory: (
      autoBetSessionRepository: AutoBetSessionRepository,
      gameMetrics: GameMetrics,
    ): StopAutoBetSessionUseCase =>
      new StopAutoBetSessionUseCase(autoBetSessionRepository, gameMetrics),
    inject: [AUTO_BET_SESSION_REPOSITORY, GameMetrics],
  },
  {
    provide: ExecuteAutoBetsForRoundUseCase,
    useFactory: (
      autoBetSessionRepository: AutoBetSessionRepository,
      placeBetUseCase: PlaceBetUseCase,
      idGenerator: IdGenerator,
      gameMetrics: GameMetrics,
    ): ExecuteAutoBetsForRoundUseCase =>
      new ExecuteAutoBetsForRoundUseCase(
        autoBetSessionRepository,
        placeBetUseCase,
        idGenerator,
        gameMetrics,
      ),
    inject: [
      AUTO_BET_SESSION_REPOSITORY,
      PlaceBetUseCase,
      ID_GENERATOR,
      GameMetrics,
    ],
  },
  {
    provide: ApplyAutoBetResultUseCase,
    useFactory: (
      autoBetSessionRepository: AutoBetSessionRepository,
    ): ApplyAutoBetResultUseCase =>
      new ApplyAutoBetResultUseCase(autoBetSessionRepository),
    inject: [AUTO_BET_SESSION_REPOSITORY],
  },
];
