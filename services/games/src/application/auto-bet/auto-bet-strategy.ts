import { MAX_BET_AMOUNT_CENTS } from "../game.constants";
import { AutoBetSessionConfigInvalidError } from "../game.errors";

export type AutoBetStrategy = "FIXED" | "MARTINGALE";

type AutoBetProgressionResultStatus = "LOST" | "CASHED_OUT";

type AutoBetMartingaleStopReason =
  | "MARTINGALE_MAX_STEPS_REACHED"
  | "MARTINGALE_BET_LIMIT_REACHED";

export type AutoBetProgression =
  | {
      stopReason: null;
      nextAmountCents: bigint;
      martingaleCurrentStep: number;
    }
  | {
      stopReason: AutoBetMartingaleStopReason;
      nextAmountCents: null;
      martingaleCurrentStep: null;
    };

type AutoBetProgressionSession = {
  amountCents: bigint;
  martingaleCurrentStep: number;
  martingaleMaxSteps: number;
  martingaleMultiplier: number;
  nextAmountCents: bigint;
  strategy: AutoBetStrategy;
};

export function parseStrategy(
  value: string | null | undefined,
): AutoBetStrategy {
  if (value === null || value === undefined) {
    return "FIXED";
  }

  if (value === "FIXED" || value === "MARTINGALE") {
    return value;
  }

  throw new AutoBetSessionConfigInvalidError(
    "Auto bet strategy must be FIXED or MARTINGALE",
  );
}

export function parseMartingaleMultiplier(
  value: number | null | undefined,
): number {
  const multiplier = value ?? 2;

  if (!Number.isInteger(multiplier) || multiplier < 2 || multiplier > 10) {
    throw new AutoBetSessionConfigInvalidError(
      "Auto bet martingaleMultiplier must be between 2 and 10",
    );
  }

  return multiplier;
}

export function parseMartingaleMaxSteps(
  strategy: AutoBetStrategy,
  value: number | null | undefined,
): number {
  if (strategy === "FIXED") {
    return 0;
  }

  const maxSteps = value ?? 3;

  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 10) {
    throw new AutoBetSessionConfigInvalidError(
      "Auto bet martingaleMaxSteps must be between 1 and 10",
    );
  }

  return maxSteps;
}

export function getAutoBetProgression(
  session: AutoBetProgressionSession,
  resultStatus: AutoBetProgressionResultStatus,
): AutoBetProgression | null {
  if (session.strategy === "FIXED") {
    return null;
  }

  if (resultStatus === "CASHED_OUT") {
    return {
      stopReason: null,
      nextAmountCents: session.amountCents,
      martingaleCurrentStep: 0,
    };
  }

  const nextStep = session.martingaleCurrentStep + 1;

  if (nextStep > session.martingaleMaxSteps) {
    return martingaleStop("MARTINGALE_MAX_STEPS_REACHED");
  }

  const nextAmountCents =
    session.nextAmountCents * BigInt(session.martingaleMultiplier);

  if (nextAmountCents > MAX_BET_AMOUNT_CENTS) {
    return martingaleStop("MARTINGALE_BET_LIMIT_REACHED");
  }

  return {
    stopReason: null,
    nextAmountCents,
    martingaleCurrentStep: nextStep,
  };
}

function martingaleStop(
  stopReason: AutoBetMartingaleStopReason,
): AutoBetProgression {
  return {
    stopReason,
    nextAmountCents: null,
    martingaleCurrentStep: null,
  };
}
