import { WalletRepository } from "../ports/wallet.repository";
import { Money } from "../../domain/money";
import { Wallet } from "../../domain/wallet";

type CreateWalletInput = {
  playerId: string;
  initialBalanceCents?: bigint | number | string;
};

type CreateWalletResult = {
  created: boolean;
  wallet: Wallet;
};

export class CreateWalletUseCase {
  constructor(
    private readonly walletRepository: WalletRepository,
    private readonly idGenerator: () => string,
  ) {}

  async execute(input: CreateWalletInput): Promise<CreateWalletResult> {
    const existingWallet = await this.walletRepository.findByPlayerId(
      input.playerId,
    );

    if (existingWallet) {
      return { created: false, wallet: existingWallet };
    }

    const wallet = Wallet.create({
      id: this.idGenerator(),
      playerId: input.playerId,
      balance: Money.zero(),
    });

    const initialBalance = Money.fromCents(input.initialBalanceCents ?? 0n);
    const transaction =
      initialBalance.cents > 0n
        ? wallet.credit({
            amount: initialBalance,
            referenceId: `wallet:${input.playerId}:initial-grant`,
            reason: "INITIAL_GRANT",
          })
        : null;

    await this.walletRepository.create(wallet, transaction);

    return { created: true, wallet };
  }
}
