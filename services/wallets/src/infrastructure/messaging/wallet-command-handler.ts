import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Tracer } from "@opentelemetry/api";
import { CreditWalletUseCase } from "../../application/use-cases/credit-wallet.use-case";
import { DebitWalletUseCase } from "../../application/use-cases/debit-wallet.use-case";
import { WalletNotFoundError } from "../../application/wallet.errors";
import { InsufficientFundsError } from "../../domain/wallet.errors";
import { WalletTransactionReason } from "../../domain/wallet-transaction";
import type { WalletMetrics } from "../observability/wallet-metrics";

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

type WalletCommandFailureResponse = Extract<
  WalletCommandResponse,
  { ok: false }
>;
type WalletCommandMetrics = Pick<WalletMetrics, "recordCommand">;
type KnownWalletCommandName = "debit" | "credit";

const defaultTracer = trace.getTracer("wallets");

export class WalletCommandHandler {
  constructor(
    private readonly debitWalletUseCase: DebitWalletUseCase,
    private readonly creditWalletUseCase: CreditWalletUseCase,
    private readonly walletMetrics?: WalletCommandMetrics,
    private readonly tracer: Tracer = defaultTracer,
  ) {}

  async handle(command: WalletCommand): Promise<WalletCommandResponse> {
    const commandName = this.commandNameFor(command.pattern);

    if (commandName === null) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN_WALLET_COMMAND",
          message: `Unknown wallet command: ${command.pattern}`,
        },
      };
    }

    const startedAt = performance.now();

    return this.tracer.startActiveSpan(
      `wallets.command.${commandName}`,
      async (span) => {
        try {
          let response: WalletCommandResponse;

          try {
            const result =
              commandName === "debit"
                ? await this.debitWalletUseCase.execute(command.data)
                : await this.creditWalletUseCase.execute(command.data);
            response = this.success(result);
          } catch (error) {
            response = this.failure(error);

            if (response.error.code === "WALLET_COMMAND_FAILED") {
              span.recordException(
                error instanceof Error ? error : String(error),
              );
            }
          }

          if (response.ok) {
            span.setAttributes({
              "crash.wallet.command": commandName,
              "crash.wallet.command.result": "succeeded",
              "crash.wallet.command.applied": response.data.applied,
            });
          } else {
            span.setAttributes({
              "crash.wallet.command": commandName,
              "crash.wallet.command.result": "failed",
              "crash.wallet.command.error_code": response.error.code,
            });
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: response.error.code,
            });
          }

          this.recordCommandMetric(commandName, command, response, startedAt);

          return response;
        } catch (error) {
          span.recordException(error instanceof Error ? error : String(error));
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  private commandNameFor(pattern: string): KnownWalletCommandName | null {
    switch (pattern) {
      case "wallet.debit":
        return "debit";
      case "wallet.credit":
        return "credit";
      default:
        return null;
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

  private recordCommandMetric(
    commandName: KnownWalletCommandName,
    command: WalletCommand,
    response: WalletCommandResponse,
    startedAt: number,
  ): void {
    try {
      if (response.ok) {
        this.walletMetrics?.recordCommand(
          commandName,
          "succeeded",
          performance.now() - startedAt,
          response.data.applied ? BigInt(command.data.amountCents) : null,
        );
        return;
      }

      this.walletMetrics?.recordCommand(
        commandName,
        "failed",
        performance.now() - startedAt,
        null,
        response.error.code,
      );
    } catch {
      // Metrics are best-effort and must not alter command responses.
    }
  }

  private failure(error: unknown): WalletCommandFailureResponse {
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
