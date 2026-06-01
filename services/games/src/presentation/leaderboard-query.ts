import { BadRequestException } from "@nestjs/common";
import type { LeaderboardPeriod } from "../application/ports/game.repository";

export function parseLeaderboardPeriod(period?: string): LeaderboardPeriod {
  if (!period) {
    return "24h";
  }

  if (period === "24h" || period === "7d") {
    return period;
  }

  throw new BadRequestException("period must be 24h or 7d");
}

export function parseLeaderboardLimit(limit?: string): number {
  if (!limit) {
    return 10;
  }

  const parsed = Number(limit);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 50) {
    throw new BadRequestException("limit must be between 1 and 50");
  }

  return parsed;
}
