import { ApiProperty } from "@nestjs/swagger";
import type { BetStatus } from "../../domain/bet";

export class BetResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  roundId!: string;

  @ApiProperty()
  playerId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ example: "1000" })
  amountCents!: string;

  @ApiProperty({
    enum: [
      "ACCEPTED",
      "REJECTED",
      "CASHOUT_PENDING_CREDIT",
      "CASHED_OUT",
      "LOST",
    ],
  })
  status!: BetStatus;

  @ApiProperty({ nullable: true, example: 15000 })
  cashoutMultiplierBp!: number | null;

  @ApiProperty({ nullable: true, example: "1500" })
  payoutCents!: string | null;

  @ApiProperty({ nullable: true })
  rejectionReason!: string | null;
}
