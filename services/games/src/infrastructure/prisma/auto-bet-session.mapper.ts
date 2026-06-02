import type { PrismaClient } from "../../../prisma/generated/client";
import type {
  AutoBetResultStatus,
  AutoBetRoundExecution,
  AutoBetRoundExecutionStatus,
  AutoBetSession,
  AutoBetSessionStatus,
  AutoBetStrategy,
  AutoBetStopReason,
} from "../../application/auto-bet/auto-bet-session";

type AutoBetSessionRecord = NonNullable<
  Awaited<ReturnType<PrismaClient["autoBetSession"]["findFirst"]>>
>;
type AutoBetRoundExecutionRecord = NonNullable<
  Awaited<ReturnType<PrismaClient["autoBetRoundExecution"]["findFirst"]>>
>;

export function toAutoBetSession(
  record: AutoBetSessionRecord,
): AutoBetSession {
  return {
    id: record.id,
    playerId: record.playerId,
    username: record.username,
    status: record.status as AutoBetSessionStatus,
    strategy: record.strategy as AutoBetStrategy,
    amountCents: record.amountCents,
    nextAmountCents: record.nextAmountCents,
    autoCashoutMultiplierBp: record.autoCashoutMultiplierBp,
    maxRounds: record.maxRounds,
    roundsPlayed: record.roundsPlayed,
    martingaleMultiplier: record.martingaleMultiplier,
    martingaleMaxSteps: record.martingaleMaxSteps,
    martingaleCurrentStep: record.martingaleCurrentStep,
    netProfitCents: record.netProfitCents,
    stopLossCents: record.stopLossCents,
    takeProfitCents: record.takeProfitCents,
    stopReason: record.stopReason as AutoBetStopReason | null,
    startsAfterRoundId: record.startsAfterRoundId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    stoppedAt: record.stoppedAt,
  };
}

export function toAutoBetRoundExecution(
  record: AutoBetRoundExecutionRecord,
): AutoBetRoundExecution {
  return {
    id: record.id,
    sessionId: record.sessionId,
    roundId: record.roundId,
    betId: record.betId,
    status: record.status as AutoBetRoundExecutionStatus,
    reason: record.reason,
    resultStatus: record.resultStatus as AutoBetResultStatus | null,
    resultDeltaCents: record.resultDeltaCents,
    resultAppliedAt: record.resultAppliedAt,
    createdAt: record.createdAt,
  };
}
