import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CreateWalletUseCase } from "../../application/use-cases/create-wallet.use-case";
import { GetWalletUseCase } from "../../application/use-cases/get-wallet.use-case";
import { CurrentUser } from "../../infrastructure/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../infrastructure/auth/authenticated-user";
import { KeycloakJwtGuard } from "../../infrastructure/auth/keycloak-jwt.guard";
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
  ) {}

  @Get("health")
  @ApiOkResponse({ type: HealthCheckResponseDto })
  check(): HealthCheckResponseDto {
    return { status: "ok", service: "wallets" };
  }

  @Post()
  @UseGuards(KeycloakJwtGuard)
  @ApiBearerAuth()
  @ApiCreatedResponse({ type: CreateWalletResponseDto })
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
  @ApiOkResponse({ type: WalletResponseDto })
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
