export const WALLET_CLIENT = Symbol("WALLET_CLIENT");

export type WalletOperationReason = "BET_PLACED" | "CASHOUT_PAYOUT";

export type WalletOperationInput = {
  playerId: string;
  amountCents: bigint;
  referenceId: string;
  reason: WalletOperationReason;
};

export type WalletOperationResult = {
  applied: boolean;
  balanceCents: bigint;
};

export interface WalletClient {
  debit(input: WalletOperationInput): Promise<WalletOperationResult>;
  credit(input: WalletOperationInput): Promise<WalletOperationResult>;
}
