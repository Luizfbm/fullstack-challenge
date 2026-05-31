import { WalletRepository } from "../ports/wallet.repository";
import { Money } from "../../domain/money";
import { WalletTransactionReason } from "../../domain/wallet-transaction";
import { WalletNotFoundError } from "../wallet.errors";

type DebitWalletInput = {
  playerId: string;
  amountCents: bigint | number | string;
  referenceId: string;
  reason: WalletTransactionReason;
};

type DebitWalletResult = {
  applied: boolean;
  balanceCents: bigint;
};

export class DebitWalletUseCase {
  constructor(private readonly walletRepository: WalletRepository) {}

  async execute(input: DebitWalletInput): Promise<DebitWalletResult> {
    const wallet = await this.walletRepository.findByPlayerId(input.playerId);

    if (!wallet) {
      throw new WalletNotFoundError(input.playerId);
    }

    const transaction = wallet.debit({
      amount: Money.fromCents(input.amountCents),
      referenceId: input.referenceId,
      reason: input.reason,
    });

    await this.walletRepository.save(wallet, transaction);

    return {
      applied: transaction !== null,
      balanceCents: wallet.balance.cents,
    };
  }
}
