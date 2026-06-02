import type { WalletOperationResult } from "../ports/wallet.client";

export type WalletOutboxStatus =
  | "PENDING"
  | "IN_FLIGHT"
  | "SUCCEEDED"
  | "FAILED"
  | "RETRYABLE";

export type WalletOutboxType = "WALLET_DEBIT" | "WALLET_CREDIT";

export type WalletOutboxReason = "BET_PLACED" | "CASHOUT_PAYOUT";

export type WalletOutboxMessage = {
  id: string;
  type: WalletOutboxType;
  status: WalletOutboxStatus;
  roundId: string;
  betId: string | null;
  playerId: string;
  username: string | null;
  amountCents: bigint;
  referenceId: string;
  reason: WalletOutboxReason;
  attempts: number;
  availableAt: Date;
  responseApplied: boolean | null;
  responseBalanceCents: bigint | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type NewWalletOutboxMessage = Omit<
  WalletOutboxMessage,
  | "status"
  | "attempts"
  | "availableAt"
  | "responseApplied"
  | "responseBalanceCents"
  | "errorCode"
  | "errorMessage"
> & {
  status?: WalletOutboxStatus;
  availableAt?: Date;
};

export type WalletOutboxSuccess = WalletOperationResult;

export type WalletOutboxFailure = {
  code: string;
  message: string;
  retryable: boolean;
};
