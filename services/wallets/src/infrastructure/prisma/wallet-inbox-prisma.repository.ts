import { PrismaClient } from "../../../prisma/generated/client";
import type { WalletInboxRepository } from "../../application/ports/wallet-inbox.repository";
import type {
  WalletInboxCommand,
  WalletInboxResponse,
} from "../../application/wallet-inbox/wallet-inbox-message";

type WalletPrismaTransaction = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

type StoredInboxResponse = {
  responseOk: boolean | null;
  responseBalanceCents: bigint | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export class WalletInboxPrismaRepository implements WalletInboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async process(command: WalletInboxCommand): Promise<WalletInboxResponse> {
    return this.prisma.$transaction(async (prisma) => {
      const existing = await prisma.walletInboxMessage.findUnique({
        where: { referenceId: command.data.referenceId },
      });

      if (existing?.status === "PROCESSED" || existing?.status === "FAILED") {
        return this.toDuplicateResponse(existing);
      }

      if (!existing) {
        await prisma.walletInboxMessage.create({
          data: {
            messageId: command.messageId,
            pattern: command.pattern,
            playerId: command.data.playerId,
            amountCents: BigInt(command.data.amountCents),
            referenceId: command.data.referenceId,
            reason: command.data.reason,
            status: "RECEIVED",
          },
        });
      }

      const wallet = await prisma.wallet.findUnique({
        where: { playerId: command.data.playerId },
      });

      if (!wallet) {
        const response: WalletInboxResponse = {
          ok: false,
          error: {
            code: "WALLET_NOT_FOUND",
            message: `Wallet not found for player ${command.data.playerId}`,
          },
        };
        await this.persistResponse(prisma, command.data.referenceId, response);

        return response;
      }

      const amountCents = BigInt(command.data.amountCents);

      if (command.pattern === "wallet.debit" && wallet.balanceCents < amountCents) {
        const response: WalletInboxResponse = {
          ok: false,
          error: {
            code: "INSUFFICIENT_FUNDS",
            message: "Insufficient funds",
          },
        };
        await this.persistResponse(prisma, command.data.referenceId, response);

        return response;
      }

      const nextBalance =
        command.pattern === "wallet.debit"
          ? wallet.balanceCents - amountCents
          : wallet.balanceCents + amountCents;

      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: nextBalance },
      });
      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: command.pattern === "wallet.debit" ? "DEBIT" : "CREDIT",
          reason: command.data.reason,
          amountCents,
          referenceId: command.data.referenceId,
        },
      });

      const response: WalletInboxResponse = {
        ok: true,
        data: {
          applied: true,
          balanceCents: nextBalance.toString(),
        },
      };
      await this.persistResponse(prisma, command.data.referenceId, response);

      return response;
    });
  }

  private async persistResponse(
    prisma: WalletPrismaTransaction,
    referenceId: string,
    response: WalletInboxResponse,
  ): Promise<void> {
    await prisma.walletInboxMessage.update({
      where: { referenceId },
      data: {
        status: response.ok ? "PROCESSED" : "FAILED",
        responseOk: response.ok,
        responseApplied: response.ok ? response.data.applied : null,
        responseBalanceCents: response.ok
          ? BigInt(response.data.balanceCents)
          : null,
        errorCode: response.ok ? null : response.error.code,
        errorMessage: response.ok ? null : response.error.message,
        processedAt: new Date(),
      },
    });
  }

  private toDuplicateResponse(
    message: StoredInboxResponse,
  ): WalletInboxResponse {
    if (message.responseOk) {
      return {
        ok: true,
        data: {
          applied: false,
          balanceCents: String(message.responseBalanceCents ?? 0n),
        },
      };
    }

    return {
      ok: false,
      error: {
        code: message.errorCode ?? "WALLET_COMMAND_FAILED",
        message: message.errorMessage ?? "Wallet command failed",
      },
    };
  }
}
