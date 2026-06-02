import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
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
import { CashOutUseCase } from "../../application/use-cases/cash-out.use-case";
import { GetMyAutoBetSessionUseCase } from "../../application/use-cases/get-my-auto-bet-session.use-case";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";
import { ListMyBetsUseCase } from "../../application/use-cases/list-my-bets.use-case";
import { ListLeaderboardUseCase } from "../../application/use-cases/list-leaderboard.use-case";
import { ListRoundHistoryUseCase } from "../../application/use-cases/list-round-history.use-case";
import { PlaceBetUseCase } from "../../application/use-cases/place-bet.use-case";
import { StartAutoBetSessionUseCase } from "../../application/use-cases/start-auto-bet-session.use-case";
import { StopAutoBetSessionUseCase } from "../../application/use-cases/stop-auto-bet-session.use-case";
import { VerifyRoundUseCase } from "../../application/use-cases/verify-round.use-case";
import { Round } from "../../domain/round";
import { CurrentUser } from "../../infrastructure/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../infrastructure/auth/authenticated-user";
import { KeycloakJwtGuard } from "../../infrastructure/auth/keycloak-jwt.guard";
import { GameMetrics } from "../../infrastructure/observability/game-metrics";
import { toAutoBetSessionResponse } from "../auto-bet-session-response.mapper";
import { BetResponseDto } from "../dtos/bet-response.dto";
import { StartAutoBetSessionRequestDto } from "../dtos/auto-bet-session-request.dto";
import { AutoBetSessionResponseDto } from "../dtos/auto-bet-session-response.dto";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import { LeaderboardEntryDto } from "../dtos/leaderboard-response.dto";
import { PlaceBetRequestDto } from "../dtos/place-bet-request.dto";
import {
  RoundResponseDto,
  VerifyRoundResponseDto,
} from "../dtos/round-response.dto";
import { toPublicBetFields, toPublicRoundFields } from "../round-response.mapper";
import {
  parseLeaderboardLimit,
  parseLeaderboardPeriod,
} from "../leaderboard-query";
import { toLeaderboardEntryResponse } from "../leaderboard-response.mapper";
import { parsePositiveLimit } from "../pagination-query";
import { toGameHttpError } from "../game-http-errors";

@ApiTags("games")
@Controller()
export class GamesController {
  constructor(
    private readonly getCurrentRoundUseCase: GetCurrentRoundUseCase,
    private readonly listRoundHistoryUseCase: ListRoundHistoryUseCase,
    private readonly verifyRoundUseCase: VerifyRoundUseCase,
    private readonly listMyBetsUseCase: ListMyBetsUseCase,
    private readonly listLeaderboardUseCase: ListLeaderboardUseCase,
    private readonly placeBetUseCase: PlaceBetUseCase,
    private readonly cashOutUseCase: CashOutUseCase,
    private readonly startAutoBetSessionUseCase: StartAutoBetSessionUseCase,
    private readonly getMyAutoBetSessionUseCase: GetMyAutoBetSessionUseCase,
    private readonly stopAutoBetSessionUseCase: StopAutoBetSessionUseCase,
    private readonly gameMetrics: GameMetrics,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Check Game Service health" })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "games" };
  }

  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @ApiOperation({ summary: "Expose Game Service Prometheus metrics" })
  async metrics(): Promise<string> {
    return this.gameMetrics.metricsText();
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
      limit: parsePositiveLimit(limit),
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
      throw toGameHttpError(error);
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
      limit: parsePositiveLimit(limit),
    });

    return bets.map(toPublicBetFields);
  }

  @Get("leaderboard")
  @ApiOperation({ summary: "List top players by net profit" })
  @ApiQuery({
    description: "Ranking period. Defaults to 24h.",
    enum: ["24h", "7d"],
    name: "period",
    required: false,
  })
  @ApiQuery({
    description: "Maximum number of leaderboard entries, from 1 to 50.",
    example: 10,
    name: "limit",
    required: false,
    type: Number,
  })
  @ApiBadRequestResponse({
    description: "period must be 24h or 7d; limit must be between 1 and 50",
  })
  @ApiOkResponse({ type: [LeaderboardEntryDto] })
  async leaderboard(
    @Query("period") period?: string,
    @Query("limit") limit?: string,
  ): Promise<LeaderboardEntryDto[]> {
    const entries = await this.listLeaderboardUseCase.execute({
      limit: parseLeaderboardLimit(limit),
      period: parseLeaderboardPeriod(period),
    });

    return entries.map(toLeaderboardEntryResponse);
  }

  @Post("auto-bet/sessions")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiBody({ type: StartAutoBetSessionRequestDto })
  @ApiOperation({ summary: "Start an auto bet session for the authenticated player" })
  @ApiBadRequestResponse({
    description: "Invalid configuration or active auto bet session already exists",
  })
  @ApiCreatedResponse({ type: AutoBetSessionResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async startAutoBetSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: StartAutoBetSessionRequestDto,
  ): Promise<AutoBetSessionResponseDto> {
    try {
      const session = await this.startAutoBetSessionUseCase.execute({
        playerId: user.playerId,
        username: user.username,
        amountCents: body.amountCents,
        autoCashoutMultiplierBp: body.autoCashoutMultiplierBp ?? null,
        maxRounds: body.maxRounds,
        stopLossCents: body.stopLossCents ?? null,
        takeProfitCents: body.takeProfitCents ?? null,
      });

      return toAutoBetSessionResponse(session);
    } catch (error) {
      throw toGameHttpError(error);
    }
  }

  @Get("auto-bet/sessions/me")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated player's auto bet session" })
  @ApiOkResponse({ type: AutoBetSessionResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async myAutoBetSession(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AutoBetSessionResponseDto | null> {
    const session = await this.getMyAutoBetSessionUseCase.execute({
      playerId: user.playerId,
    });

    return session ? toAutoBetSessionResponse(session) : null;
  }

  @Post("auto-bet/sessions/me/stop")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Stop the authenticated player's active auto bet session" })
  @ApiCreatedResponse({ type: AutoBetSessionResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async stopAutoBetSession(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AutoBetSessionResponseDto | null> {
    const session = await this.stopAutoBetSessionUseCase.execute({
      playerId: user.playerId,
    });

    return session ? toAutoBetSessionResponse(session) : null;
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
        autoCashoutMultiplierBp: body.autoCashoutMultiplierBp ?? null,
      });

      return toPublicBetFields(result.bet);
    } catch (error) {
      throw toGameHttpError(error);
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
      throw toGameHttpError(error);
    }
  }

  private toRoundResponse(round: Round): RoundResponseDto {
    return {
      ...toPublicRoundFields(round),
      bets: round.bets.map(toPublicBetFields),
    };
  }

}
