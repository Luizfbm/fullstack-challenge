import { GameRepository } from "../ports/game.repository";
import { Round } from "../../domain/round";

export class GetCurrentRoundUseCase {
  constructor(private readonly gameRepository: GameRepository) {}

  async execute(): Promise<Round | null> {
    return this.gameRepository.findCurrentRound();
  }
}
