import { describe, expect, test } from "bun:test";
import type { WalletInboxRepository } from "../../../src/application/ports/wallet-inbox.repository";
import type {
  WalletInboxCommand,
  WalletInboxResponse,
} from "../../../src/application/wallet-inbox/wallet-inbox-message";
import { WalletCommandHandler } from "../../../src/infrastructure/messaging/wallet-command-handler";

class FakeWalletInboxRepository implements WalletInboxRepository {
  public commands: WalletInboxCommand[] = [];
  public error: unknown = null;

  constructor(private readonly responses: WalletInboxResponse[]) {}

  async process(command: WalletInboxCommand): Promise<WalletInboxResponse> {
    this.commands.push(command);

    if (this.error) {
      throw this.error;
    }

    return (
      this.responses.shift() ?? {
        ok: true,
        data: {
          applied: false,
          balanceCents: "97500",
        },
      }
    );
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

describe("WalletCommandHandler", () => {
  test("delegates wallet debit commands to the inbox repository", async () => {
    const inbox = new FakeWalletInboxRepository([
      {
        ok: true,
        data: {
          applied: true,
          balanceCents: "97500",
        },
      },
    ]);
    const metrics = new FakeWalletMetrics();
    const handler = new WalletCommandHandler(inbox, metrics);

    const response = await handler.handle({
      messageId: "outbox-message-1",
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
    expect(inbox.commands).toEqual([
      {
        messageId: "outbox-message-1",
        pattern: "wallet.debit",
        data: {
          playerId: "player-1",
          amountCents: "2500",
          referenceId: "round:round-1:player:player-1:bet-debit",
          reason: "BET_PLACED",
        },
      },
    ]);
    expect(metrics.commands[0]).toMatchObject({
      command: "debit",
      result: "succeeded",
      amountCents: 2500n,
    });
  });

  test("does not record amount metrics for duplicate inbox successes", async () => {
    const inbox = new FakeWalletInboxRepository([
      {
        ok: true,
        data: {
          applied: false,
          balanceCents: "97500",
        },
      },
    ]);
    const metrics = new FakeWalletMetrics();
    const handler = new WalletCommandHandler(inbox, metrics);

    const response = await handler.handle({
      messageId: "outbox-message-1",
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
        applied: false,
        balanceCents: "97500",
      },
    });
    expect(metrics.commands[0]).toMatchObject({
      command: "debit",
      result: "succeeded",
      amountCents: null,
    });
  });

  test("keeps successful debit response when metrics recording throws", async () => {
    const inbox = new FakeWalletInboxRepository([
      {
        ok: true,
        data: {
          applied: true,
          balanceCents: "97500",
        },
      },
    ]);
    const metrics = new ThrowingWalletMetrics();
    const handler = new WalletCommandHandler(inbox, metrics);

    const response = await handler.handle({
      messageId: "outbox-message-1",
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
  });

  test("delegates wallet credit commands to the inbox repository", async () => {
    const inbox = new FakeWalletInboxRepository([
      {
        ok: true,
        data: {
          applied: true,
          balanceCents: "101500",
        },
      },
    ]);
    const metrics = new FakeWalletMetrics();
    const handler = new WalletCommandHandler(inbox, metrics);

    const response = await handler.handle({
      messageId: "outbox-message-2",
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
    expect(inbox.commands[0]?.pattern).toBe("wallet.credit");
    expect(metrics.commands[0]).toMatchObject({
      command: "credit",
      result: "succeeded",
      amountCents: 1500n,
    });
  });

  test("returns persisted definitive inbox failures", async () => {
    const inbox = new FakeWalletInboxRepository([
      {
        ok: false,
        error: {
          code: "INSUFFICIENT_FUNDS",
          message: "Insufficient funds",
        },
      },
    ]);
    const metrics = new FakeWalletMetrics();
    const handler = new WalletCommandHandler(inbox, metrics);

    const response = await handler.handle({
      messageId: "outbox-message-3",
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
    expect(metrics.commands[0]).toMatchObject({
      command: "debit",
      result: "failed",
      amountCents: null,
      failureReason: "INSUFFICIENT_FUNDS",
    });
  });

  test("returns a structured error for unknown commands", async () => {
    const inbox = new FakeWalletInboxRepository([]);
    const metrics = new FakeWalletMetrics();
    const handler = new WalletCommandHandler(inbox, metrics);

    const response = await handler.handle({
      messageId: "outbox-message-unknown",
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
    expect(inbox.commands).toEqual([]);
    expect(metrics.commands).toEqual([]);
  });

  test("records unexpected inbox exceptions on the active span", async () => {
    const error = new Error("database unavailable");
    const inbox = new FakeWalletInboxRepository([]);
    inbox.error = error;
    const tracer = new FakeTracer();
    const handler = new WalletCommandHandler(
      inbox,
      undefined,
      tracer as never,
    );

    const response = await handler.handle({
      messageId: "outbox-message-4",
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
