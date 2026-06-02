import { PrismaClient } from "../../../prisma/generated/client";
import type {
  NewWalletOutboxMessage,
  WalletOutboxMessage,
  WalletOutboxReason,
  WalletOutboxType,
} from "../../application/wallet-outbox/wallet-outbox-message";

type WalletOutboxRecord = NonNullable<
  Awaited<ReturnType<PrismaClient["walletOutboxMessage"]["findFirst"]>>
>;

export function toWalletOutboxCreateData(message: NewWalletOutboxMessage) {
  return {
    id: message.id,
    type: message.type,
    status: message.status ?? "PENDING",
    roundId: message.roundId,
    betId: message.betId,
    playerId: message.playerId,
    username: message.username,
    amountCents: message.amountCents,
    referenceId: message.referenceId,
    reason: message.reason,
    availableAt: message.availableAt,
  };
}

export function toWalletOutboxMessage(
  message: WalletOutboxRecord,
): WalletOutboxMessage {
  return {
    id: message.id,
    type: message.type as WalletOutboxType,
    status: message.status,
    roundId: message.roundId,
    betId: message.betId,
    playerId: message.playerId,
    username: message.username,
    amountCents: message.amountCents,
    referenceId: message.referenceId,
    reason: message.reason as WalletOutboxReason,
    attempts: message.attempts,
    availableAt: message.availableAt,
    responseApplied: message.responseApplied,
    responseBalanceCents: message.responseBalanceCents,
    errorCode: message.errorCode,
    errorMessage: message.errorMessage,
  };
}
