import { LeaderboardEntry } from "./ports/game.repository";

export type LeaderboardBet = {
  playerId: string;
  username: string;
  amountCents: bigint;
  payoutCents: bigint | null;
  status: string;
};

type LeaderboardAccumulator = Omit<LeaderboardEntry, "rank" | "profitCents">;

export function rankLeaderboardBets(
  bets: LeaderboardBet[],
  limit: number,
): LeaderboardEntry[] {
  const players = new Map<string, LeaderboardAccumulator>();

  for (const bet of bets) {
    const payoutCents = getResolvedPayoutCents(bet);

    if (payoutCents === null) {
      continue;
    }

    const key = `${bet.playerId}\u0000${bet.username}`;
    const current =
      players.get(key) ??
      ({
        betsCount: 0,
        payoutCents: 0n,
        playerId: bet.playerId,
        username: bet.username,
        wageredCents: 0n,
      } satisfies LeaderboardAccumulator);

    current.betsCount += 1;
    current.payoutCents += payoutCents;
    current.wageredCents += bet.amountCents;
    players.set(key, current);
  }

  return [...players.values()]
    .map((entry) => ({
      ...entry,
      profitCents: entry.payoutCents - entry.wageredCents,
      rank: 0,
    }))
    .sort(compareLeaderboardEntries)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
    .slice(0, limit);
}

function getResolvedPayoutCents(bet: LeaderboardBet): bigint | null {
  if (bet.status === "LOST") {
    return 0n;
  }

  if (bet.status === "CASHED_OUT") {
    return bet.payoutCents;
  }

  return null;
}

function compareLeaderboardEntries(
  left: LeaderboardEntry,
  right: LeaderboardEntry,
): number {
  return (
    compareBigIntDesc(left.profitCents, right.profitCents) ||
    compareBigIntDesc(left.payoutCents, right.payoutCents) ||
    compareBigIntDesc(left.wageredCents, right.wageredCents) ||
    left.username.localeCompare(right.username) ||
    left.playerId.localeCompare(right.playerId)
  );
}

function compareBigIntDesc(left: bigint, right: bigint): number {
  if (left > right) {
    return -1;
  }

  if (left < right) {
    return 1;
  }

  return 0;
}
