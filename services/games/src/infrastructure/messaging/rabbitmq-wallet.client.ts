import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import * as amqp from "amqplib";
import type { Channel, ChannelModel, ConsumeMessage } from "amqplib";
import {
  WalletOperationRejectedError,
  WalletOperationTimedOutError,
} from "../../application/game.errors";
import {
  WalletClient,
  WalletOperationInput,
  WalletOperationResult,
} from "../../application/ports/wallet.client";
import type { GameMetrics } from "../observability/game-metrics";

const WALLET_COMMAND_QUEUE = "wallet.commands";
const DEFAULT_TIMEOUT_MS = 2000;

type WalletCommandResponse =
  | {
      ok: true;
      data: {
        applied: boolean;
        balanceCents: string;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type PendingRequest = {
  resolve: (result: WalletOperationResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

type GameMetricsPort = Pick<GameMetrics, "recordWalletCommand">;

export class RabbitMqWalletClient
  implements WalletClient, OnModuleInit, OnModuleDestroy
{
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private replyQueueName: string | null = null;
  private connectPromise: Promise<void> | null = null;
  private readonly pending = new Map<string, PendingRequest>();

  constructor(
    private readonly rabbitMqUrl: string,
    private readonly queueName = WALLET_COMMAND_QUEUE,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
    private readonly gameMetrics?: GameMetricsPort,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureConnected();
  }

  async onModuleDestroy(): Promise<void> {
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error("Wallet RPC client closed"));
    }

    this.pending.clear();
    await this.channel?.close();
    await this.connection?.close();
  }

  async debit(input: WalletOperationInput): Promise<WalletOperationResult> {
    return this.send("wallet.debit", input);
  }

  async credit(input: WalletOperationInput): Promise<WalletOperationResult> {
    return this.send("wallet.credit", input);
  }

  private async send(
    pattern: "wallet.debit" | "wallet.credit",
    input: WalletOperationInput,
  ): Promise<WalletOperationResult> {
    const startedAt = performance.now();
    const command = pattern === "wallet.debit" ? "debit" : "credit";
    let recorded = false;
    const recordWalletCommand = (result: "succeeded" | "failed"): void => {
      if (recorded) {
        return;
      }

      recorded = true;
      try {
        this.gameMetrics?.recordWalletCommand(
          command,
          performance.now() - startedAt,
          result,
        );
      } catch {
        // Metrics are best-effort and must not alter wallet RPC behavior.
      }
    };

    try {
      await this.ensureConnected();

      const channel = this.channel;
      const replyQueueName = this.replyQueueName;

      if (!channel || !replyQueueName) {
        throw new Error("Wallet RPC client is not connected");
      }

      const correlationId = randomUUID();
      const payload = {
        pattern,
        data: {
          ...input,
          amountCents: input.amountCents.toString(),
        },
      };

      return await new Promise<WalletOperationResult>((resolve, reject) => {
        const resolveWithMetrics = (result: WalletOperationResult): void => {
          recordWalletCommand("succeeded");
          resolve(result);
        };
        const rejectWithMetrics = (error: Error): void => {
          recordWalletCommand("failed");
          reject(error);
        };
        const timeout = setTimeout(() => {
          this.pending.delete(correlationId);
          rejectWithMetrics(new WalletOperationTimedOutError(this.timeoutMs));
        }, this.timeoutMs);

        this.pending.set(correlationId, {
          resolve: resolveWithMetrics,
          reject: rejectWithMetrics,
          timeout,
        });

        try {
          channel.sendToQueue(
            this.queueName,
            Buffer.from(JSON.stringify(payload)),
            {
              correlationId,
              replyTo: replyQueueName,
              contentType: "application/json",
              persistent: true,
            },
          );
        } catch (error) {
          clearTimeout(timeout);
          this.pending.delete(correlationId);
          rejectWithMetrics(
            error instanceof Error ? error : new Error("Wallet RPC failed"),
          );
        }
      });
    } catch (error) {
      recordWalletCommand("failed");
      throw error;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.channel && this.replyQueueName) {
      return;
    }

    this.connectPromise ??= this.connect().finally(() => {
      this.connectPromise = null;
    });
    await this.connectPromise;
  }

  private async connect(): Promise<void> {
    this.connection = await amqp.connect(this.rabbitMqUrl);
    this.channel = await this.connection.createChannel();

    await this.channel.assertQueue(this.queueName, { durable: true });
    const replyQueue = await this.channel.assertQueue("", {
      durable: false,
      exclusive: true,
    });

    this.replyQueueName = replyQueue.queue;
    await this.channel.consume(
      this.replyQueueName,
      (message) => this.handleReply(message),
      { noAck: true },
    );
  }

  private handleReply(message: ConsumeMessage | null): void {
    if (!message?.properties.correlationId) {
      return;
    }

    const correlationId = message.properties.correlationId;
    const pending = this.pending.get(correlationId);

    if (!pending) {
      return;
    }

    this.pending.delete(correlationId);
    clearTimeout(pending.timeout);

    try {
      const response = JSON.parse(
        message.content.toString(),
      ) as WalletCommandResponse;

      if (response.ok) {
        pending.resolve({
          applied: response.data.applied,
          balanceCents: BigInt(response.data.balanceCents),
        });
        return;
      }

      pending.reject(
        new WalletOperationRejectedError(
          response.error.code,
          response.error.message,
        ),
      );
    } catch (error) {
      pending.reject(
        error instanceof Error ? error : new Error("Invalid wallet RPC reply"),
      );
    }
  }
}
