import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  BetAmountOutOfRangeError,
  CurrentRoundNotFoundError,
  RoundNotFoundError,
  WalletCreditFailedError,
  WalletOperationRejectedError,
  WalletOperationTimedOutError,
} from "../application/game.errors";
import {
  InvalidBetStateError,
  InvalidRoundStateError,
} from "../domain/game.errors";

export const toGameHttpError = (error: unknown): Error => {
  if (
    error instanceof BetAmountOutOfRangeError ||
    error instanceof InvalidBetStateError ||
    error instanceof InvalidRoundStateError
  ) {
    return new BadRequestException(error.message);
  }

  if (
    error instanceof CurrentRoundNotFoundError ||
    error instanceof RoundNotFoundError
  ) {
    return new NotFoundException(error.message);
  }

  if (
    error instanceof WalletCreditFailedError ||
    error instanceof WalletOperationTimedOutError
  ) {
    return new ServiceUnavailableException(error.message);
  }

  if (error instanceof WalletOperationRejectedError) {
    if (error.code === "WALLET_NOT_FOUND") {
      return new NotFoundException(error.message);
    }

    return new BadRequestException(error.message);
  }

  return error instanceof Error ? error : new Error("Unexpected game error");
};
