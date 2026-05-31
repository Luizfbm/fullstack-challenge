import { MULTIPLIER_GROWTH_BP_PER_SECOND } from "../../application/game.constants";
import { Bet } from "../../domain/bet";
import { calculateCurrentMultiplierBp } from "../../domain/multiplier";
import { Round } from "../../domain/round";
import {
  BetRealtimePayload,
  RealtimeBetPayload,
  RealtimeRoundPayload,
  RoundLifecyclePayload,
  RoundSnapshotPayload,
} from "./round-realtime.events";

type RoundPayloadOptions = {
  now?: Date;
  currentMultiplierBp?: number | null;
};

export class RoundRealtimeSerializer {
  toSnapshotPayload(round: Round | null, emittedAt = new Date()): RoundSnapshotPayload {
    return {
      round: round ? this.toRoundPayload(round, { now: emittedAt }) : null,
      emittedAt: emittedAt.toISOString(),
    };
  }

  toLifecyclePayload(
    round: Round,
    emittedAt = new Date(),
  ): RoundLifecyclePayload {
    return {
      ...this.toRoundPayload(round, { now: emittedAt }),
      emittedAt: emittedAt.toISOString(),
    };
  }

  toRoundPayload(
    round: Round,
    options: RoundPayloadOptions = {},
  ): RealtimeRoundPayload {
    const currentMultiplierBp =
      options.currentMultiplierBp ??
      this.calculateCurrentMultiplierBp(round, options.now ?? new Date());

    return {
      id: round.id,
      roundId: round.id,
      status: round.status,
      bettingStartsAt: round.bettingStartsAt.toISOString(),
      bettingEndsAt: round.bettingEndsAt.toISOString(),
      startedAt: round.startedAt?.toISOString() ?? null,
      crashedAt: round.crashedAt?.toISOString() ?? null,
      currentMultiplierBp,
      crashPointBp: round.serverSeed ? round.crashPointBp : null,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      chainIndex: round.chainIndex,
      nextServerSeedHash: round.nextServerSeedHash,
      bets: round.bets.map((bet) => this.toBetPayload(bet)),
    };
  }

  toBetPayload(bet: Bet): RealtimeBetPayload {
    return {
      id: bet.id,
      betId: bet.id,
      roundId: bet.roundId,
      playerId: bet.playerId,
      username: bet.username,
      amountCents: bet.amountCents.toString(),
      status: bet.status,
      cashoutMultiplierBp: bet.cashoutMultiplierBp,
      payoutCents: bet.payoutCents?.toString() ?? null,
      rejectionReason: bet.rejectionReason,
    };
  }

  toBetRealtimePayload(bet: Bet, emittedAt = new Date()): BetRealtimePayload {
    return {
      ...this.toBetPayload(bet),
      emittedAt: emittedAt.toISOString(),
    };
  }

  private calculateCurrentMultiplierBp(round: Round, now: Date): number | null {
    if (round.status !== "RUNNING" || !round.startedAt) {
      return null;
    }

    return calculateCurrentMultiplierBp(
      round.startedAt,
      now,
      MULTIPLIER_GROWTH_BP_PER_SECOND,
    );
  }
}
