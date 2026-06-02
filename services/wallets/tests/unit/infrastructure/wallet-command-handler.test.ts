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

class FakeWalletMetrics {
  commands: Array<{
    command: "debit" | "credit";
    result: "succeeded" | "failed";
    durationMs: number;
    amountCents: bigint | null;
    failureReason?: string;
  }> = [];

  recordCommand(
    command: "debit" | "credit",
    result: "succeeded" | "failed",
    durationMs: number,
    amountCents: bigint | null,
    failureReason?: string,
  ): void {
    this.commands.push({
      command,
      result,
      durationMs,
      amountCents,
      failureReason,
    });
  }
}

class ThrowingWalletMetrics extends FakeWalletMetrics {
  recordCommand(
    command: "debit" | "credit",
    result: "succeeded" | "failed",
    durationMs: number,
    amountCents: bigint | null,
    failureReason?: string,
  ): void {
    super.recordCommand(
      command,
      result,
      durationMs,
      amountCents,
      failureReason,
    );
    throw new Error("Metrics unavailable");
  }
}

class FakeSpan {
  recordedExceptions: unknown[] = [];

  setAttributes(): this {
    return this;
  }

  setStatus(): this {
    return this;
  }

  recordException(error: unknown): void {
    this.recordedExceptions.push(error);
  }

  end(): void {}
}

class FakeTracer {
  readonly span = new FakeSpan();

  startActiveSpan<T>(
    _name: string,
    callback: (span: FakeSpan) => Promise<T>,
  ): Promise<T> {
    return callback(this.span);
  }
}

async function createHandler(): Promise<{
  handler: WalletCommandHandler;
  metrics: FakeWalletMetrics;
}>;
async function createHandler(metrics?: FakeWalletMetrics): Promise<{
  handler: WalletCommandHandler;
  metrics: FakeWalletMetrics;
}> {
  const repository = new InMemoryWalletRepository();
  const createWallet = new CreateWalletUseCase(repository, () => "wallet-1");
  const walletMetrics = metrics ?? new FakeWalletMetrics();

  await createWallet.execute({
    playerId: "player-1",
    initialBalanceCents: 100000n,
  });

  return {
    handler: new WalletCommandHandler(
      new DebitWalletUseCase(repository),
      new CreditWalletUseCase(repository),
      walletMetrics,
    ),
    metrics: walletMetrics,
  };
}

describe("WalletCommandHandler", () => {
  test("handles wallet debit commands", async () => {
    const { handler, metrics } = await createHandler();

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

    expect(metrics.commands).toHaveLength(1);
    expect(metrics.commands[0]).toEqual({
      command: "debit",
      result: "succeeded",
      durationMs: expect.any(Number),
      amountCents: 2500n,
      failureReason: undefined,
    });
    expect(metrics.commands[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("does not record debit amount metrics for idempotent retry successes", async () => {
    const { handler, metrics } = await createHandler();
    const command = {
      pattern: "wallet.debit",
      data: {
        playerId: "player-1",
        amountCents: "2500",
        referenceId: "round:round-1:player:player-1:bet-debit",
        reason: "BET_PLACED" as const,
      },
    };

    const firstResponse = await handler.handle(command);
    const secondResponse = await handler.handle(command);

    expect(firstResponse).toEqual({
      ok: true,
      data: {
        applied: true,
        balanceCents: "97500",
      },
    });
    expect(secondResponse).toEqual({
      ok: true,
      data: {
        applied: false,
        balanceCents: "97500",
      },
    });
    expect(metrics.commands).toHaveLength(2);
    expect(metrics.commands[0]).toMatchObject({
      command: "debit",
      result: "succeeded",
      amountCents: 2500n,
    });
    expect(metrics.commands[1]).toMatchObject({
      command: "debit",
      result: "succeeded",
      amountCents: null,
    });
  });

  test("keeps successful debit response when metrics recording throws", async () => {
    const { handler, metrics } = await createHandler(new ThrowingWalletMetrics());

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
    expect(response).not.toEqual({
      ok: false,
      error: {
        code: "WALLET_COMMAND_FAILED",
        message: "Metrics unavailable",
      },
    });
    expect(metrics.commands).toHaveLength(1);
    expect(metrics.commands[0]?.result).toBe("succeeded");
  });

  test("handles wallet credit commands", async () => {
    const { handler, metrics } = await createHandler();

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

    expect(metrics.commands).toHaveLength(1);
    expect(metrics.commands[0]).toEqual({
      command: "credit",
      result: "succeeded",
      durationMs: expect.any(Number),
      amountCents: 1500n,
      failureReason: undefined,
    });
    expect(metrics.commands[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("returns a structured error for insufficient funds", async () => {
    const { handler, metrics } = await createHandler();

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

    expect(metrics.commands).toHaveLength(1);
    expect(metrics.commands[0]).toMatchObject({
      command: "debit",
      result: "failed",
      amountCents: null,
      failureReason: "INSUFFICIENT_FUNDS",
    });
    expect(metrics.commands[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("keeps failed debit response when metrics recording throws", async () => {
    const { handler, metrics } = await createHandler(new ThrowingWalletMetrics());

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
    expect(metrics.commands).toHaveLength(1);
    expect(metrics.commands[0]).toMatchObject({
      command: "debit",
      result: "failed",
      amountCents: null,
      failureReason: "INSUFFICIENT_FUNDS",
    });
  });

  test("returns a structured error for unknown commands", async () => {
    const { handler, metrics } = await createHandler();

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

    expect(metrics.commands).toEqual([]);
  });

  test("records unexpected command exceptions on the active span", async () => {
    const error = new Error("database unavailable");
    const tracer = new FakeTracer();
    const handler = new WalletCommandHandler(
      {
        execute: async () => {
          throw error;
        },
      } as never,
      {
        execute: async () => ({
          applied: true,
          balanceCents: 0n,
        }),
      } as never,
      undefined,
      tracer as never,
    );

    const response = await handler.handle({
      pattern: "wallet.debit",
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
        code: "WALLET_COMMAND_FAILED",
        message: "database unavailable",
      },
    });
    expect(tracer.span.recordedExceptions).toEqual([error]);
  });
});
