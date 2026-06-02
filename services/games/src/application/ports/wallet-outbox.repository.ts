import type {
  NewWalletOutboxMessage,
  WalletOutboxFailure,
  WalletOutboxMessage,
  WalletOutboxSuccess,
} from "../wallet-outbox/wallet-outbox-message";

export const WALLET_OUTBOX_REPOSITORY = Symbol("WALLET_OUTBOX_REPOSITORY");

export interface WalletOutboxRepository {
  enqueue(message: NewWalletOutboxMessage): Promise<WalletOutboxMessage>;
  findById(id: string): Promise<WalletOutboxMessage | null>;
  findByReferenceId(referenceId: string): Promise<WalletOutboxMessage | null>;
  claimNext(now: Date): Promise<WalletOutboxMessage | null>;
  markSucceeded(id: string, result: WalletOutboxSuccess): Promise<void>;
  markFailed(id: string, failure: WalletOutboxFailure): Promise<void>;
  releaseForRetry(
    id: string,
    failure: WalletOutboxFailure,
    availableAt: Date,
  ): Promise<void>;
}
