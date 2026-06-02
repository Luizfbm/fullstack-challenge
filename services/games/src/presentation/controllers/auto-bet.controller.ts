import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { GetMyAutoBetSessionUseCase } from "../../application/use-cases/get-my-auto-bet-session.use-case";
import { StartAutoBetSessionUseCase } from "../../application/use-cases/start-auto-bet-session.use-case";
import { StopAutoBetSessionUseCase } from "../../application/use-cases/stop-auto-bet-session.use-case";
import { CurrentUser } from "../../infrastructure/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../infrastructure/auth/authenticated-user";
import { KeycloakJwtGuard } from "../../infrastructure/auth/keycloak-jwt.guard";
import { toAutoBetSessionResponse } from "../auto-bet-session-response.mapper";
import { StartAutoBetSessionRequestDto } from "../dtos/auto-bet-session-request.dto";
import { AutoBetSessionResponseDto } from "../dtos/auto-bet-session-response.dto";
import { toGameHttpError } from "../game-http-errors";

@ApiTags("games")
@Controller("auto-bet")
export class AutoBetController {
  constructor(
    private readonly startAutoBetSessionUseCase: StartAutoBetSessionUseCase,
    private readonly getMyAutoBetSessionUseCase: GetMyAutoBetSessionUseCase,
    private readonly stopAutoBetSessionUseCase: StopAutoBetSessionUseCase,
  ) {}

  @Post("sessions")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiBody({ type: StartAutoBetSessionRequestDto })
  @ApiOperation({ summary: "Start an auto bet session for the authenticated player" })
  @ApiBadRequestResponse({
    description: "Invalid configuration or active auto bet session already exists",
  })
  @ApiCreatedResponse({ type: AutoBetSessionResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async startSession(
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

  @Get("sessions/me")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated player's auto bet session" })
  @ApiOkResponse({ type: AutoBetSessionResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async mySession(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AutoBetSessionResponseDto | null> {
    const session = await this.getMyAutoBetSessionUseCase.execute({
      playerId: user.playerId,
    });

    return session ? toAutoBetSessionResponse(session) : null;
  }

  @Post("sessions/me/stop")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Stop the authenticated player's active auto bet session" })
  @ApiCreatedResponse({ type: AutoBetSessionResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async stopSession(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AutoBetSessionResponseDto | null> {
    const session = await this.stopAutoBetSessionUseCase.execute({
      playerId: user.playerId,
    });

    return session ? toAutoBetSessionResponse(session) : null;
  }
}
