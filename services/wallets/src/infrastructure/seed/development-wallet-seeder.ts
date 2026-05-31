import { OnModuleInit } from "@nestjs/common";
import { CreateWalletUseCase } from "../../application/use-cases/create-wallet.use-case";

type DevelopmentWalletSeederConfig = {
  playerId?: string;
  initialBalanceCents?: string;
};

export class DevelopmentWalletSeeder implements OnModuleInit {
  constructor(
    private readonly createWalletUseCase: CreateWalletUseCase,
    private readonly config: DevelopmentWalletSeederConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    if (!this.config.playerId) {
      return;
    }

    await this.createWalletUseCase.execute({
      playerId: this.config.playerId,
      initialBalanceCents: this.parseInitialBalance(),
    });
  }

  private parseInitialBalance(): bigint {
    const rawValue = this.config.initialBalanceCents ?? "0";

    try {
      return BigInt(rawValue);
    } catch {
      throw new Error(
        `Invalid INITIAL_WALLET_BALANCE_CENTS value: ${rawValue}`,
      );
    }
  }
}
