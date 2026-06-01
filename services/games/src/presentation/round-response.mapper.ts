import {
  BASE_MULTIPLIER_BP,
  MULTIPLIER_CURVE,
  MULTIPLIER_GROWTH_RATE_BP_PER_SECOND,
} from "../application/game.constants";
import { Bet } from "../domain/bet";
import { Round } from "../domain/round";

export function toPublicRoundFields(round: Round) {
  return {
    id: round.id,
    status: round.status,
    bettingStartsAt: round.bettingStartsAt.toISOString(),
    bettingEndsAt: round.bettingEndsAt.toISOString(),
    startedAt: round.startedAt?.toISOString() ?? null,
    crashedAt: round.crashedAt?.toISOString() ?? null,
    crashPointBp: round.serverSeed ? round.crashPointBp : null,
    multiplierBaseBp: BASE_MULTIPLIER_BP,
    multiplierCurve: MULTIPLIER_CURVE as typeof MULTIPLIER_CURVE,
    multiplierGrowthRateBpPerSecond: MULTIPLIER_GROWTH_RATE_BP_PER_SECOND,
    serverSeedHash: round.serverSeedHash,
    serverSeed: round.serverSeed,
    clientSeed: round.clientSeed,
    nonce: round.nonce,
    chainIndex: round.chainIndex,
    nextServerSeedHash: round.nextServerSeedHash,
  };
}

export function toPublicBetFields(bet: Bet) {
  return {
    id: bet.id,
    roundId: bet.roundId,
    playerId: bet.playerId,
    username: bet.username,
    amountCents: bet.amountCents.toString(),
    status: bet.status,
    autoCashoutMultiplierBp: bet.autoCashoutMultiplierBp,
    cashoutMultiplierBp: bet.cashoutMultiplierBp,
    payoutCents: bet.payoutCents?.toString() ?? null,
    rejectionReason: bet.rejectionReason,
  };
}
