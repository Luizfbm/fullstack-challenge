import { Money } from "./money";

export type WalletTransactionType = "DEBIT" | "CREDIT";

export type WalletTransactionReason =
  | "BET_PLACED"
  | "CASHOUT_PAYOUT"
  | "INITIAL_GRANT";

export class WalletTransaction {
  private constructor(
    public readonly type: WalletTransactionType,
    public readonly amount: Money,
    public readonly referenceId: string,
    public readonly reason: WalletTransactionReason,
  ) {}

  static debit(params: {
    amount: Money;
    referenceId: string;
    reason: WalletTransactionReason;
  }): WalletTransaction {
    return new WalletTransaction(
      "DEBIT",
      params.amount,
      params.referenceId,
      params.reason,
    );
  }

  static credit(params: {
    amount: Money;
    referenceId: string;
    reason: WalletTransactionReason;
  }): WalletTransaction {
    return new WalletTransaction(
      "CREDIT",
      params.amount,
      params.referenceId,
      params.reason,
    );
  }
}
