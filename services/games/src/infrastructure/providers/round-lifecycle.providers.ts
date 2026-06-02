import type { Provider } from "@nestjs/common";
import { CashoutCreditService } from "../../application/services/cashout-credit.service";
import { CLOCK } from "../../application/ports/clock";
import type { Clock } from "../../application/ports/clock";
import { GAME_REPOSITORY } from "../../application/ports/game.repository";
import type { GameRepository } from "../../application/ports/game.repository";
import { ID_GENERATOR } from "../../application/ports/id-generator";
import type { IdGenerator } from "../../application/ports/id-generator";
import { ROUND_EVENTS_PUBLISHER } from "../../application/ports/round-events.publisher";
import type { RoundEventsPublisher } from "../../application/ports/round-events.publisher";
import { WALLET_CLIENT } from "../../application/ports/wallet.client";
import type { WalletClient } from "../../application/ports/wallet.client";
import { AdvanceRoundLifecycleUseCase } from "../../application/use-cases/advance-round-lifecycle.use-case";
import { ApplyAutoBetResultUseCase } from "../../application/use-cases/apply-auto-bet-result.use-case";
import { ExecuteAutoBetsForRoundUseCase } from "../../application/use-cases/execute-auto-bets-for-round.use-case";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { RoundLifecycleRunner } from "../lifecycle/round-lifecycle-runner";
import { GameMetrics } from "../observability/game-metrics";
import { HashChainRoundSeedProvider } from "../provably-fair/hash-chain-round-seed-provider";
import { RoundRealtimeSerializer } from "../../presentation/realtime/round-realtime.serializer";
import { RoundsGateway } from "../../presentation/realtime/rounds.gateway";

export const roundLifecycleProviders: Provider[] = [
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
      cashoutCreditService: CashoutCreditService,
      executeAutoBetsForRoundUseCase: ExecuteAutoBetsForRoundUseCase,
      applyAutoBetResultUseCase: ApplyAutoBetResultUseCase,
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
        cashoutCreditService,
        executeAutoBetsForRoundUseCase,
        applyAutoBetResultUseCase,
      ),
    inject: [
      GAME_REPOSITORY,
      ID_GENERATOR,
      CLOCK,
      HashChainRoundSeedProvider,
      WALLET_CLIENT,
      ROUND_EVENTS_PUBLISHER,
      GameMetrics,
      CashoutCreditService,
      ExecuteAutoBetsForRoundUseCase,
      ApplyAutoBetResultUseCase,
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
];
