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
import { WalletPrismaRepository } from "./infrastructure/prisma/wallet-prisma.repository";
import { prismaClient } from "./infrastructure/prisma/prisma-client";
import { randomUUID } from "node:crypto";

@Module({
  controllers: [WalletsController],
  providers: [
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
      ): WalletCommandHandler =>
        new WalletCommandHandler(debitWalletUseCase, creditWalletUseCase),
      inject: [DebitWalletUseCase, CreditWalletUseCase],
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
  ],
})
export class AppModule {}
