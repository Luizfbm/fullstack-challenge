import { Bet } from "../../domain/bet";
import { Round } from "../../domain/round";
import type {
  NewWalletOutboxMessage,
  WalletOutboxMessage,
} from "../wallet-outbox/wallet-outbox-message";

export const GAME_REPOSITORY = Symbol("GAME_REPOSITORY");

export type LeaderboardPeriod = "24h" | "7d";

export type LeaderboardEntry = {
  rank: number;
  playerId: string;
  username: string;
  profitCents: bigint;
  wageredCents: bigint;
  payoutCents: bigint;
  betsCount: number;
};

export type ListLeaderboardInput = {
  since: Date;
  limit: number;
};

export interface GameRepository {
  findCurrentRound(): Promise<Round | null>;
  findLatestRound(): Promise<Round | null>;
  findRoundById(roundId: string): Promise<Round | null>;
  listRoundHistory(limit: number): Promise<Round[]>;
  listBetsByPlayerId(playerId: string, limit: number): Promise<Bet[]>;
  listLeaderboard(input: ListLeaderboardInput): Promise<LeaderboardEntry[]>;
  saveRound(round: Round): Promise<void>;
  saveRoundWithWalletOutbox(
    round: Round,
    message: NewWalletOutboxMessage,
  ): Promise<WalletOutboxMessage>;
}
