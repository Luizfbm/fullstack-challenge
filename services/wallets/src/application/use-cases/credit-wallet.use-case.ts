import { WalletRepository } from "../ports/wallet.repository";
import { Money } from "../../domain/money";
import { WalletTransactionReason } from "../../domain/wallet-transaction";
import { WalletNotFoundError } from "../wallet.errors";

type CreditWalletInput = {
  playerId: string;
  amountCents: bigint | number | string;
  referenceId: string;
  reason: WalletTransactionReason;
};

type CreditWalletResult = {
  applied: boolean;
  balanceCents: bigint;
};

export class CreditWalletUseCase {
  constructor(private readonly walletRepository: WalletRepository) {}

  async execute(input: CreditWalletInput): Promise<CreditWalletResult> {
    const wallet = await this.walletRepository.findByPlayerId(input.playerId);

    if (!wallet) {
      throw new WalletNotFoundError(input.playerId);
    }

    const transaction = wallet.credit({
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
