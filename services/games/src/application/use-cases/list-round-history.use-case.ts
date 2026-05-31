import { DEFAULT_ROUND_HISTORY_LIMIT } from "../game.constants";
import { GameRepository } from "../ports/game.repository";
import { Round } from "../../domain/round";

type ListRoundHistoryInput = {
  limit?: number;
};

export class ListRoundHistoryUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  async execute(input: ListRoundHistoryInput = {}): Promise<Round[]> {
    const limit = input.limit ?? DEFAULT_ROUND_HISTORY_LIMIT;

    return this.gameRepository.listRoundHistory(limit);
  }
}
