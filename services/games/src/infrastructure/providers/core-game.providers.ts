import type { Provider } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  AUTO_BET_SESSION_REPOSITORY,
  type AutoBetSessionRepository,
} from "../../application/ports/auto-bet-session.repository";
import { CLOCK, type Clock } from "../../application/ports/clock";
import {
  GAME_REPOSITORY,
  type GameRepository,
} from "../../application/ports/game.repository";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../application/ports/id-generator";
import { WALLET_CLIENT } from "../../application/ports/wallet.client";
import {
  WALLET_OUTBOX_REPOSITORY,
  type WalletOutboxRepository,
} from "../../application/ports/wallet-outbox.repository";
import { RabbitMqWalletClient } from "../messaging/rabbitmq-wallet.client";
import { WalletOutboxDispatcher } from "../messaging/wallet-outbox-dispatcher";
import { GameMetrics } from "../observability/game-metrics";
import { AutoBetSessionPrismaRepository } from "../prisma/auto-bet-session-prisma.repository";
import { GamePrismaRepository } from "../prisma/game-prisma.repository";
import { prismaClient } from "../prisma/prisma-client";
import { WalletOutboxPrismaRepository } from "../prisma/wallet-outbox-prisma.repository";
import { HashChainRoundSeedProvider } from "../provably-fair/hash-chain-round-seed-provider";
import { cashoutCreditServiceProvider } from "./cashout-credit-service.provider";

const DEFAULT_HASH_CHAIN_ROOT_SEED =
  "local-dev-crash-game-hash-chain-root-seed";

export const coreGameProviders: Provider[] = [
  {
    provide: GAME_REPOSITORY,
    useFactory: (): GameRepository => new GamePrismaRepository(prismaClient),
  },
  {
    provide: AUTO_BET_SESSION_REPOSITORY,
    useFactory: (): AutoBetSessionRepository =>
      new AutoBetSessionPrismaRepository(prismaClient),
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
  {
    provide: WALLET_OUTBOX_REPOSITORY,
    useFactory: (): WalletOutboxRepository =>
      new WalletOutboxPrismaRepository(prismaClient),
  },
  {
    provide: WalletOutboxDispatcher,
    useFactory: (
      walletOutboxRepository: WalletOutboxRepository,
      walletPublisher: RabbitMqWalletClient,
    ): WalletOutboxDispatcher =>
      new WalletOutboxDispatcher(walletOutboxRepository, walletPublisher),
    inject: [WALLET_OUTBOX_REPOSITORY, RabbitMqWalletClient],
  },
  cashoutCreditServiceProvider,
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
];
