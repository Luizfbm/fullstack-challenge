import { Money } from "./money";
import { WalletTransaction, WalletTransactionReason } from "./wallet-transaction";
import { InsufficientFundsError } from "./wallet.errors";

type WalletCreateParams = {
  id: string;
  playerId: string;
  balance: Money;
  processedReferenceIds?: Iterable<string>;
};

type WalletOperationParams = {
  amount: Money;
  referenceId: string;
  reason: WalletTransactionReason;
};

export class Wallet {
  private readonly processedReferenceIds: Set<string>;

  private constructor(
    public readonly id: string,
    public readonly playerId: string,
    private currentBalance: Money,
    processedReferenceIds: Iterable<string>,
  ) {
    this.processedReferenceIds = new Set(processedReferenceIds);
  }

  static create(params: WalletCreateParams): Wallet {
    return new Wallet(
      params.id,
      params.playerId,
      params.balance,
      params.processedReferenceIds ?? [],
    );
  }

  get balance(): Money {
    return this.currentBalance;
  }

  canDebit(amount: Money): boolean {
    return !amount.isGreaterThan(this.currentBalance);
  }

  debit(params: WalletOperationParams): WalletTransaction | null {
    this.assertReferenceId(params.referenceId);

    if (this.hasProcessed(params.referenceId)) {
      return null;
    }

    if (!this.canDebit(params.amount)) {
      throw new InsufficientFundsError();
    }

    this.currentBalance = this.currentBalance.subtract(params.amount);
    this.processedReferenceIds.add(params.referenceId);

    return WalletTransaction.debit(params);
  }

  credit(params: WalletOperationParams): WalletTransaction | null {
    this.assertReferenceId(params.referenceId);

    if (this.hasProcessed(params.referenceId)) {
      return null;
    }

    this.currentBalance = this.currentBalance.add(params.amount);
    this.processedReferenceIds.add(params.referenceId);

    return WalletTransaction.credit(params);
  }

  private hasProcessed(referenceId: string): boolean {
    return this.processedReferenceIds.has(referenceId);
  }

  private assertReferenceId(referenceId: string): void {
    if (referenceId.trim().length === 0) {
      throw new Error("Wallet operation referenceId is required");
    }
  }
}
