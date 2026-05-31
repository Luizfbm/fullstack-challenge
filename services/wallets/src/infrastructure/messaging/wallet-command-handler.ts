import { CreditWalletUseCase } from "../../application/use-cases/credit-wallet.use-case";
import { DebitWalletUseCase } from "../../application/use-cases/debit-wallet.use-case";
import { WalletNotFoundError } from "../../application/wallet.errors";
import { InsufficientFundsError } from "../../domain/wallet.errors";
import { WalletTransactionReason } from "../../domain/wallet-transaction";

type WalletCommandData = {
  playerId: string;
  amountCents: string;
  referenceId: string;
  reason: WalletTransactionReason;
};

export type WalletCommand = {
  pattern: string;
  data: WalletCommandData;
};

export type WalletCommandResponse =
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

export class WalletCommandHandler {
  constructor(
    private readonly debitWalletUseCase: DebitWalletUseCase,
    private readonly creditWalletUseCase: CreditWalletUseCase,
  ) {}

  async handle(command: WalletCommand): Promise<WalletCommandResponse> {
    try {
      switch (command.pattern) {
        case "wallet.debit":
          return this.success(
            await this.debitWalletUseCase.execute(command.data),
          );
        case "wallet.credit":
          return this.success(
            await this.creditWalletUseCase.execute(command.data),
          );
        default:
          return {
            ok: false,
            error: {
              code: "UNKNOWN_WALLET_COMMAND",
              message: `Unknown wallet command: ${command.pattern}`,
            },
          };
      }
    } catch (error) {
      return this.failure(error);
    }
  }

  private success(result: {
    applied: boolean;
    balanceCents: bigint;
  }): WalletCommandResponse {
    return {
      ok: true,
      data: {
        applied: result.applied,
        balanceCents: result.balanceCents.toString(),
      },
    };
  }

  private failure(error: unknown): WalletCommandResponse {
    if (error instanceof InsufficientFundsError) {
      return {
        ok: false,
        error: {
          code: "INSUFFICIENT_FUNDS",
          message: error.message,
        },
      };
    }

    if (error instanceof WalletNotFoundError) {
      return {
        ok: false,
        error: {
          code: "WALLET_NOT_FOUND",
          message: error.message,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "WALLET_COMMAND_FAILED",
        message: error instanceof Error ? error.message : "Wallet command failed",
      },
    };
  }
}
