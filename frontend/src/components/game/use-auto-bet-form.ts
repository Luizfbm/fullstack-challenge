import { useState } from "react";
import {
  parseAutoCashoutMultiplierInput,
} from "../../services/auto-cashout";
import type {
  AutoBetSessionResponse,
  AutoBetStrategy,
} from "../../services/game-api";
import {
  autoBetConfigIsValid,
  buildAutoBetPayload,
  formatMultiplierInput,
  onlyDigits,
} from "./bet-controls-model";

type UseAutoBetFormInput = {
  activeSession: AutoBetSessionResponse | null;
  amountCents: string;
};

export function useAutoBetForm({
  activeSession,
  amountCents,
}: UseAutoBetFormInput) {
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutTarget, setAutoCashoutTarget] = useState("2.00");
  const [maxRounds, setMaxRounds] = useState("10");
  const [strategy, setStrategy] = useState<AutoBetStrategy>("FIXED");
  const [martingaleMultiplier, setMartingaleMultiplier] = useState("2");
  const [martingaleMaxSteps, setMartingaleMaxSteps] = useState("3");
  const [stopLossCents, setStopLossCents] = useState("");
  const [takeProfitCents, setTakeProfitCents] = useState("");
  const autoCashoutParseResult =
    parseAutoCashoutMultiplierInput(autoCashoutTarget);
  const maxRoundsNumber = Number(maxRounds);
  const martingaleMultiplierNumber = Number(martingaleMultiplier);
  const martingaleMaxStepsNumber = Number(martingaleMaxSteps);

  return {
    autoBetConfigValid: autoBetConfigIsValid({
      martingaleMaxSteps: martingaleMaxStepsNumber,
      martingaleMultiplier: martingaleMultiplierNumber,
      maxRounds: maxRoundsNumber,
      stopLossCents,
      strategy,
      takeProfitCents,
    }),
    autoBetPayload: buildAutoBetPayload({
      amountCents,
      autoCashoutEnabled,
      autoCashoutParseResult,
      martingaleMaxSteps: martingaleMaxStepsNumber,
      martingaleMultiplier: martingaleMultiplierNumber,
      maxRounds: maxRoundsNumber,
      stopLossCents,
      strategy,
      takeProfitCents,
    }),
    autoCashoutEnabled,
    autoCashoutIsValid: !autoCashoutEnabled || autoCashoutParseResult.valid,
    autoCashoutParseResult,
    onMartingaleMaxStepsChange: (value: string) =>
      setMartingaleMaxSteps(onlyDigits(value)),
    onMartingaleMultiplierChange: (value: string) =>
      setMartingaleMultiplier(onlyDigits(value)),
    onMaxRoundsChange: (value: string) => setMaxRounds(onlyDigits(value)),
    onStopLossChange: (value: string) => setStopLossCents(onlyDigits(value)),
    onTakeProfitChange: (value: string) => setTakeProfitCents(onlyDigits(value)),
    setAutoCashoutEnabled,
    setAutoCashoutTarget,
    setStrategy,
    visibleAutoCashoutEnabled: activeSession
      ? activeSession.autoCashoutMultiplierBp !== null
      : autoCashoutEnabled,
    visibleAutoCashoutParseResult: activeSession?.autoCashoutMultiplierBp
      ? { multiplierBp: activeSession.autoCashoutMultiplierBp, valid: true }
      : autoCashoutParseResult,
    visibleAutoCashoutTarget: activeSession?.autoCashoutMultiplierBp
      ? formatMultiplierInput(activeSession.autoCashoutMultiplierBp)
      : autoCashoutTarget,
    visibleMartingaleMaxSteps: activeSession
      ? String(activeSession.martingaleMaxSteps)
      : martingaleMaxSteps,
    visibleMartingaleMultiplier: activeSession
      ? String(activeSession.martingaleMultiplier)
      : martingaleMultiplier,
    visibleMaxRounds: activeSession ? String(activeSession.maxRounds) : maxRounds,
    visibleStopLossCents: activeSession?.stopLossCents ?? stopLossCents,
    visibleStrategy: activeSession?.strategy ?? strategy,
    visibleTakeProfitCents: activeSession?.takeProfitCents ?? takeProfitCents,
  };
}
