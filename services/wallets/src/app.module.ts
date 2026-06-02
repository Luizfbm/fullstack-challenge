import { Module } from "@nestjs/common";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import {
  WALLET_REPOSITORY,
  WalletRepository,
} from "./application/ports/wallet.repository";
import { CreateWalletUseCase } from "./application/use-cases/create-wallet.use-case";
import { CreditWalletUseCase } from "./application/use-cases/credit-wallet.use-case";
import { DebitWalletUseCase } from "./application/use-cases/debit-wallet.use-case";
import { GetWalletUseCase } from "./application/use-cases/get-wallet.use-case";
import { RabbitMqWalletServer } from "./infrastructure/messaging/rabbitmq-wallet-server";
import { WalletCommandHandler } from "./infrastructure/messaging/wallet-command-handler";
import { WalletMetrics } from "./infrastructure/observability/wallet-metrics";
import { WalletPrismaRepository } from "./infrastructure/prisma/wallet-prisma.repository";
import { DevelopmentWalletSeeder } from "./infrastructure/seed/development-wallet-seeder";
import { prismaClient } from "./infrastructure/prisma/prisma-client";
import { randomUUID } from "node:crypto";

@Module({
  controllers: [WalletsController],
  providers: [
    WalletMetrics,
    {
      provide: WALLET_REPOSITORY,
      useFactory: (): WalletRepository =>
        new WalletPrismaRepository(prismaClient),
    },
    {
      provide: CreateWalletUseCase,
      useFactory: (walletRepository: WalletRepository): CreateWalletUseCase =>
        new CreateWalletUseCase(walletRepository, randomUUID),
      inject: [WALLET_REPOSITORY],
    },
    {
      provide: GetWalletUseCase,
      useFactory: (walletRepository: WalletRepository): GetWalletUseCase =>
        new GetWalletUseCase(walletRepository),
      inject: [WALLET_REPOSITORY],
    },
    {
      provide: DebitWalletUseCase,
      useFactory: (walletRepository: WalletRepository): DebitWalletUseCase =>
        new DebitWalletUseCase(walletRepository),
      inject: [WALLET_REPOSITORY],
    },
    {
      provide: CreditWalletUseCase,
      useFactory: (walletRepository: WalletRepository): CreditWalletUseCase =>
        new CreditWalletUseCase(walletRepository),
      inject: [WALLET_REPOSITORY],
    },
    {
      provide: WalletCommandHandler,
      useFactory: (
        debitWalletUseCase: DebitWalletUseCase,
        creditWalletUseCase: CreditWalletUseCase,
        walletMetrics: WalletMetrics,
      ): WalletCommandHandler =>
        new WalletCommandHandler(
          debitWalletUseCase,
          creditWalletUseCase,
          walletMetrics,
        ),
      inject: [DebitWalletUseCase, CreditWalletUseCase, WalletMetrics],
    },
    {
      provide: RabbitMqWalletServer,
      useFactory: (
        walletCommandHandler: WalletCommandHandler,
      ): RabbitMqWalletServer =>
        new RabbitMqWalletServer(
          walletCommandHandler,
          process.env.RABBITMQ_URL ?? "amqp://localhost:5672",
        ),
      inject: [WalletCommandHandler],
    },
    {
      provide: DevelopmentWalletSeeder,
      useFactory: (
        createWalletUseCase: CreateWalletUseCase,
      ): DevelopmentWalletSeeder =>
        new DevelopmentWalletSeeder(createWalletUseCase, {
          playerId: process.env.SEED_PLAYER_ID,
          initialBalanceCents: process.env.INITIAL_WALLET_BALANCE_CENTS,
        }),
      inject: [CreateWalletUseCase],
    },
  ],
})
export class AppModule {}
