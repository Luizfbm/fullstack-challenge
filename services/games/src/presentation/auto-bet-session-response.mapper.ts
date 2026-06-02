import type { AutoBetSession } from "../application/auto-bet/auto-bet-session";
import type { AutoBetSessionResponseDto } from "./dtos/auto-bet-session-response.dto";

export function toAutoBetSessionResponse(
  session: AutoBetSession,
): AutoBetSessionResponseDto {
  return {
    id: session.id,
    playerId: session.playerId,
    username: session.username,
    status: session.status,
    strategy: session.strategy,
    amountCents: session.amountCents.toString(),
    nextAmountCents: session.nextAmountCents.toString(),
    autoCashoutMultiplierBp: session.autoCashoutMultiplierBp,
    maxRounds: session.maxRounds,
    roundsPlayed: session.roundsPlayed,
    martingaleMultiplier: session.martingaleMultiplier,
    martingaleMaxSteps: session.martingaleMaxSteps,
    martingaleCurrentStep: session.martingaleCurrentStep,
    netProfitCents: session.netProfitCents.toString(),
    stopLossCents: session.stopLossCents?.toString() ?? null,
    takeProfitCents: session.takeProfitCents?.toString() ?? null,
    stopReason: session.stopReason,
    startsAfterRoundId: session.startsAfterRoundId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    stoppedAt: session.stoppedAt?.toISOString() ?? null,
  };
}
