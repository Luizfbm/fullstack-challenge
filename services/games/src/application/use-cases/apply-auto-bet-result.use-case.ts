import {
  AutoBetResultStatus,
  shouldStopForProfitLimits,
} from "../auto-bet/auto-bet-session";
import type { AutoBetSessionRepository } from "../ports/auto-bet-session.repository";

type ApplyAutoBetResultInput = {
  betId: string;
  amountCents: bigint;
  payoutCents: bigint | null;
  resultStatus: AutoBetResultStatus;
};

export class ApplyAutoBetResultUseCase {
  constructor(
    private readonly autoBetSessionRepository: AutoBetSessionRepository,
  ) {}

  async execute(input: ApplyAutoBetResultInput): Promise<void> {
    const execution =
      await this.autoBetSessionRepository.findExecutionByBetId(input.betId);

    if (!execution || execution.resultAppliedAt !== null) {
      return;
    }

    const deltaCents = this.calculateDelta(input);
    const updatedSession = await this.autoBetSessionRepository.applyBetResult({
      executionId: execution.id,
      resultStatus: input.resultStatus,
      deltaCents,
    });

    if (!updatedSession || updatedSession.status !== "ACTIVE") {
      return;
    }

    const stopReason = shouldStopForProfitLimits(updatedSession);

    if (!stopReason) {
      return;
    }

    await this.autoBetSessionRepository.stop({
      sessionId: updatedSession.id,
      reason: stopReason,
    });
  }

  private calculateDelta(input: ApplyAutoBetResultInput): bigint {
    if (input.resultStatus === "LOST") {
      return -input.amountCents;
    }

    if (input.payoutCents === null) {
      throw new Error("Cashed out auto bet result requires payoutCents");
    }

    return input.payoutCents - input.amountCents;
  }
}
