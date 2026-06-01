import { MULTIPLIER_GROWTH_RATE_BP_PER_SECOND } from "../game.constants";
import { WalletCreditFailedError } from "../game.errors";
import { Clock } from "../ports/clock";
import { GameRepository } from "../ports/game.repository";
import { IdGenerator } from "../ports/id-generator";
import type { RoundEventsPublisher } from "../ports/round-events.publisher";
import { RoundSeedProvider } from "../ports/round-seed-provider";
import type { WalletClient } from "../ports/wallet.client";
import type { Bet } from "../../domain/bet";
import { calculateCurrentMultiplierBp } from "../../domain/multiplier";
import { Round } from "../../domain/round";

type AdvanceRoundLifecycleConfig = {
  bettingWindowMs: number;
};

export type AdvanceRoundLifecycleAction =
  | "ROUND_OPENED"
  | "ROUND_STARTED"
  | "ROUND_CRASHED"
  | "ROUND_SETTLED"
  | "NOOP";

export type AdvanceRoundLifecycleResult = {
  action: AdvanceRoundLifecycleAction;
  round: Round | null;
};

export class AdvanceRoundLifecycleUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly roundSeedProvider: RoundSeedProvider,
    private readonly walletClient: WalletClient,
    private readonly config: AdvanceRoundLifecycleConfig,
    private readonly roundEventsPublisher?: RoundEventsPublisher,
  ) {
    if (
      !Number.isInteger(config.bettingWindowMs) ||
      config.bettingWindowMs <= 0
    ) {
      throw new Error("Betting window must be a positive integer");
    }
  }

  async execute(): Promise<AdvanceRoundLifecycleResult> {
    const currentRound = await this.gameRepository.findCurrentRound();

    if (currentRound?.status === "BETTING") {
      return this.advanceBettingRound(currentRound);
    }

    if (currentRound?.status === "RUNNING") {
      return this.advanceRunningRound(currentRound);
    }

    const latestRound = await this.gameRepository.findLatestRound();

    if (latestRound?.status === "CRASHED") {
      return this.settleCrashedRound(latestRound);
    }

    return this.openNextRound(latestRound);
  }

  private async openNextRound(
    latestRound: Round | null,
  ): Promise<AdvanceRoundLifecycleResult> {
    const chainIndex = (latestRound?.chainIndex ?? 0) + 1;
    const now = this.clock.now();
    const seed = this.roundSeedProvider.getRoundSeed(chainIndex);
    const round = Round.openBetting({
      id: this.idGenerator.generate(),
      bettingStartsAt: now,
      bettingEndsAt: new Date(now.getTime() + this.config.bettingWindowMs),
      crashPointBp: seed.crashPointBp,
      serverSeedHash: seed.serverSeedHash,
      clientSeed: seed.clientSeed,
      nonce: seed.nonce,
      chainIndex,
      nextServerSeedHash: seed.nextServerSeedHash,
    });

    await this.gameRepository.saveRound(round);

    return { action: "ROUND_OPENED", round };
  }

  private async advanceBettingRound(
    round: Round,
  ): Promise<AdvanceRoundLifecycleResult> {
    if (this.clock.now().getTime() < round.bettingEndsAt.getTime()) {
      return { action: "NOOP", round };
    }

    round.start(this.clock.now());
    await this.gameRepository.saveRound(round);

    return { action: "ROUND_STARTED", round };
  }

  private async advanceRunningRound(
    round: Round,
  ): Promise<AdvanceRoundLifecycleResult> {
    if (!round.startedAt) {
      throw new Error("Running round has no start time");
    }

    const multiplierBp = calculateCurrentMultiplierBp(
      round.startedAt,
      this.clock.now(),
      MULTIPLIER_GROWTH_RATE_BP_PER_SECOND,
    );

    await this.applyAutoCashouts(round, multiplierBp);

    if (multiplierBp < round.crashPointBp) {
      return { action: "NOOP", round };
    }

    round.crash(
      this.clock.now(),
      this.roundSeedProvider.getServerSeed(round.chainIndex),
    );
    await this.gameRepository.saveRound(round);

    return { action: "ROUND_CRASHED", round };
  }

  private async applyAutoCashouts(
    round: Round,
    currentMultiplierBp: number,
  ): Promise<void> {
    const eligibleBets = round.bets.filter(
      (bet) =>
        bet.status === "ACCEPTED" &&
        bet.autoCashoutMultiplierBp !== null &&
        bet.autoCashoutMultiplierBp < round.crashPointBp &&
        currentMultiplierBp >= bet.autoCashoutMultiplierBp,
    );

    for (const bet of eligibleBets) {
      const targetMultiplierBp = bet.autoCashoutMultiplierBp;

      if (targetMultiplierBp === null) {
        continue;
      }

      round.cashOut(bet.playerId, targetMultiplierBp);

      if (bet.payoutCents === null) {
        throw new Error("Auto cashout payout was not calculated");
      }

      await this.gameRepository.saveRound(round);

      try {
        await this.walletClient.credit({
          playerId: bet.playerId,
          amountCents: bet.payoutCents,
          referenceId: `round:${round.id}:player:${bet.playerId}:cashout-credit`,
          reason: "CASHOUT_PAYOUT",
        });
      } catch (error) {
        throw new WalletCreditFailedError(error);
      }

      round.completeCashOut(bet.playerId);
      await this.gameRepository.saveRound(round);
      await this.roundEventsPublisher?.publishBetCashedOut(bet);
    }
  }

  private async settleCrashedRound(
    round: Round,
  ): Promise<AdvanceRoundLifecycleResult> {
    const pendingCashouts = round.bets.filter(
      (bet) => bet.status === "CASHOUT_PENDING_CREDIT",
    );

    for (const bet of pendingCashouts) {
      await this.retryPendingCashout(round, bet);
      await this.gameRepository.saveRound(round);
    }

    round.settle();
    await this.gameRepository.saveRound(round);

    return { action: "ROUND_SETTLED", round };
  }

  private async retryPendingCashout(round: Round, bet: Bet): Promise<void> {
    if (bet.payoutCents === null) {
      throw new Error("Pending cashout has no payout");
    }

    await this.walletClient.credit({
      playerId: bet.playerId,
      amountCents: bet.payoutCents,
      referenceId: `round:${round.id}:player:${bet.playerId}:cashout-credit`,
      reason: "CASHOUT_PAYOUT",
    });

    round.completeCashOut(bet.playerId);
  }
}
