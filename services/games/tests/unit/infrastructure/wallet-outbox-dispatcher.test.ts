import { describe, expect, test } from "bun:test";
import { WalletOperationRejectedError } from "../../../src/application/game.errors";
import type { WalletOutboxRepository } from "../../../src/application/ports/wallet-outbox.repository";
import type {
  NewWalletOutboxMessage,
  WalletOutboxFailure,
  WalletOutboxMessage,
  WalletOutboxSuccess,
} from "../../../src/application/wallet-outbox/wallet-outbox-message";
import { WalletOutboxDispatcher } from "../../../src/infrastructure/messaging/wallet-outbox-dispatcher";

class FakeOutboxRepository implements WalletOutboxRepository {
  public succeeded: Array<{ id: string; result: WalletOutboxSuccess }> = [];
  public failed: Array<{ id: string; failure: WalletOutboxFailure }> = [];
  public claimNextError: unknown = null;
  public retryable: Array<{
    id: string;
    failure: WalletOutboxFailure;
    availableAt: Date;
  }> = [];

  constructor(private message: WalletOutboxMessage | null) {}

  async enqueue(
    message: NewWalletOutboxMessage,
  ): Promise<WalletOutboxMessage> {
    return {
      ...message,
      status: message.status ?? "PENDING",
      attempts: 0,
      availableAt: message.availableAt ?? new Date("2026-06-02T12:00:00.000Z"),
      responseApplied: null,
      responseBalanceCents: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  async findById(): Promise<WalletOutboxMessage | null> {
    return this.message;
  }

  async findByReferenceId(): Promise<WalletOutboxMessage | null> {
    return null;
  }

  async claimNext(): Promise<WalletOutboxMessage | null> {
    if (this.claimNextError) {
      throw this.claimNextError;
    }

    const claimed = this.message;
    this.message = null;
    return claimed;
  }

  async markSucceeded(
    id: string,
    result: WalletOutboxSuccess,
  ): Promise<void> {
    this.succeeded.push({ id, result });
  }

  async markFailed(id: string, failure: WalletOutboxFailure): Promise<void> {
    this.failed.push({ id, failure });
  }

  async releaseForRetry(
    id: string,
    failure: WalletOutboxFailure,
    availableAt: Date,
  ): Promise<void> {
    this.retryable.push({ id, failure, availableAt });
  }
}

class FakeWalletPublisher {
  public published: unknown[] = [];
  public error: unknown = null;

  async publishWalletCommand(command: unknown) {
    this.published.push(command);

    if (this.error) {
      throw this.error;
    }

    return {
      applied: true,
      balanceCents: 97500n,
    };
  }
}

describe("WalletOutboxDispatcher", () => {
  test("dispatches a claimed wallet outbox command and marks it succeeded", async () => {
    const outbox = new FakeOutboxRepository(walletOutboxMessage());
    const publisher = new FakeWalletPublisher();
    const dispatcher = new WalletOutboxDispatcher(outbox, publisher);

    await dispatcher.dispatchNext();

    expect(publisher.published).toEqual([
      {
        messageId: "wallet-outbox-1",
        pattern: "wallet.debit",
        playerId: "player-1",
        amountCents: 2500n,
        referenceId: "round:round-1:player:player-1:bet-debit",
        reason: "BET_PLACED",
      },
    ]);
    expect(outbox.succeeded).toEqual([
      {
        id: "wallet-outbox-1",
        result: {
          applied: true,
          balanceCents: 97500n,
        },
      },
    ]);
  });

  test("marks definitive wallet rejections as failed", async () => {
    const outbox = new FakeOutboxRepository(walletOutboxMessage());
    const publisher = new FakeWalletPublisher();
    publisher.error = new WalletOperationRejectedError(
      "INSUFFICIENT_FUNDS",
      "Insufficient funds",
    );
    const dispatcher = new WalletOutboxDispatcher(outbox, publisher);

    await dispatcher.dispatchNext();

    expect(outbox.failed).toEqual([
      {
        id: "wallet-outbox-1",
        failure: {
          code: "INSUFFICIENT_FUNDS",
          message: "Insufficient funds",
          retryable: false,
        },
      },
    ]);
    expect(outbox.retryable).toEqual([]);
  });

  test("releases transient wallet command errors for retry", async () => {
    const outbox = new FakeOutboxRepository(
      walletOutboxMessage({
        type: "WALLET_CREDIT",
        referenceId: "round:round-1:player:player-1:cashout-credit",
        reason: "CASHOUT_PAYOUT",
      }),
    );
    const publisher = new FakeWalletPublisher();
    publisher.error = new Error("RabbitMQ unavailable");
    const dispatcher = new WalletOutboxDispatcher(outbox, publisher);

    await dispatcher.dispatchNext();

    expect(outbox.retryable).toHaveLength(1);
    expect(outbox.retryable[0]).toMatchObject({
      id: "wallet-outbox-1",
      failure: {
        code: "WALLET_COMMAND_TRANSIENT_FAILURE",
        message: "RabbitMQ unavailable",
        retryable: true,
      },
    });
  });

  test("marks transient debit failures as failed to avoid orphan debits", async () => {
    const outbox = new FakeOutboxRepository(walletOutboxMessage());
    const publisher = new FakeWalletPublisher();
    publisher.error = new Error("RabbitMQ unavailable");
    const dispatcher = new WalletOutboxDispatcher(outbox, publisher);

    await dispatcher.dispatchNext();

    expect(outbox.failed).toEqual([
      {
        id: "wallet-outbox-1",
        failure: {
          code: "WALLET_COMMAND_TRANSIENT_FAILURE",
          message: "RabbitMQ unavailable",
          retryable: false,
        },
      },
    ]);
    expect(outbox.retryable).toEqual([]);
  });

  test("keeps the dispatcher alive when claiming the next message fails", async () => {
    const outbox = new FakeOutboxRepository(walletOutboxMessage());
    outbox.claimNextError = new Error("Postgres unavailable");
    const publisher = new FakeWalletPublisher();
    const dispatcher = new WalletOutboxDispatcher(outbox, publisher);

    await expect(dispatcher.dispatchNext()).resolves.toBeUndefined();

    expect(publisher.published).toEqual([]);
    expect(outbox.succeeded).toEqual([]);
    expect(outbox.failed).toEqual([]);
    expect(outbox.retryable).toEqual([]);
  });
});

function walletOutboxMessage(
  overrides: Partial<WalletOutboxMessage> = {},
): WalletOutboxMessage {
  return {
    id: "wallet-outbox-1",
    type: "WALLET_DEBIT",
    status: "IN_FLIGHT",
    roundId: "round-1",
    betId: "bet-1",
    playerId: "player-1",
    username: "player",
    amountCents: 2500n,
    referenceId: "round:round-1:player:player-1:bet-debit",
    reason: "BET_PLACED",
    attempts: 1,
    availableAt: new Date("2026-06-02T12:00:00.000Z"),
    responseApplied: null,
    responseBalanceCents: null,
    errorCode: null,
    errorMessage: null,
    ...overrides,
  };
}
