import type { AutoCashoutParseResult } from "../../services/auto-cashout";
import type {
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
  stopLossCents,
  takeProfitCents,
}: {
  amountCents: string;
  autoCashoutEnabled: boolean;
  autoCashoutParseResult: AutoCashoutParseResult;
  maxRounds: number;
  stopLossCents: string;
  takeProfitCents: string;
}): StartAutoBetSessionInput {
  return {
    amountCents,
    autoCashoutMultiplierBp: autoCashoutEnabled
      ? autoCashoutParseResult.multiplierBp
      : null,
    maxRounds,
    stopLossCents: stopLossCents || null,
    takeProfitCents: takeProfitCents || null,
  };
}

export function autoBetConfigIsValid({
  maxRounds,
  stopLossCents,
  takeProfitCents,
}: {
  maxRounds: number;
  stopLossCents: string;
  takeProfitCents: string;
}): boolean {
  return (
    Number.isInteger(maxRounds) &&
    maxRounds >= 1 &&
    maxRounds <= 100 &&
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
