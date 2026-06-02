import type { Provider } from "@nestjs/common";
import {
  GAME_REPOSITORY,
  type GameRepository,
} from "../../application/ports/game.repository";
import {
  ID_GENERATOR,
  type IdGenerator,
} from "../../application/ports/id-generator";
import {
  WALLET_CLIENT,
  type WalletClient,
} from "../../application/ports/wallet.client";
import {
  WALLET_OUTBOX_REPOSITORY,
  type WalletOutboxRepository,
} from "../../application/ports/wallet-outbox.repository";
import { CashoutCreditService } from "../../application/services/cashout-credit.service";
import { WalletOutboxDispatcher } from "../messaging/wallet-outbox-dispatcher";

export const cashoutCreditServiceProvider: Provider = {
  provide: CashoutCreditService,
  useFactory: (
    gameRepository: GameRepository,
    walletClient: WalletClient,
    idGenerator: IdGenerator,
    walletOutboxRepository: WalletOutboxRepository,
    walletOutboxDispatcher: WalletOutboxDispatcher,
  ): CashoutCreditService =>
    new CashoutCreditService(
      gameRepository,
      walletClient,
      idGenerator,
      walletOutboxRepository,
      walletOutboxDispatcher,
    ),
  inject: [
    GAME_REPOSITORY,
    WALLET_CLIENT,
    ID_GENERATOR,
    WALLET_OUTBOX_REPOSITORY,
    WalletOutboxDispatcher,
  ],
};
