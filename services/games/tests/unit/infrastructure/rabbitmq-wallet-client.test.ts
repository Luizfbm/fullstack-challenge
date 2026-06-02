import { describe, expect, mock, test } from "bun:test";

let connectError: Error | null = null;

mock.module("amqplib", () => ({
  connect: async (): Promise<never> => {
    throw connectError ?? new Error("Unexpected RabbitMQ connection attempt");
  },
}));

const { RabbitMqWalletClient } = await import(
  "../../../src/infrastructure/messaging/rabbitmq-wallet.client"
);

class FakeGameMetrics {
  walletCommands: Array<{
    command: "debit" | "credit";
    durationMs: number;
    result: "succeeded" | "failed";
  }> = [];

  recordWalletCommand(
    command: "debit" | "credit",
    durationMs: number,
    result: "succeeded" | "failed",
  ): void {
    this.walletCommands.push({ command, durationMs, result });
  }
}

class ThrowingGameMetrics extends FakeGameMetrics {
  recordWalletCommand(
    command: "debit" | "credit",
    durationMs: number,
    result: "succeeded" | "failed",
  ): void {
    super.recordWalletCommand(command, durationMs, result);
    throw new Error("metrics unavailable");
  }
}

describe("RabbitMqWalletClient", () => {
  test("records failed wallet command metrics when connection fails", async () => {
    connectError = new Error("RabbitMQ unavailable");
    const metrics = new FakeGameMetrics();
    const client = new RabbitMqWalletClient(
      "amqp://unavailable",
      "wallet.commands",
      10,
      metrics,
    );

    await expect(
      client.debit({
        playerId: "player-1",
        amountCents: 1000n,
        referenceId: "round:round-1:player:player-1:bet-debit",
        reason: "BET_PLACED",
      }),
    ).rejects.toThrow("RabbitMQ unavailable");

    expect(metrics.walletCommands).toHaveLength(1);
    expect(metrics.walletCommands[0]).toMatchObject({
      command: "debit",
      result: "failed",
    });
    expect(metrics.walletCommands[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("preserves the original connection error when wallet command metrics throw", async () => {
    connectError = new Error("RabbitMQ unavailable");
    const metrics = new ThrowingGameMetrics();
    const client = new RabbitMqWalletClient(
      "amqp://unavailable",
      "wallet.commands",
      10,
      metrics,
    );

    await expect(
      client.debit({
        playerId: "player-1",
        amountCents: 1000n,
        referenceId: "round:round-1:player:player-1:bet-debit",
        reason: "BET_PLACED",
      }),
    ).rejects.toThrow("RabbitMQ unavailable");

    expect(metrics.walletCommands).toHaveLength(1);
    expect(metrics.walletCommands[0]).toMatchObject({
      command: "debit",
      result: "failed",
    });
  });
});
