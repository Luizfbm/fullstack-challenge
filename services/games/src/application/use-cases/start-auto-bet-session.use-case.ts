import { parseAutoBetConfig } from "../auto-bet/auto-bet-session";
import { AutoBetSessionActiveError } from "../game.errors";
import { GameRepository } from "../ports/game.repository";
import { IdGenerator } from "../ports/id-generator";
import type {
  AutoBetSessionRepository,
} from "../ports/auto-bet-session.repository";
import type { GameMetrics } from "../../infrastructure/observability/game-metrics";

type GameMetricsPort = Pick<GameMetrics, "recordAutoBetSessionStarted">;

type StartAutoBetSessionInput = {
  playerId: string;
  username: string;
  amountCents: bigint | number | string;
  autoCashoutMultiplierBp?: number | null;
  maxRounds: number;
  stopLossCents?: bigint | number | string | null;
  takeProfitCents?: bigint | number | string | null;
};

export class StartAutoBetSessionUseCase {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly autoBetSessionRepository: AutoBetSessionRepository,
    private readonly idGenerator: IdGenerator,
    private readonly gameMetrics?: GameMetricsPort,
  ) {}

  async execute(input: StartAutoBetSessionInput) {
    const activeSession =
      await this.autoBetSessionRepository.findActiveByPlayer(input.playerId);

    if (activeSession) {
      throw new AutoBetSessionActiveError();
    }

    const config = parseAutoBetConfig(input);
    const currentRound = await this.gameRepository.findCurrentRound();

    const session = await this.autoBetSessionRepository.create({
      id: this.idGenerator.generate(),
      playerId: input.playerId,
      username: input.username,
      status: "ACTIVE",
      amountCents: config.amountCents,
      autoCashoutMultiplierBp: config.autoCashoutMultiplierBp,
      maxRounds: config.maxRounds,
      roundsPlayed: 0,
      netProfitCents: 0n,
      stopLossCents: config.stopLossCents,
      takeProfitCents: config.takeProfitCents,
      stopReason: null,
      startsAfterRoundId: currentRound?.id ?? null,
      stoppedAt: null,
    });

    this.recordStarted();

    return session;
  }

  private recordStarted(): void {
    try {
      this.gameMetrics?.recordAutoBetSessionStarted();
    } catch {
      // Metrics are best-effort and must not alter auto bet behavior.
    }
  }
}
