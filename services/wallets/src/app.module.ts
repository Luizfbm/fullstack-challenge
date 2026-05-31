import { Module } from "@nestjs/common";
import { WalletsController } from "./presentation/controllers/wallets.controller";
import {
  WALLET_REPOSITORY,
  WalletRepository,
} from "./application/ports/wallet.repository";
import { CreateWalletUseCase } from "./application/use-cases/create-wallet.use-case";
import { GetWalletUseCase } from "./application/use-cases/get-wallet.use-case";
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
  ],
})
export class AppModule {}
