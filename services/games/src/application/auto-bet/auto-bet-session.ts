import { parseAutoCashoutMultiplierBp } from "../auto-cashout";
import { toCents } from "../cents";
import {
  MAX_BET_AMOUNT_CENTS,
  MIN_BET_AMOUNT_CENTS,
} from "../game.constants";
import { AutoBetSessionConfigInvalidError } from "../game.errors";
import {
  parseMartingaleMaxSteps,
  parseMartingaleMultiplier,
  parseStrategy,
  type AutoBetStrategy,
} from "./auto-bet-strategy";

export type { AutoBetProgression, AutoBetStrategy } from "./auto-bet-strategy";
export { getAutoBetProgression } from "./auto-bet-strategy";

export type AutoBetSessionStatus = "ACTIVE" | "STOPPED";

export type AutoBetStopReason =
  | "MANUAL"
  | "MAX_ROUNDS_REACHED"
  | "STOP_LOSS_REACHED"
  | "TAKE_PROFIT_REACHED"
  | "MARTINGALE_MAX_STEPS_REACHED"
  | "MARTINGALE_BET_LIMIT_REACHED"
  | "WALLET_REJECTED"
  | "WALLET_UNAVAILABLE"
  | "ROUND_NOT_AVAILABLE";

export type AutoBetResultStatus = "LOST" | "CASHED_OUT";
export type AutoBetRoundExecutionStatus = "BET_PLACED" | "SKIPPED" | "FAILED";

export type AutoBetSession = {
  id: string;
  playerId: string;
  username: string;
  status: AutoBetSessionStatus;
  strategy: AutoBetStrategy;
  amountCents: bigint;
  nextAmountCents: bigint;
  autoCashoutMultiplierBp: number | null;
  maxRounds: number;
  roundsPlayed: number;
  martingaleMultiplier: number;
  martingaleMaxSteps: number;
  martingaleCurrentStep: number;
  netProfitCents: bigint;
  stopLossCents: bigint | null;
  takeProfitCents: bigint | null;
  stopReason: AutoBetStopReason | null;
  startsAfterRoundId: string | null;
  createdAt: Date;
  updatedAt: Date;
  stoppedAt: Date | null;
};

export type AutoBetRoundExecution = {
  id: string;
  sessionId: string;
  roundId: string;
  betId: string | null;
  status: AutoBetRoundExecutionStatus;
  reason: string | null;
  resultStatus: AutoBetResultStatus | null;
  resultDeltaCents: bigint | null;
  resultAppliedAt: Date | null;
  createdAt: Date;
};

export type StartAutoBetConfig = {
  amountCents: bigint | number | string;
  autoCashoutMultiplierBp?: number | null;
  maxRounds: number;
  strategy?: AutoBetStrategy | string | null;
  martingaleMultiplier?: number | null;
  martingaleMaxSteps?: number | null;
  stopLossCents?: bigint | number | string | null;
  takeProfitCents?: bigint | number | string | null;
};

export type ParsedAutoBetConfig = {
  strategy: AutoBetStrategy;
  amountCents: bigint;
  nextAmountCents: bigint;
  autoCashoutMultiplierBp: number | null;
  maxRounds: number;
  martingaleMultiplier: number;
  martingaleMaxSteps: number;
  martingaleCurrentStep: number;
  stopLossCents: bigint | null;
  takeProfitCents: bigint | null;
};

export function parseAutoBetConfig(
  input: StartAutoBetConfig,
): ParsedAutoBetConfig {
  const amountCents = toCents(input.amountCents);
  const strategy = parseStrategy(input.strategy);

  if (
    amountCents < MIN_BET_AMOUNT_CENTS ||
    amountCents > MAX_BET_AMOUNT_CENTS
  ) {
    throw new AutoBetSessionConfigInvalidError(
      "Auto bet amount must be between 1.00 and 1000.00",
    );
  }

  if (
    !Number.isInteger(input.maxRounds) ||
    input.maxRounds < 1 ||
    input.maxRounds > 100
  ) {
    throw new AutoBetSessionConfigInvalidError(
      "Auto bet maxRounds must be between 1 and 100",
    );
  }

  return {
    strategy,
    amountCents,
    nextAmountCents: amountCents,
    autoCashoutMultiplierBp: parseAutoCashoutMultiplierBp(
      input.autoCashoutMultiplierBp,
    ),
    maxRounds: input.maxRounds,
    martingaleMultiplier: parseMartingaleMultiplier(
      input.martingaleMultiplier,
    ),
    martingaleMaxSteps: parseMartingaleMaxSteps(
      strategy,
      input.martingaleMaxSteps,
    ),
    martingaleCurrentStep: 0,
    stopLossCents: parseOptionalPositiveCents(
      input.stopLossCents,
      "stopLossCents",
    ),
    takeProfitCents: parseOptionalPositiveCents(
      input.takeProfitCents,
      "takeProfitCents",
    ),
  };
}

export function shouldStopForProfitLimits(
  session: AutoBetSession,
): AutoBetStopReason | null {
  if (
    session.stopLossCents !== null &&
    session.netProfitCents <= -session.stopLossCents
  ) {
    return "STOP_LOSS_REACHED";
  }

  if (
    session.takeProfitCents !== null &&
    session.netProfitCents >= session.takeProfitCents
  ) {
    return "TAKE_PROFIT_REACHED";
  }

  return null;
}

function parseOptionalPositiveCents(
  value: bigint | number | string | null | undefined,
  fieldName: string,
): bigint | null {
  if (value === null || value === undefined) {
    return null;
  }

  const cents = toCents(value);

  if (cents <= 0n) {
    throw new AutoBetSessionConfigInvalidError(
      `Auto bet ${fieldName} must be a positive integer`,
    );
  }

  return cents;
}
