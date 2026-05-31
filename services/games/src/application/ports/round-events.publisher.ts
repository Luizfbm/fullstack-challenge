import type { Round } from "../../domain/round";

export const ROUND_EVENTS_PUBLISHER = Symbol("ROUND_EVENTS_PUBLISHER");

export interface RoundEventsPublisher {
  publishBettingStarted(round: Round): Promise<void>;
  publishStarted(round: Round): Promise<void>;
  publishTick(round: Round): Promise<void>;
  publishCrashed(round: Round): Promise<void>;
  publishSettled(round: Round): Promise<void>;
}
