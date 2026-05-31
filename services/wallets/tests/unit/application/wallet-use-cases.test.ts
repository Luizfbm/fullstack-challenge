import { describe, expect, test } from "bun:test";
import { CreateWalletUseCase } from "../../../src/application/use-cases/create-wallet.use-case";
import { CreditWalletUseCase } from "../../../src/application/use-cases/credit-wallet.use-case";
import { DebitWalletUseCase } from "../../../src/application/use-cases/debit-wallet.use-case";
import { GetWalletUseCase } from "../../../src/application/use-cases/get-wallet.use-case";
import { WalletRepository } from "../../../src/application/ports/wallet.repository";
import { WalletNotFoundError } from "../../../src/application/wallet.errors";
import { Wallet } from "../../../src/domain/wallet";
import { WalletTransaction } from "../../../src/domain/wallet-transaction";

class InMemoryWalletRepository implements WalletRepository {
  private readonly wallets = new Map<string, Wallet>();

  async findByPlayerId(playerId: string): Promise<Wallet | null> {
    return this.wallets.get(playerId) ?? null;
  }

  async create(wallet: Wallet): Promise<void> {
    this.wallets.set(wallet.playerId, wallet);
  }

  async save(
    wallet: Wallet,
    _transaction: WalletTransaction | null,
  ): Promise<void> {
    this.wallets.set(wallet.playerId, wallet);
  }
}

describe("Wallet use cases", () => {
  test("creates a wallet with an initial grant", async () => {
    const repository = new InMemoryWalletRepository();
    const useCase = new CreateWalletUseCase(repository, () => "wallet-1");

    const result = await useCase.execute({
      playerId: "player-1",
      initialBalanceCents: 100000n,
    });

    expect(result.created).toBe(true);
    expect(result.wallet.balance.cents).toBe(100000n);
  });

  test("does not recreate an existing wallet", async () => {
    const repository = new InMemoryWalletRepository();
    const useCase = new CreateWalletUseCase(repository, () => "wallet-1");

    await useCase.execute({
      playerId: "player-1",
      initialBalanceCents: 100000n,
    });

    const result = await useCase.execute({
      playerId: "player-1",
      initialBalanceCents: 100000n,
    });

    expect(result.created).toBe(false);
    expect(result.wallet.balance.cents).toBe(100000n);
  });

  test("gets an existing wallet", async () => {
    const repository = new InMemoryWalletRepository();
    const createWallet = new CreateWalletUseCase(repository, () => "wallet-1");
    const getWallet = new GetWalletUseCase(repository);

    await createWallet.execute({
      playerId: "player-1",
      initialBalanceCents: 100000n,
    });

    const wallet = await getWallet.execute({ playerId: "player-1" });

    expect(wallet.balance.cents).toBe(100000n);
  });

  test("debits a wallet through the domain", async () => {
    const repository = new InMemoryWalletRepository();
    const createWallet = new CreateWalletUseCase(repository, () => "wallet-1");
    const debitWallet = new DebitWalletUseCase(repository);

    await createWallet.execute({
      playerId: "player-1",
      initialBalanceCents: 100000n,
    });

    const result = await debitWallet.execute({
      playerId: "player-1",
      amountCents: 2500n,
      referenceId: "bet:bet-1:debit",
      reason: "BET_PLACED",
    });

    expect(result.applied).toBe(true);
    expect(result.balanceCents).toBe(97500n);
  });

  test("reports duplicate debit references without changing the balance", async () => {
    const repository = new InMemoryWalletRepository();
    const createWallet = new CreateWalletUseCase(repository, () => "wallet-1");
    const debitWallet = new DebitWalletUseCase(repository);

    await createWallet.execute({
      playerId: "player-1",
      initialBalanceCents: 100000n,
    });

    await debitWallet.execute({
      playerId: "player-1",
      amountCents: 2500n,
      referenceId: "bet:bet-1:debit",
      reason: "BET_PLACED",
    });

    const duplicate = await debitWallet.execute({
      playerId: "player-1",
      amountCents: 2500n,
      referenceId: "bet:bet-1:debit",
      reason: "BET_PLACED",
    });

    expect(duplicate.applied).toBe(false);
    expect(duplicate.balanceCents).toBe(97500n);
  });

  test("credits a wallet through the domain", async () => {
    const repository = new InMemoryWalletRepository();
    const createWallet = new CreateWalletUseCase(repository, () => "wallet-1");
    const creditWallet = new CreditWalletUseCase(repository);

    await createWallet.execute({
      playerId: "player-1",
      initialBalanceCents: 100000n,
    });

    const result = await creditWallet.execute({
      playerId: "player-1",
      amountCents: 12500n,
      referenceId: "bet:bet-1:cashout-credit",
      reason: "CASHOUT_PAYOUT",
    });

    expect(result.applied).toBe(true);
    expect(result.balanceCents).toBe(112500n);
  });

  test("throws when debiting a missing wallet", async () => {
    const repository = new InMemoryWalletRepository();
    const debitWallet = new DebitWalletUseCase(repository);

    await expect(
      debitWallet.execute({
        playerId: "missing-player",
        amountCents: 100n,
        referenceId: "bet:bet-1:debit",
        reason: "BET_PLACED",
      }),
    ).rejects.toThrow(WalletNotFoundError);
  });
});
