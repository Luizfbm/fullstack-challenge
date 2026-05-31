import { WalletRepository } from "../ports/wallet.repository";
import { Wallet } from "../../domain/wallet";
import { WalletNotFoundError } from "../wallet.errors";

type GetWalletInput = {
  playerId: string;
};

export class GetWalletUseCase {
  constructor(private readonly walletRepository: WalletRepository) {}

  async execute(input: GetWalletInput): Promise<Wallet> {
    const wallet = await this.walletRepository.findByPlayerId(input.playerId);

    if (!wallet) {
      throw new WalletNotFoundError(input.playerId);
    }

    return wallet;
  }
}
