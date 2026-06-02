import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Tracer } from "@opentelemetry/api";
import type { WalletInboxRepository } from "../../application/ports/wallet-inbox.repository";
import type { WalletInboxCommandPattern } from "../../application/wallet-inbox/wallet-inbox-message";
import { WalletTransactionReason } from "../../domain/wallet-transaction";
import type { WalletMetrics } from "../observability/wallet-metrics";

type WalletCommandData = {
  playerId: string;
  amountCents: string;
  referenceId: string;
  reason: WalletTransactionReason;
};

export type WalletCommand = {
  messageId: string;
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

type WalletCommandMetrics = Pick<WalletMetrics, "recordCommand">;
type KnownWalletCommandName = "debit" | "credit";

const defaultTracer = trace.getTracer("wallets");

export class WalletCommandHandler {
  constructor(
    private readonly walletInboxRepository: WalletInboxRepository,
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
            response = await this.walletInboxRepository.process({
              messageId: command.messageId || command.data.referenceId,
              pattern: command.pattern as WalletInboxCommandPattern,
              data: command.data,
            });
          } catch (error) {
            span.recordException(error instanceof Error ? error : String(error));
            response = {
              ok: false,
              error: {
                code: "WALLET_COMMAND_FAILED",
                message:
                  error instanceof Error ? error.message : "Wallet command failed",
              },
            };
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

}
