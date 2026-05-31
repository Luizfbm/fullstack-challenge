import { MULTIPLIER_GROWTH_BP_PER_SECOND } from "../game.constants";
import { Clock } from "../ports/clock";
import { GameRepository } from "../ports/game.repository";
import { IdGenerator } from "../ports/id-generator";
import { RoundSeedProvider } from "../ports/round-seed-provider";
import { calculateCurrentMultiplierBp } from "../../domain/multiplier";
import { Round } from "../../domain/round";

type AdvanceRoundLifecycleConfig = {
  bettingWindowMs: number;
};

export type AdvanceRoundLifecycleAction =
  | "ROUND_OPENED"
  | "ROUND_STARTED"
  | "ROUND_CRASHED"
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
    private readonly config: AdvanceRoundLifecycleConfig,
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

    if (!currentRound) {
      return this.openNextRound();
    }

    if (currentRound.status === "BETTING") {
      return this.advanceBettingRound(currentRound);
    }

    if (currentRound.status === "RUNNING") {
      return this.advanceRunningRound(currentRound);
    }

    return { action: "NOOP", round: currentRound };
  }

  private async openNextRound(): Promise<AdvanceRoundLifecycleResult> {
    const latestRound = await this.gameRepository.findLatestRound();
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
      MULTIPLIER_GROWTH_BP_PER_SECOND,
    );

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
}
