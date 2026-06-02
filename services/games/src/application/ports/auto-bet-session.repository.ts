import type {
  AutoBetResultStatus,
  AutoBetRoundExecution,
  AutoBetRoundExecutionStatus,
  AutoBetSession,
  AutoBetStopReason,
} from "../auto-bet/auto-bet-session";

export const AUTO_BET_SESSION_REPOSITORY = Symbol(
  "AUTO_BET_SESSION_REPOSITORY",
);

export type NewAutoBetSession = Omit<
  AutoBetSession,
  "createdAt" | "updatedAt" | "stoppedAt"
> & {
  stoppedAt: null;
};

export type StopAutoBetSessionInput = {
  sessionId: string;
  reason: AutoBetStopReason;
};

export type NewAutoBetRoundExecution = {
  id: string;
  sessionId: string;
  roundId: string;
  betId: string | null;
  status: AutoBetRoundExecutionStatus;
  reason: string | null;
};

export type ApplyAutoBetResultInput = {
  executionId: string;
  resultStatus: AutoBetResultStatus;
  deltaCents: bigint;
};

export interface AutoBetSessionRepository {
  create(input: NewAutoBetSession): Promise<AutoBetSession>;
  findActiveByPlayer(playerId: string): Promise<AutoBetSession | null>;
  findLatestByPlayer(playerId: string): Promise<AutoBetSession | null>;
  listActive(): Promise<AutoBetSession[]>;
  stop(input: StopAutoBetSessionInput): Promise<AutoBetSession>;
  findExecution(
    sessionId: string,
    roundId: string,
  ): Promise<AutoBetRoundExecution | null>;
  findExecutionByBetId(betId: string): Promise<AutoBetRoundExecution | null>;
  recordExecution(
    input: NewAutoBetRoundExecution,
  ): Promise<AutoBetRoundExecution>;
  incrementRoundsPlayed(sessionId: string): Promise<AutoBetSession>;
  applyBetResult(
    input: ApplyAutoBetResultInput,
  ): Promise<AutoBetSession | null>;
}
