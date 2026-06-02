import { ApiProperty } from "@nestjs/swagger";
import type {
  AutoBetSessionStatus,
  AutoBetStrategy,
  AutoBetStopReason,
} from "../../application/auto-bet/auto-bet-session";

export class AutoBetSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  playerId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ enum: ["ACTIVE", "STOPPED"] })
  status!: AutoBetSessionStatus;

  @ApiProperty({ enum: ["FIXED", "MARTINGALE"] })
  strategy!: AutoBetStrategy;

  @ApiProperty({ example: "1000" })
  amountCents!: string;

  @ApiProperty({ example: "2000" })
  nextAmountCents!: string;

  @ApiProperty({ example: 20000, nullable: true })
  autoCashoutMultiplierBp!: number | null;

  @ApiProperty({ example: 20 })
  maxRounds!: number;

  @ApiProperty({ example: 3 })
  roundsPlayed!: number;

  @ApiProperty({ example: 2 })
  martingaleMultiplier!: number;

  @ApiProperty({ example: 3 })
  martingaleMaxSteps!: number;

  @ApiProperty({ example: 1 })
  martingaleCurrentStep!: number;

  @ApiProperty({ example: "500" })
  netProfitCents!: string;

  @ApiProperty({ example: "10000", nullable: true })
  stopLossCents!: string | null;

  @ApiProperty({ example: "15000", nullable: true })
  takeProfitCents!: string | null;

  @ApiProperty({
    enum: [
      "MANUAL",
      "MAX_ROUNDS_REACHED",
      "STOP_LOSS_REACHED",
      "TAKE_PROFIT_REACHED",
      "MARTINGALE_MAX_STEPS_REACHED",
      "MARTINGALE_BET_LIMIT_REACHED",
      "WALLET_REJECTED",
      "WALLET_UNAVAILABLE",
      "ROUND_NOT_AVAILABLE",
    ],
    nullable: true,
  })
  stopReason!: AutoBetStopReason | null;

  @ApiProperty({ nullable: true })
  startsAfterRoundId!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ nullable: true })
  stoppedAt!: string | null;
}
