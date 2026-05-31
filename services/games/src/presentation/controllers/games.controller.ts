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
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
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
import { Bet } from "../../domain/bet";
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
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "games" };
  }

  @Get("rounds/current")
  @ApiOkResponse({ type: RoundResponseDto })
  async currentRound(): Promise<RoundResponseDto | null> {
    const round = await this.getCurrentRoundUseCase.execute();

    return round ? this.toRoundResponse(round) : null;
  }

  @Get("rounds/history")
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
  @ApiOkResponse({ type: [BetResponseDto] })
  async myBets(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string,
  ): Promise<BetResponseDto[]> {
    const bets = await this.listMyBetsUseCase.execute({
      playerId: user.playerId,
      limit: this.parseLimit(limit),
    });

    return bets.map((bet) => this.toBetResponse(bet));
  }

  @Post("bet")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiBody({ type: PlaceBetRequestDto })
  @ApiCreatedResponse({ type: BetResponseDto })
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

      return this.toBetResponse(result.bet);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  @Post("bet/cashout")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: BetResponseDto })
  async cashOut(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BetResponseDto> {
    try {
      const result = await this.cashOutUseCase.execute({
        playerId: user.playerId,
      });

      return this.toBetResponse(result.bet);
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
      id: round.id,
      status: round.status,
      bettingStartsAt: round.bettingStartsAt.toISOString(),
      bettingEndsAt: round.bettingEndsAt.toISOString(),
      startedAt: round.startedAt?.toISOString() ?? null,
      crashedAt: round.crashedAt?.toISOString() ?? null,
      crashPointBp: round.serverSeed ? round.crashPointBp : null,
      serverSeedHash: round.serverSeedHash,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      nonce: round.nonce,
      chainIndex: round.chainIndex,
      nextServerSeedHash: round.nextServerSeedHash,
      bets: round.bets.map((bet) => this.toBetResponse(bet)),
    };
  }

  private toBetResponse(bet: Bet): BetResponseDto {
    return {
      id: bet.id,
      roundId: bet.roundId,
      playerId: bet.playerId,
      username: bet.username,
      amountCents: bet.amountCents.toString(),
      status: bet.status,
      cashoutMultiplierBp: bet.cashoutMultiplierBp,
      payoutCents: bet.payoutCents?.toString() ?? null,
      rejectionReason: bet.rejectionReason,
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
