import { describe, expect, test } from "bun:test";
import { CreateWalletUseCase } from "../../../src/application/use-cases/create-wallet.use-case";
import { WalletRepository } from "../../../src/application/ports/wallet.repository";
import { Wallet } from "../../../src/domain/wallet";
import { WalletTransaction } from "../../../src/domain/wallet-transaction";
import { DevelopmentWalletSeeder } from "../../../src/infrastructure/seed/development-wallet-seeder";

class InMemoryWalletRepository implements WalletRepository {
  private readonly wallets = new Map<string, Wallet>();

  async findByPlayerId(playerId: string): Promise<Wallet | null> {
    return this.wallets.get(playerId) ?? null;
  }

  async create(
    wallet: Wallet,
    _transaction: WalletTransaction | null,
  ): Promise<void> {
    this.wallets.set(wallet.playerId, wallet);
  }

  async save(
    wallet: Wallet,
    _transaction: WalletTransaction | null,
  ): Promise<void> {
    this.wallets.set(wallet.playerId, wallet);
  }
}

describe("DevelopmentWalletSeeder", () => {
  test("creates the configured player wallet once", async () => {
    const repository = new InMemoryWalletRepository();
    const createWalletUseCase = new CreateWalletUseCase(
      repository,
      () => "wallet-1",
    );
    const seeder = new DevelopmentWalletSeeder(createWalletUseCase, {
      playerId: "player-1",
      initialBalanceCents: "100000",
    });

    await seeder.seed();
    await seeder.seed();

    const wallet = await repository.findByPlayerId("player-1");

    expect(wallet?.balance.cents).toBe(100000n);
  });

  test("does nothing when no seed player id is configured", async () => {
    const repository = new InMemoryWalletRepository();
    const createWalletUseCase = new CreateWalletUseCase(
      repository,
      () => "wallet-1",
    );
    const seeder = new DevelopmentWalletSeeder(createWalletUseCase, {
      initialBalanceCents: "100000",
    });

    await seeder.seed();

    expect(await repository.findByPlayerId("player-1")).toBeNull();
  });

  test("rejects invalid initial balance configuration", async () => {
    const repository = new InMemoryWalletRepository();
    const createWalletUseCase = new CreateWalletUseCase(
      repository,
      () => "wallet-1",
    );
    const seeder = new DevelopmentWalletSeeder(createWalletUseCase, {
      playerId: "player-1",
      initialBalanceCents: "not-a-number",
    });

    await expect(seeder.seed()).rejects.toThrow(
      "Invalid INITIAL_WALLET_BALANCE_CENTS value: not-a-number",
    );
  });
});
