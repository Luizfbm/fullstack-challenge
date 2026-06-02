import { WalletCreditFailedError } from "../game.errors";
import type { GameRepository } from "../ports/game.repository";
import type { IdGenerator } from "../ports/id-generator";
import type { WalletClient, WalletOperationResult } from "../ports/wallet.client";
import type { WalletOutboxRepository } from "../ports/wallet-outbox.repository";
import type { WalletOutboxMessage } from "../wallet-outbox/wallet-outbox-message";
import type { Bet } from "../../domain/bet";
import type { Round } from "../../domain/round";

type WalletOutboxDispatcherPort = {
  dispatchMessage(message: WalletOutboxMessage): Promise<void>;
};

export class CashoutCreditService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly walletClient: WalletClient,
    private readonly idGenerator?: IdGenerator,
    private readonly walletOutboxRepository?: WalletOutboxRepository,
    private readonly walletOutboxDispatcher?: WalletOutboxDispatcherPort,
  ) {}

  async creditCashout(round: Round, bet: Bet): Promise<WalletOperationResult> {
    if (bet.payoutCents === null) {
      throw new Error("Cashout payout was not calculated");
    }

    const referenceId = this.referenceId(round.id, bet.playerId);

    if (!this.walletOutboxRepository || !this.walletOutboxDispatcher) {
      await this.gameRepository.saveRound(round);

      return this.walletClient.credit({
        playerId: bet.playerId,
        amountCents: bet.payoutCents,
        referenceId,
        reason: "CASHOUT_PAYOUT",
      });
    }

    if (!this.idGenerator) {
      throw new Error("Wallet outbox dependencies are not configured");
    }

    let message = await this.walletOutboxRepository.findByReferenceId(referenceId);

    if (!message) {
      message = await this.gameRepository.saveRoundWithWalletOutbox(round, {
        id: this.idGenerator.generate(),
        type: "WALLET_CREDIT",
        status: "IN_FLIGHT",
        roundId: round.id,
        betId: bet.id,
        playerId: bet.playerId,
        username: bet.username,
        amountCents: bet.payoutCents,
        referenceId,
        reason: "CASHOUT_PAYOUT",
      });
    }

    if (message.status !== "SUCCEEDED") {
      await this.walletOutboxDispatcher.dispatchMessage(message);
      message = await this.walletOutboxRepository.findById(message.id);
    }

    if (message?.status !== "SUCCEEDED" || message.responseBalanceCents === null) {
      throw new WalletCreditFailedError(
        new Error(message?.errorMessage ?? "Wallet credit failed"),
      );
    }

    return {
      applied: message.responseApplied ?? true,
      balanceCents: message.responseBalanceCents,
    };
  }

  private referenceId(roundId: string, playerId: string): string {
    return `round:${roundId}:player:${playerId}:cashout-credit`;
  }
}
