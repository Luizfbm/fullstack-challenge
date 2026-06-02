import type { AutoCashoutParseResult } from "../../services/auto-cashout";
import type {
  AutoBetStrategy,
  BetResponse,
  StartAutoBetSessionInput,
} from "../../services/game-api";
import { calculatePayoutCents } from "../../services/payout";
import type { BetMode } from "./bet-mode-toggle";
import type { DashboardRound } from "./round-formatting";

export function getPotentialPayout(
  activeBet: BetResponse | null,
  currentRound: DashboardRound | null,
): bigint | null {
  if (!activeBet || !currentRound || activeBet.status !== "ACCEPTED") {
    return null;
  }

  const multiplierBp = currentRound.currentMultiplierBp;

  if (typeof multiplierBp !== "number") {
    return null;
  }

  return calculatePayoutCents(activeBet.amountCents, multiplierBp);
}

export function getPrimaryActionLabel({
  activeAutoBetSession,
  betMode,
  placeBetIsPending,
  startAutoBetIsPending,
  stopAutoBetIsPending,
}: {
  activeAutoBetSession: boolean;
  betMode: BetMode;
  placeBetIsPending: boolean;
  startAutoBetIsPending: boolean;
  stopAutoBetIsPending: boolean;
}): string {
  if (activeAutoBetSession) {
    return stopAutoBetIsPending ? "Parando" : "Parar Auto Bet";
  }

  if (betMode === "auto") {
    return startAutoBetIsPending ? "Iniciando" : "Iniciar Auto Bet";
  }

  return placeBetIsPending ? "Enviando" : "Apostar";
}

export function buildAutoBetPayload({
  amountCents,
  autoCashoutEnabled,
  autoCashoutParseResult,
  maxRounds,
  martingaleMaxSteps,
  martingaleMultiplier,
  stopLossCents,
  strategy,
  takeProfitCents,
}: {
  amountCents: string;
  autoCashoutEnabled: boolean;
  autoCashoutParseResult: AutoCashoutParseResult;
  maxRounds: number;
  martingaleMaxSteps: number;
  martingaleMultiplier: number;
  stopLossCents: string;
  strategy: AutoBetStrategy;
  takeProfitCents: string;
}): StartAutoBetSessionInput {
  const martingaleFields =
    strategy === "MARTINGALE"
      ? { martingaleMaxSteps, martingaleMultiplier }
      : {};

  return {
    amountCents,
    autoCashoutMultiplierBp: autoCashoutEnabled
      ? autoCashoutParseResult.multiplierBp
      : null,
    ...martingaleFields,
    maxRounds,
    stopLossCents: stopLossCents || null,
    strategy,
    takeProfitCents: takeProfitCents || null,
  };
}

export function autoBetConfigIsValid({
  maxRounds,
  martingaleMaxSteps,
  martingaleMultiplier,
  stopLossCents,
  strategy,
  takeProfitCents,
}: {
  maxRounds: number;
  martingaleMaxSteps: number;
  martingaleMultiplier: number;
  stopLossCents: string;
  strategy: AutoBetStrategy;
  takeProfitCents: string;
}): boolean {
  return (
    Number.isInteger(maxRounds) &&
    maxRounds >= 1 &&
    maxRounds <= 100 &&
    martingaleConfigIsValid(strategy, martingaleMultiplier, martingaleMaxSteps) &&
    optionalPositiveCentsIsValid(stopLossCents) &&
    optionalPositiveCentsIsValid(takeProfitCents)
  );
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatMultiplierInput(multiplierBp: number): string {
  return (multiplierBp / 10000).toFixed(2);
}

function optionalPositiveCentsIsValid(value: string): boolean {
  return value === "" || BigInt(value) > 0n;
}

function martingaleConfigIsValid(
  strategy: AutoBetStrategy,
  martingaleMultiplier: number,
  martingaleMaxSteps: number,
): boolean {
  if (strategy === "FIXED") {
    return true;
  }

  return (
    Number.isInteger(martingaleMultiplier) &&
    martingaleMultiplier >= 2 &&
    martingaleMultiplier <= 10 &&
    Number.isInteger(martingaleMaxSteps) &&
    martingaleMaxSteps >= 1 &&
    martingaleMaxSteps <= 10
  );
}
