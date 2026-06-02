import type { Provider } from "@nestjs/common";
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
import {
  ROUND_EVENTS_PUBLISHER,
  type RoundEventsPublisher,
} from "../../application/ports/round-events.publisher";
import {
  WALLET_CLIENT,
  type WalletClient,
} from "../../application/ports/wallet.client";
import {
  WALLET_OUTBOX_REPOSITORY,
  type WalletOutboxRepository,
} from "../../application/ports/wallet-outbox.repository";
import { CashoutCreditService } from "../../application/services/cashout-credit.service";
import { ApplyAutoBetResultUseCase } from "../../application/use-cases/apply-auto-bet-result.use-case";
import { CashOutUseCase } from "../../application/use-cases/cash-out.use-case";
import { PlaceBetUseCase } from "../../application/use-cases/place-bet.use-case";
import { WalletOutboxDispatcher } from "../messaging/wallet-outbox-dispatcher";
import { GameMetrics } from "../observability/game-metrics";

export const bettingProviders: Provider[] = [
  {
    provide: PlaceBetUseCase,
    useFactory: (
      gameRepository: GameRepository,
      walletClient: WalletClient,
      idGenerator: IdGenerator,
      roundEventsPublisher: RoundEventsPublisher,
      gameMetrics: GameMetrics,
      walletOutboxRepository: WalletOutboxRepository,
      walletOutboxDispatcher: WalletOutboxDispatcher,
      autoBetSessionRepository: AutoBetSessionRepository,
    ): PlaceBetUseCase =>
      new PlaceBetUseCase(
        gameRepository,
        walletClient,
        idGenerator,
        roundEventsPublisher,
        gameMetrics,
        walletOutboxRepository,
        walletOutboxDispatcher,
        autoBetSessionRepository,
      ),
    inject: [
      GAME_REPOSITORY,
      WALLET_CLIENT,
      ID_GENERATOR,
      ROUND_EVENTS_PUBLISHER,
      GameMetrics,
      WALLET_OUTBOX_REPOSITORY,
      WalletOutboxDispatcher,
      AUTO_BET_SESSION_REPOSITORY,
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
      cashoutCreditService: CashoutCreditService,
      applyAutoBetResultUseCase: ApplyAutoBetResultUseCase,
    ): CashOutUseCase =>
      new CashOutUseCase(
        gameRepository,
        walletClient,
        clock,
        roundEventsPublisher,
        gameMetrics,
        cashoutCreditService,
        applyAutoBetResultUseCase,
      ),
    inject: [
      GAME_REPOSITORY,
      WALLET_CLIENT,
      CLOCK,
      ROUND_EVENTS_PUBLISHER,
      GameMetrics,
      CashoutCreditService,
      ApplyAutoBetResultUseCase,
    ],
  },
];
