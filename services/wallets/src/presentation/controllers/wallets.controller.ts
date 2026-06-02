import { Controller, Get, Header, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { CreateWalletUseCase } from "../../application/use-cases/create-wallet.use-case";
import { GetWalletUseCase } from "../../application/use-cases/get-wallet.use-case";
import { CurrentUser } from "../../infrastructure/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../infrastructure/auth/authenticated-user";
import { KeycloakJwtGuard } from "../../infrastructure/auth/keycloak-jwt.guard";
import { WalletMetrics } from "../../infrastructure/observability/wallet-metrics";
import { HealthCheckResponseDto } from "../dtos/health-check-response.dto";
import {
  CreateWalletResponseDto,
  WalletResponseDto,
} from "../dtos/wallet-response.dto";

@ApiTags("wallets")
@Controller()
export class WalletsController {
  constructor(
    private readonly createWalletUseCase: CreateWalletUseCase,
    private readonly getWalletUseCase: GetWalletUseCase,
    private readonly walletMetrics: WalletMetrics,
  ) {}

  @Get("health")
  @ApiOperation({ summary: "Check Wallet Service health" })
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Get("metrics")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @ApiOperation({ summary: "Expose Wallet Service Prometheus metrics" })
  async metrics(): Promise<string> {
    return this.walletMetrics.metricsText();
  }

  @Post()
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Create the authenticated player's wallet" })
  @ApiCreatedResponse({ type: CreateWalletResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async create(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateWalletResponseDto> {
    const result = await this.createWalletUseCase.execute({
      playerId: user.playerId,
      initialBalanceCents: BigInt(
        process.env.INITIAL_WALLET_BALANCE_CENTS ?? "100000",
      ),
    });

    return {
      created: result.created,
      playerId: result.wallet.playerId,
      balanceCents: result.wallet.balance.cents.toString(),
    };
  }

  @Get("me")
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated player's wallet" })
  @ApiOkResponse({ type: WalletResponseDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid bearer token" })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<WalletResponseDto> {
    const wallet = await this.getWalletUseCase.execute({
      playerId: user.playerId,
    });

    return {
      playerId: wallet.playerId,
      balanceCents: wallet.balance.cents.toString(),
    };
  }
}
