import type { BetResponse, RoundResponse } from "../../services/game-api";

export function getRoundBets(round: RoundResponse | null): BetResponse[] {
  return Array.isArray(round?.bets) ? round.bets : [];
}
