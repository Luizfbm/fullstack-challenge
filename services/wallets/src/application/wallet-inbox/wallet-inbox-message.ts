import type { WalletTransactionReason } from "../../domain/wallet-transaction";

export type WalletInboxCommandPattern = "wallet.debit" | "wallet.credit";

export type WalletInboxCommand = {
  messageId: string;
  pattern: WalletInboxCommandPattern;
  data: {
    playerId: string;
    amountCents: string;
    referenceId: string;
    reason: WalletTransactionReason;
  };
};

export type WalletInboxResponse =
  | {
      ok: true;
      data: {
        applied: boolean;
        balanceCents: string;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };
