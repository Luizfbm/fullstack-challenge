import { describe, expect, test } from "bun:test";
import { WalletRepository } from "../../../src/application/ports/wallet.repository";
import { CreateWalletUseCase } from "../../../src/application/use-cases/create-wallet.use-case";
import { CreditWalletUseCase } from "../../../src/application/use-cases/credit-wallet.use-case";
import { DebitWalletUseCase } from "../../../src/application/use-cases/debit-wallet.use-case";
import { WalletCommandHandler } from "../../../src/infrastructure/messaging/wallet-command-handler";
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

async function createHandler(): Promise<WalletCommandHandler> {
  const repository = new InMemoryWalletRepository();
  const createWallet = new CreateWalletUseCase(repository, () => "wallet-1");

  await createWallet.execute({
    playerId: "player-1",
    initialBalanceCents: 100000n,
  });

  return new WalletCommandHandler(
    new DebitWalletUseCase(repository),
    new CreditWalletUseCase(repository),
  );
}

describe("WalletCommandHandler", () => {
  test("handles wallet debit commands", async () => {
    const handler = await createHandler();

    const response = await handler.handle({
      pattern: "wallet.debit",
      data: {
        playerId: "player-1",
        amountCents: "2500",
        referenceId: "round:round-1:player:player-1:bet-debit",
        reason: "BET_PLACED",
      },
    });

    expect(response).toEqual({
      ok: true,
      data: {
        applied: true,
        balanceCents: "97500",
      },
    });
  });

  test("handles wallet credit commands", async () => {
    const handler = await createHandler();

    const response = await handler.handle({
      pattern: "wallet.credit",
      data: {
        playerId: "player-1",
        amountCents: "1500",
        referenceId: "round:round-1:player:player-1:cashout-credit",
        reason: "CASHOUT_PAYOUT",
      },
    });

    expect(response).toEqual({
      ok: true,
      data: {
        applied: true,
        balanceCents: "101500",
      },
    });
  });

  test("returns a structured error for insufficient funds", async () => {
    const handler = await createHandler();

    const response = await handler.handle({
      pattern: "wallet.debit",
      data: {
        playerId: "player-1",
        amountCents: "100001",
        referenceId: "round:round-1:player:player-1:bet-debit",
        reason: "BET_PLACED",
      },
    });

    expect(response).toEqual({
      ok: false,
      error: {
        code: "INSUFFICIENT_FUNDS",
        message: "Insufficient funds",
      },
    });
  });

  test("returns a structured error for unknown commands", async () => {
    const handler = await createHandler();

    const response = await handler.handle({
      pattern: "wallet.unknown",
      data: {
        playerId: "player-1",
        amountCents: "100",
        referenceId: "reference",
        reason: "BET_PLACED",
      },
    });

    expect(response).toEqual({
      ok: false,
      error: {
        code: "UNKNOWN_WALLET_COMMAND",
        message: "Unknown wallet command: wallet.unknown",
      },
    });
  });
});
