import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { WalletOperationRejectedError } from "../../application/game.errors";
import type { WalletOutboxRepository } from "../../application/ports/wallet-outbox.repository";
import type { WalletOutboxMessage } from "../../application/wallet-outbox/wallet-outbox-message";
import type { RabbitMqWalletClient } from "./rabbitmq-wallet.client";

const DEFAULT_INTERVAL_MS = 500;

export class WalletOutboxDispatcher implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly outboxRepository: WalletOutboxRepository,
    private readonly walletPublisher: Pick<
      RabbitMqWalletClient,
      "publishWalletCommand"
    >,
    private readonly intervalMs = DEFAULT_INTERVAL_MS,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.dispatchNext();
    }, this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async dispatchNext(): Promise<void> {
    const message = await this.outboxRepository.claimNext(new Date());

    if (!message) {
      return;
    }

    await this.dispatchMessage(message);
  }

  async dispatchMessage(message: WalletOutboxMessage): Promise<void> {
    try {
      const result = await this.walletPublisher.publishWalletCommand({
        messageId: message.id,
        pattern:
          message.type === "WALLET_DEBIT" ? "wallet.debit" : "wallet.credit",
        playerId: message.playerId,
        amountCents: message.amountCents,
        referenceId: message.referenceId,
        reason: message.reason,
      });

      await this.outboxRepository.markSucceeded(message.id, result);
    } catch (error) {
      if (error instanceof WalletOperationRejectedError) {
        await this.outboxRepository.markFailed(message.id, {
          code: error.code,
          message: error.message,
          retryable: false,
        });
        return;
      }

      const failure = {
        code: "WALLET_COMMAND_TRANSIENT_FAILURE",
        message: error instanceof Error ? error.message : "Wallet command failed",
        retryable: message.type === "WALLET_CREDIT",
      };

      if (!failure.retryable) {
        await this.outboxRepository.markFailed(message.id, failure);
        return;
      }

      await this.outboxRepository.releaseForRetry(
        message.id,
        failure,
        new Date(Date.now() + this.retryDelayMs(message.attempts)),
      );
    }
  }

  private retryDelayMs(attempts: number): number {
    return Math.min(30000, 500 * 2 ** Math.max(0, attempts - 1));
  }
}
