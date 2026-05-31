import { Bet } from "../../domain/bet";
import { Round } from "../../domain/round";

export const GAME_REPOSITORY = Symbol("GAME_REPOSITORY");

export interface GameRepository {
  findCurrentRound(): Promise<Round | null>;
  findRoundById(roundId: string): Promise<Round | null>;
  listRoundHistory(limit: number): Promise<Round[]>;
  listBetsByPlayerId(playerId: string, limit: number): Promise<Bet[]>;
  saveRound(round: Round): Promise<void>;
}
