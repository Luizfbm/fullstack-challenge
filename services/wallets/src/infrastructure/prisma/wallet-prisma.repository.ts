import { PrismaClient } from "../../../prisma/generated/client";
import { WalletRepository } from "../../application/ports/wallet.repository";
import { Money } from "../../domain/money";
import { Wallet } from "../../domain/wallet";
import { WalletTransaction } from "../../domain/wallet-transaction";

export class WalletPrismaRepository implements WalletRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByPlayerId(playerId: string): Promise<Wallet | null> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { playerId },
      include: {
        transactions: {
          select: { referenceId: true },
        },
      },
    });

    if (!wallet) {
      return null;
    }

    return Wallet.create({
      id: wallet.id,
      playerId: wallet.playerId,
      balance: Money.fromCents(wallet.balanceCents),
      processedReferenceIds: wallet.transactions.map(
        (transaction) => transaction.referenceId,
      ),
    });
  }

  async create(
    wallet: Wallet,
    transaction: WalletTransaction | null,
  ): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      await prisma.wallet.create({
        data: {
          id: wallet.id,
          playerId: wallet.playerId,
          balanceCents: wallet.balance.cents,
        },
      });

      if (transaction) {
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: transaction.type,
            reason: transaction.reason,
            amountCents: transaction.amount.cents,
            referenceId: transaction.referenceId,
          },
        });
      }
    });
  }

  async save(
    wallet: Wallet,
    transaction: WalletTransaction | null,
  ): Promise<void> {
    if (!transaction) {
      return;
    }

    await this.prisma.$transaction(async (prisma) => {
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balanceCents: wallet.balance.cents,
        },
      });

      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: transaction.type,
          reason: transaction.reason,
          amountCents: transaction.amount.cents,
          referenceId: transaction.referenceId,
        },
      });
    });
  }
}
