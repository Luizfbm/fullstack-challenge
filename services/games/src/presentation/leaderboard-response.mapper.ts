import type { LeaderboardEntry } from "../application/ports/game.repository";
import { LeaderboardEntryDto } from "./dtos/leaderboard-response.dto";

export function toLeaderboardEntryResponse(
  entry: LeaderboardEntry,
): LeaderboardEntryDto {
  return {
    betsCount: entry.betsCount,
    payoutCents: entry.payoutCents.toString(),
    playerId: entry.playerId,
    profitCents: entry.profitCents.toString(),
    rank: entry.rank,
    username: entry.username,
    wageredCents: entry.wageredCents.toString(),
  };
}
