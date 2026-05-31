import type { RoundResponse } from "./game-api";
import type { RealtimeRoundPayload } from "./realtime-events";

type TimedRound = RoundResponse | RealtimeRoundPayload;

export function getRoundTimerLabel(
  round: TimedRound | null,
  now = new Date(),
): string {
  if (!round) {
    return "Sincronizando rodada";
  }

  if (round.status === "BETTING") {
    return `Apostas fecham em ${formatSecondsUntil(round.bettingEndsAt, now)}`;
  }

  if (round.status === "RUNNING" && round.startedAt) {
    return `Rodando ha ${formatElapsedSeconds(round.startedAt, now)}`;
  }

  if (round.status === "CRASHED" || round.status === "SETTLED") {
    return round.crashedAt
      ? `Crash em ${formatClock(round.crashedAt)}`
      : "Resultado revelado";
  }

  return "Aguardando inicio";
}

export function getRoundProgress(
  round: TimedRound | null,
  now = new Date(),
): number {
  if (!round) {
    return 0;
  }

  if (round.status === "BETTING") {
    return clampProgress(
      progressBetween(round.bettingStartsAt, round.bettingEndsAt, now),
    );
  }

  if (round.status === "RUNNING" && round.startedAt) {
    return clampProgress(elapsedMs(round.startedAt, now) / 12000);
  }

  return round.status === "CRASHED" || round.status === "SETTLED" ? 1 : 0;
}

function progressBetween(startIso: string, endIso: string, now: Date): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const duration = end - start;

  if (duration <= 0) {
    return 1;
  }

  return (now.getTime() - start) / duration;
}

function elapsedMs(startIso: string, now: Date): number {
  return Math.max(0, now.getTime() - new Date(startIso).getTime());
}

function formatSecondsUntil(targetIso: string, now: Date): string {
  const milliseconds = Math.max(0, new Date(targetIso).getTime() - now.getTime());
  const seconds = Math.ceil(milliseconds / 1000);

  return `${seconds}s`;
}

function formatElapsedSeconds(startIso: string, now: Date): string {
  return `${Math.floor(elapsedMs(startIso, now) / 1000)}s`;
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function clampProgress(value: number): number {
  return Math.min(1, Math.max(0, value));
}
