import { Module } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CLOCK, Clock } from "./application/ports/clock";
import {
  GAME_REPOSITORY,
  GameRepository,
} from "./application/ports/game.repository";
import { ID_GENERATOR, IdGenerator } from "./application/ports/id-generator";
import {
  ROUND_EVENTS_PUBLISHER,
  RoundEventsPublisher,
} from "./application/ports/round-events.publisher";
import {
  WALLET_CLIENT,
  WalletClient,
} from "./application/ports/wallet.client";
import { CashOutUseCase } from "./application/use-cases/cash-out.use-case";
import { AdvanceRoundLifecycleUseCase } from "./application/use-cases/advance-round-lifecycle.use-case";
import { GetCurrentRoundUseCase } from "./application/use-cases/get-current-round.use-case";
import { ListMyBetsUseCase } from "./application/use-cases/list-my-bets.use-case";
import { ListLeaderboardUseCase } from "./application/use-cases/list-leaderboard.use-case";
import { ListRoundHistoryUseCase } from "./application/use-cases/list-round-history.use-case";
import { PlaceBetUseCase } from "./application/use-cases/place-bet.use-case";
import { VerifyRoundUseCase } from "./application/use-cases/verify-round.use-case";
import { RoundLifecycleRunner } from "./infrastructure/lifecycle/round-lifecycle-runner";
import { RabbitMqWalletClient } from "./infrastructure/messaging/rabbitmq-wallet.client";
import { GameMetrics } from "./infrastructure/observability/game-metrics";
import { HashChainRoundSeedProvider } from "./infrastructure/provably-fair/hash-chain-round-seed-provider";
import { GamePrismaRepository } from "./infrastructure/prisma/game-prisma.repository";
import { prismaClient } from "./infrastructure/prisma/prisma-client";
import { GamesController } from "./presentation/controllers/games.controller";
import { RoundRealtimeSerializer } from "./presentation/realtime/round-realtime.serializer";
import { RoundsGateway } from "./presentation/realtime/rounds.gateway";

const DEFAULT_HASH_CHAIN_ROOT_SEED =
  "local-dev-crash-game-hash-chain-root-seed";

@Module({
  controllers: [GamesController],
  providers: [
    {
      provide: GAME_REPOSITORY,
      useFactory: (): GameRepository => new GamePrismaRepository(prismaClient),
    },
    {
      provide: RabbitMqWalletClient,
      useFactory: (gameMetrics: GameMetrics): RabbitMqWalletClient =>
        new RabbitMqWalletClient(
          process.env.RABBITMQ_URL ?? "amqp://localhost:5672",
          "wallet.commands",
          Number(process.env.WALLET_RPC_TIMEOUT_MS ?? 2000),
          gameMetrics,
        ),
      inject: [GameMetrics],
    },
    {
      provide: WALLET_CLIENT,
      useExisting: RabbitMqWalletClient,
    },
    GameMetrics,
    {
      provide: ID_GENERATOR,
      useValue: {
        generate: randomUUID,
      } satisfies IdGenerator,
    },
    {
      provide: CLOCK,
      useValue: {
        now: (): Date => new Date(),
      } satisfies Clock,
    },
    {
      provide: HashChainRoundSeedProvider,
      useFactory: (): HashChainRoundSeedProvider =>
        new HashChainRoundSeedProvider({
          rootSeed:
            process.env.GAME_HASH_CHAIN_ROOT_SEED ??
            DEFAULT_HASH_CHAIN_ROOT_SEED,
          chainLength: Number(process.env.GAME_HASH_CHAIN_LENGTH ?? 10000),
          clientSeed: process.env.GAME_CLIENT_SEED ?? "crash-game-client-seed",
        }),
    },
    {
      provide: AdvanceRoundLifecycleUseCase,
      useFactory: (
        gameRepository: GameRepository,
        idGenerator: IdGenerator,
        clock: Clock,
        roundSeedProvider: HashChainRoundSeedProvider,
        walletClient: WalletClient,
        roundEventsPublisher: RoundEventsPublisher,
        gameMetrics: GameMetrics,
      ): AdvanceRoundLifecycleUseCase =>
        new AdvanceRoundLifecycleUseCase(
          gameRepository,
          idGenerator,
          clock,
          roundSeedProvider,
          walletClient,
          {
            bettingWindowMs: Number(process.env.ROUND_BETTING_WINDOW_MS ?? 10000),
          },
          roundEventsPublisher,
          gameMetrics,
        ),
      inject: [
        GAME_REPOSITORY,
        ID_GENERATOR,
        CLOCK,
        HashChainRoundSeedProvider,
        WALLET_CLIENT,
        ROUND_EVENTS_PUBLISHER,
        GameMetrics,
      ],
    },
    {
      provide: RoundLifecycleRunner,
      useFactory: (
        advanceRoundLifecycleUseCase: AdvanceRoundLifecycleUseCase,
        roundEventsPublisher: RoundEventsPublisher,
      ): RoundLifecycleRunner =>
        new RoundLifecycleRunner(
          advanceRoundLifecycleUseCase,
          Number(process.env.ROUND_LIFECYCLE_INTERVAL_MS ?? 500),
          roundEventsPublisher,
        ),
      inject: [AdvanceRoundLifecycleUseCase, ROUND_EVENTS_PUBLISHER],
    },
    {
      provide: GetCurrentRoundUseCase,
      useFactory: (
        gameRepository: GameRepository,
      ): GetCurrentRoundUseCase => new GetCurrentRoundUseCase(gameRepository),
      inject: [GAME_REPOSITORY],
    },
    RoundRealtimeSerializer,
    RoundsGateway,
    {
      provide: ROUND_EVENTS_PUBLISHER,
      useExisting: RoundsGateway,
    },
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
    {
      provide: PlaceBetUseCase,
      useFactory: (
        gameRepository: GameRepository,
        walletClient: WalletClient,
        idGenerator: IdGenerator,
        roundEventsPublisher: RoundEventsPublisher,
        gameMetrics: GameMetrics,
      ): PlaceBetUseCase =>
        new PlaceBetUseCase(
          gameRepository,
          walletClient,
          idGenerator,
          roundEventsPublisher,
          gameMetrics,
        ),
      inject: [
        GAME_REPOSITORY,
        WALLET_CLIENT,
        ID_GENERATOR,
        ROUND_EVENTS_PUBLISHER,
        GameMetrics,
      ],
    },
    {
      provide: CashOutUseCase,
      useFactory: (
        gameRepository: GameRepository,
        walletClient: WalletClient,
        clock: Clock,
        roundEventsPublisher: RoundEventsPublisher,
        gameMetrics: GameMetrics,
      ): CashOutUseCase =>
        new CashOutUseCase(
          gameRepository,
          walletClient,
          clock,
          roundEventsPublisher,
          gameMetrics,
        ),
      inject: [
        GAME_REPOSITORY,
        WALLET_CLIENT,
        CLOCK,
        ROUND_EVENTS_PUBLISHER,
        GameMetrics,
      ],
    },
  ],
})
export class AppModule {}
