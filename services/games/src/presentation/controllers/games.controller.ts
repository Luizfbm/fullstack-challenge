import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  BetAmountOutOfRangeError,
  CurrentRoundNotFoundError,
  RoundNotFoundError,
  WalletCreditFailedError,
  WalletOperationRejectedError,
  WalletOperationTimedOutError,
} from "../../application/game.errors";
import { CashOutUseCase } from "../../application/use-cases/cash-out.use-case";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { ListMyBetsUseCase } from "../../application/use-cases/list-my-bets.use-case";
import { ListRoundHistoryUseCase } from "../../application/use-cases/list-round-history.use-case";
import { PlaceBetUseCase } from "../../application/use-cases/place-bet.use-case";
import { VerifyRoundUseCase } from "../../application/use-cases/verify-round.use-case";
import {
  InvalidBetStateError,
  InvalidRoundStateError,
} from "../../domain/game.errors";
import { Round } from "../../domain/round";
import { CurrentUser } from "../../infrastructure/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../infrastructure/auth/authenticated-user";
import { KeycloakJwtGuard } from "../../infrastructure/auth/keycloak-jwt.guard";
import { BetResponseDto } from "../dtos/bet-response.dto";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import { PlaceBetRequestDto } from "../dtos/place-bet-request.dto";
import {
  RoundResponseDto,
  VerifyRoundResponseDto,
} from "../dtos/round-response.dto";
import { toPublicBetFields, toPublicRoundFields } from "../round-response.mapper";

@ApiTags("games")
@Controller()
export class GamesController {
  constructor(
    private readonly getCurrentRoundUseCase: GetCurrentRoundUseCase,
    private readonly listRoundHistoryUseCase: ListRoundHistoryUseCase,
    private readonly verifyRoundUseCase: VerifyRoundUseCase,
    private readonly listMyBetsUseCase: ListMyBetsUseCase,
    private readonly placeBetUseCase: PlaceBetUseCase,
    private readonly cashOutUseCase: CashOutUseCase,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Check Game Service health" })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "games" };
  }

  @Get("rounds/current")
  @ApiOperation({ summary: "Get the current crash round" })
  @ApiOkResponse({ type: RoundResponseDto })
  async currentRound(): Promise<RoundResponseDto | null> {
    const round = await this.getCurrentRoundUseCase.execute();

    return round ? this.toRoundResponse(round) : null;
  }

  @Get("rounds/history")
  @ApiOperation({ summary: "List recent crash rounds" })
  @ApiQuery({
    description: "Maximum number of rounds to return.",
    example: 20,
    name: "limit",
    required: false,
    type: Number,
  })
  @ApiBadRequestResponse({ description: "limit must be a positive integer" })
  @ApiOkResponse({ type: [RoundResponseDto] })
  async roundHistory(
    @Query("limit") limit?: string,
  ): Promise<RoundResponseDto[]> {
    const rounds = await this.listRoundHistoryUseCase.execute({
      limit: this.parseLimit(limit),
    });

    return rounds.map((round) => this.toRoundResponse(round));
  }

  @Get("rounds/:roundId/verify")
  @ApiOperation({ summary: "Verify provably fair data for a round" })
  @ApiParam({
    description: "Round identifier returned by current/history endpoints.",
    name: "roundId",
  })
  @ApiNotFoundResponse({ description: "Round not found" })
  @ApiOkResponse({ type: VerifyRoundResponseDto })
  async verifyRound(
    @Param("roundId") roundId: string,
  ): Promise<VerifyRoundResponseDto> {
    try {
      return await this.verifyRoundUseCase.execute({ roundId });
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  @Get("bets/me")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "List bets for the authenticated player" })
  @ApiQuery({
    description: "Maximum number of bets to return.",
    example: 20,
    name: "limit",
    required: false,
    type: Number,
  })
  @ApiBadRequestResponse({ description: "limit must be a positive integer" })
  @ApiOkResponse({ type: [BetResponseDto] })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async myBets(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string,
  ): Promise<BetResponseDto[]> {
    const bets = await this.listMyBetsUseCase.execute({
      playerId: user.playerId,
      limit: this.parseLimit(limit),
    });

    return bets.map(toPublicBetFields);
  }

  @Post("bet")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiBody({ type: PlaceBetRequestDto })
  @ApiOperation({ summary: "Place one bet in the current betting round" })
  @ApiBadRequestResponse({
    description:
      "Invalid amount, duplicate bet, invalid round state, or wallet rejection",
  })
  @ApiCreatedResponse({ type: BetResponseDto })
  @ApiNotFoundResponse({ description: "Current round or wallet not found" })
  @ApiServiceUnavailableResponse({
    description: "Wallet operation timed out or could not be completed",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async placeBet(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: PlaceBetRequestDto,
  ): Promise<BetResponseDto> {
    try {
      const result = await this.placeBetUseCase.execute({
        playerId: user.playerId,
        username: user.username,
        amountCents: body.amountCents,
      });

      return toPublicBetFields(result.bet);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  @Post("bet/cashout")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Cash out the authenticated player's active bet" })
  @ApiBadRequestResponse({
    description: "No accepted bet, invalid round state, or crash already hit",
  })
  @ApiCreatedResponse({ type: BetResponseDto })
  @ApiNotFoundResponse({ description: "Current round not found" })
  @ApiServiceUnavailableResponse({
    description: "Wallet credit timed out or could not be completed",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async cashOut(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BetResponseDto> {
    try {
      const result = await this.cashOutUseCase.execute({
        playerId: user.playerId,
      });

      return toPublicBetFields(result.bet);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private parseLimit(limit?: string): number | undefined {
    if (!limit) {
      return undefined;
    }

    const parsed = Number(limit);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new BadRequestException("limit must be a positive integer");
    }

    return parsed;
  }

  private toRoundResponse(round: Round): RoundResponseDto {
    return {
      ...toPublicRoundFields(round),
      bets: round.bets.map(toPublicBetFields),
    };
  }

  private toHttpError(error: unknown): Error {
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
  }
}
