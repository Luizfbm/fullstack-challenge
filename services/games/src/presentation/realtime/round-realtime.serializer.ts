import { MULTIPLIER_GROWTH_RATE_BP_PER_SECOND } from "../../application/game.constants";
import { Bet } from "../../domain/bet";
import { calculateCurrentMultiplierBp } from "../../domain/multiplier";
import { Round } from "../../domain/round";
import { toPublicBetFields, toPublicRoundFields } from "../round-response.mapper";
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

    const publicRound = toPublicRoundFields(round);

    return {
      ...publicRound,
      roundId: publicRound.id,
      currentMultiplierBp,
      bets: round.bets.map((bet) => this.toBetPayload(bet)),
    };
  }

  toBetPayload(bet: Bet): RealtimeBetPayload {
    return {
      ...toPublicBetFields(bet),
      betId: bet.id,
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
      MULTIPLIER_GROWTH_RATE_BP_PER_SECOND,
    );
  }
}
