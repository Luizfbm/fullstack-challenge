import { DEFAULT_PLAYER_BETS_LIMIT } from "../game.constants";
import { GameRepository } from "../ports/game.repository";
import { Bet } from "../../domain/bet";

type ListMyBetsInput = {
  playerId: string;
  limit?: number;
};

export class ListMyBetsUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  async execute(input: ListMyBetsInput): Promise<Bet[]> {
    const limit = input.limit ?? DEFAULT_PLAYER_BETS_LIMIT;

    return this.gameRepository.listBetsByPlayerId(input.playerId, limit);
  }
}
