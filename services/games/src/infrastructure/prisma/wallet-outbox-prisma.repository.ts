import { PrismaClient } from "../../../prisma/generated/client";
import type { WalletOutboxRepository } from "../../application/ports/wallet-outbox.repository";
import type {
  NewWalletOutboxMessage,
  WalletOutboxFailure,
  WalletOutboxMessage,
  WalletOutboxSuccess,
} from "../../application/wallet-outbox/wallet-outbox-message";
import {
  toWalletOutboxCreateData,
  toWalletOutboxMessage,
} from "./wallet-outbox.mapper";

export class WalletOutboxPrismaRepository implements WalletOutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(
    message: NewWalletOutboxMessage,
  ): Promise<WalletOutboxMessage> {
    const created = await this.prisma.walletOutboxMessage.create({
      data: toWalletOutboxCreateData(message),
    });

    return toWalletOutboxMessage(created);
  }

  async findById(id: string): Promise<WalletOutboxMessage | null> {
    const message = await this.prisma.walletOutboxMessage.findUnique({
      where: { id },
    });

    return message ? toWalletOutboxMessage(message) : null;
  }

  async findByReferenceId(
    referenceId: string,
  ): Promise<WalletOutboxMessage | null> {
    const message = await this.prisma.walletOutboxMessage.findUnique({
      where: { referenceId },
    });

    return message ? toWalletOutboxMessage(message) : null;
  }

  async claimNext(now: Date): Promise<WalletOutboxMessage | null> {
    const candidate = await this.prisma.walletOutboxMessage.findFirst({
      where: {
        status: { in: ["PENDING", "RETRYABLE"] },
        availableAt: { lte: now },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!candidate) {
      return null;
    }

    const claimed = await this.prisma.walletOutboxMessage.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
      },
      data: {
        status: "IN_FLIGHT",
        lockedAt: now,
        attempts: { increment: 1 },
      },
    });

    if (claimed.count === 0) {
      return null;
    }

    return this.findById(candidate.id);
  }

  async markSucceeded(
    id: string,
    result: WalletOutboxSuccess,
  ): Promise<void> {
    await this.prisma.walletOutboxMessage.update({
      where: { id },
      data: {
        status: "SUCCEEDED",
        responseApplied: result.applied,
        responseBalanceCents: result.balanceCents,
        errorCode: null,
        errorMessage: null,
      },
    });
  }

  async markFailed(id: string, failure: WalletOutboxFailure): Promise<void> {
    await this.prisma.walletOutboxMessage.update({
      where: { id },
      data: {
        status: "FAILED",
        errorCode: failure.code,
        errorMessage: failure.message,
      },
    });
  }

  async releaseForRetry(
    id: string,
    failure: WalletOutboxFailure,
    availableAt: Date,
  ): Promise<void> {
    await this.prisma.walletOutboxMessage.update({
      where: { id },
      data: {
        status: "RETRYABLE",
        availableAt,
        errorCode: failure.code,
        errorMessage: failure.message,
      },
    });
  }

}
