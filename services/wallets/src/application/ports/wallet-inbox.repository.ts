import type {
  WalletInboxCommand,
  WalletInboxResponse,
} from "../wallet-inbox/wallet-inbox-message";

export const WALLET_INBOX_REPOSITORY = Symbol("WALLET_INBOX_REPOSITORY");

export interface WalletInboxRepository {
  process(command: WalletInboxCommand): Promise<WalletInboxResponse>;
}
