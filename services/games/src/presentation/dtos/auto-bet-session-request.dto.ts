import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  MAX_AUTO_CASHOUT_MULTIPLIER_BP,
  MIN_AUTO_CASHOUT_MULTIPLIER_BP,
} from "../../application/auto-cashout";

export class StartAutoBetSessionRequestDto {
  @ApiProperty({ example: "1000" })
  amountCents!: string;

  @ApiPropertyOptional({
    description: "Optional per-bet auto cashout target in basis points.",
    example: 20000,
    maximum: MAX_AUTO_CASHOUT_MULTIPLIER_BP,
    minimum: MIN_AUTO_CASHOUT_MULTIPLIER_BP,
    nullable: true,
  })
  autoCashoutMultiplierBp?: number | null;

  @ApiPropertyOptional({
    description: "Automatic betting strategy. Defaults to FIXED.",
    enum: ["FIXED", "MARTINGALE"],
    example: "MARTINGALE",
  })
  strategy?: "FIXED" | "MARTINGALE" | null;

  @ApiPropertyOptional({
    description: "Integer multiplier applied after each Martingale loss.",
    example: 2,
    maximum: 10,
    minimum: 2,
    nullable: true,
  })
  martingaleMultiplier?: number | null;

  @ApiPropertyOptional({
    description: "Maximum Martingale progression steps before stopping.",
    example: 3,
    maximum: 10,
    minimum: 1,
    nullable: true,
  })
  martingaleMaxSteps?: number | null;

  @ApiProperty({
    description: "Maximum number of automatic bets in this session.",
    example: 20,
    maximum: 100,
    minimum: 1,
  })
  maxRounds!: number;

  @ApiPropertyOptional({ example: "10000", nullable: true })
  stopLossCents?: string | null;

  @ApiPropertyOptional({ example: "15000", nullable: true })
  takeProfitCents?: string | null;
}
